import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {usingVpsJobs,vpsServerRequest} from './vps-server';

const input = z.object({ channelUrl: z.string().url() });
const refreshInput = z.object({
  channels: z.array(z.object({ id: z.string(), channelUrl: z.string().url(), followers: z.number().int().nonnegative().optional() })).max(100),
  force: z.boolean().optional(),
});
const clipsInput = z.object({ channelUrl: z.string().url(), first: z.number().int().min(1).max(20).optional() });
const codeInput = z.object({
  code: z.string().min(1),
  accessToken: z.string().min(20),
  expectedLogin: z.string().optional(),
});

function twitchRedirectUri() {
  return process.env["TWITCH_REDIRECT_URI"] || "https://peak-pylon.vercel.app/twitch/callback";
}

function twitchLogin(channelUrl: string) {
  const url = new URL(channelUrl);
  if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) throw new Error("Use a twitch.tv channel URL");
  const login = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
  if (!login) throw new Error("Add a Twitch channel name to the URL");
  return login;
}

let cachedAppToken: { clientId: string; token: string; expiresAt: number } | null = null;

type TwitchStatusSnapshot = {
  id: string;
  name: string;
  handle: string;
  status: "live" | "offline";
  banner: string;
  avatar: string;
  bio: string;
  gameName: string;
  gameImage: string;
  viewerCount: number;
  title: string;
  streamId?: string | undefined;
  followers?: number | undefined;
};

let memoryStatusCache: { signature: string; snapshots: TwitchStatusSnapshot[]; expiresAt: number } | null = null;

async function getAppToken() {
  const clientId = process.env["TWITCH_CLIENT_ID"];
  const clientSecret = process.env["TWITCH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Twitch credentials are not configured");
  if (cachedAppToken?.clientId === clientId && cachedAppToken.expiresAt > Date.now() + 60_000) {
    return { clientId, token: cachedAppToken.token };
  }
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error("Twitch authorization failed");
  const token = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw new Error("Twitch did not return an access token");
  cachedAppToken = {
    clientId,
    token: token.access_token,
    expiresAt: Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000,
  };
  return { clientId, token: token.access_token };
}

export const beginTwitchAuthorization = createServerFn({ method: "GET" }).handler(async () => {
  const clientId = process.env["TWITCH_CLIENT_ID"];
  if (!clientId) throw new Error("Twitch credentials are not configured");
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: twitchRedirectUri(), response_type: "code", scope: "user:read:email moderator:read:chatters moderator:read:followers" });
  return { url: `https://id.twitch.tv/oauth2/authorize?${params}` };
});

export const completeTwitchAuthorization = createServerFn({ method: "POST" })
  .validator(codeInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Your StreamCore session has expired. Please sign in again.");

    const db = supabaseAdmin as any;
    const { data: currentProfile, error: profileReadError } = await db
      .from("profiles")
      .select("rules_acknowledged, social_links")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileReadError) throw profileReadError;
    if (!currentProfile?.rules_acknowledged) throw new Error("Accept the StreamCore community rules before connecting Twitch.");

    const clientId = process.env["TWITCH_CLIENT_ID"];
    const clientSecret = process.env["TWITCH_CLIENT_SECRET"];
    if (!clientId || !clientSecret) throw new Error("Twitch credentials are not configured");
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: data.code, grant_type: "authorization_code", redirect_uri: twitchRedirectUri() }) });
    if (!tokenResponse.ok) throw new Error("Twitch authorization could not be completed");
    const token = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string[] };
    if (!token.access_token) throw new Error("Twitch did not return an access token");
    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token.access_token}` };
    const userResponse = await fetch("https://api.twitch.tv/helix/users", { headers });
    if (!userResponse.ok) throw new Error("Twitch profile lookup failed");
    const users = (await userResponse.json()) as { data?: Array<{ id: string; display_name: string; login: string; description: string; profile_image_url: string; offline_image_url: string }> };
    const user = users.data?.[0];
    if (!user) throw new Error("Twitch did not return a profile");
    const expectedLogin = (data.expectedLogin ?? "").trim().replace(/^@/, "").toLowerCase();
    if (expectedLogin && expectedLogin !== user.login.toLowerCase()) {
      throw new Error(`You authorized @${user.login}, but entered @${expectedLogin}. Sign in to the matching Twitch account.`);
    }
    const ownStreamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(user.id)}`, { headers });
    const streams = ownStreamResponse.ok ? (await ownStreamResponse.json()) as { data?: Array<{ thumbnail_url?: string }> } : { data: [] };
    const thumbnail = streams.data?.[0]?.thumbnail_url?.replace("{width}", "1280").replace("{height}", "720") ?? "";
    const twitchUrl = `https://www.twitch.tv/${user.login}`;
    const currentLinks = Array.isArray(currentProfile.social_links) ? currentProfile.social_links : [];
    const socialLinks = [
      ...currentLinks.filter((link: { platform?: string }) => link.platform !== "Twitch"),
      {
        platform: "Twitch",
        label: `@${user.login}`,
        url: twitchUrl,
        verified: true,
        provider: "twitch",
        providerIdentityId: user.id,
      },
    ];
    const profile = {
      display_name: user.display_name,
      handle: `@${user.login}`,
      bio: user.description || "",
      avatar_url: user.profile_image_url || "",
      banner_url: thumbnail || user.offline_image_url || "",
      platform: "Twitch",
      channel_url: twitchUrl,
      status: thumbnail ? "live" : "offline",
      channel_authorized: true,
      twitch_verified: true,
      twitch_user_id: user.id,
      twitch_authorized_at: new Date().toISOString(),
      social_links: socialLinks,
    };

    const { error: profileError } = await db.from("profiles").update(profile).eq("id", authData.user.id);
    if (profileError) throw profileError;

    // Never return provider credentials to the browser or store them in localStorage.
    const { writeIntegrationSecret } = await import("@/lib/integrations.server");
    await writeIntegrationSecret(db, `twitch_analytics:${authData.user.id}`, JSON.stringify({
      accessToken: token.access_token, refreshToken: token.refresh_token,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
      scopes: token.scope ?? [], twitchUserId: user.id,
    }), authData.user.id);

    let emailStatus = "not_configured";
    try {
      const { dispatchConfiguredResendEvent } = await import("@/lib/resend.server");
      const safeName = user.display_name.replace(/[<>&\"']/g, "");
      const result = await dispatchConfiguredResendEvent({
        kind: "twitch_connected",
        dedupeKey: `twitch-connected:${authData.user.id}:${user.login}`,
        recipientUserIds: [authData.user.id],
        subject: "🎉 Congratulations! Your Twitch channel is connected on StreamCore",
        text: `Congratulations! You connected @${user.login} on StreamCore. Welcome to the creator network!`,
        html: `<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:28px;border-radius:16px"><h1 style="color:#a78bfa">Twitch Channel Connected!</h1><p>Congratulations, <strong>${safeName}</strong>! You connected <strong>@${user.login}</strong> on StreamCore, where creators discover and support one another.</p><a href="https://peak-pylon.vercel.app" style="color:#c084fc">Enter #general →</a></div>`,
      });
      emailStatus = result.status;
    } catch (error) {
      console.error("Twitch authorization email failed:", error);
      emailStatus = "error";
    }

    return { profile, emailStatus };
  });

export const getMyTwitchAnalytics = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().min(20), days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readIntegrationSecret, writeIntegrationSecret } = await import("@/lib/integrations.server");
    const { summarizeStreams, observationSeries } = await import("@/lib/twitch-analytics");
    const db = supabaseAdmin as any;
    const { data: auth, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !auth.user) throw new Error("Sign in again to view your private analytics.");
    const { data: profile, error: profileError } = await db.from("profiles").select("twitch_user_id,twitch_verified,channel_url,social_links").eq("id", auth.user.id).maybeSingle();
    if (profileError) throw new Error("Your connected profile could not be loaded.");
    const { analyticsTwitchId } = await import("@/lib/twitch-identity");
    const userId = analyticsTwitchId(profile, auth.user.identities);
    if (!userId) throw new Error("Your older Twitch connection has no verified channel ID for analytics. Use Reconnect Twitch for analytics below to update it. You do not need to disconnect your profile.");
    const app = await getAppToken();
    const appHeaders = { "Client-Id": app.clientId, Authorization: `Bearer ${app.token}` };
    const helix = async (path: string, headers = appHeaders) => {
      const response = await fetch(`https://api.twitch.tv/helix/${path}`, { headers, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`Twitch analytics request failed (${response.status}). Try refreshing or reconnecting Twitch.`);
      return response.json();
    };
    const [users, live, videos] = await Promise.all([
      helix(`users?id=${encodeURIComponent(userId)}`),
      helix(`streams?user_id=${encodeURIComponent(userId)}`),
      helix(`videos?user_id=${encodeURIComponent(userId)}&type=archive&first=100`),
    ]);
    const login = users.data?.[0]?.login;
    if (!login) throw new Error("Twitch could not find your authorized channel.");
    const cutoff = new Date(Date.now() - data.days * 86400000).toISOString();
    // Resolve admin-imported history by the actual Twitch channel, not the user's display name.
    const { data: listed, error: listedError } = await db.from("community_listed_members").select("id,data").limit(1000);
    if (listedError) throw new Error("Stored creator history could not be resolved.");
    const ids = [`twitch:${userId}`, auth.user.id, ...(listed ?? []).filter((row: any) => {
      try { return twitchLogin(row.data?.link ?? "").toLowerCase() === login.toLowerCase(); } catch { return false; }
    }).map((row: any) => String(row.id))];
    const { data: history, error: historyError } = await db.from("creator_twitch_observations")
      .select("stream_id,observed_at,viewer_count,is_live,followers").in("creator_id", ids)
      .gte("observed_at", cutoff).order("observed_at", { ascending: false }).limit(1000);
    if (historyError) throw new Error("Stored Twitch observations could not be loaded.");
    let followers: number | null = null;
    let chatters: number | null = null;
    let reconnect = true;
    let permissionMessage = "Reconnect Twitch to enable follower and current connected-chatter counts.";
    const secretName = `twitch_analytics:${auth.user.id}`;
    const saved = await readIntegrationSecret(db, secretName);
    if (saved) {
      try {
        let token = JSON.parse(saved);
        if (token.twitchUserId !== userId) throw new Error("Channel authorization changed.");
        if (token.expiresAt <= Date.now() + 60000) {
          const refresh = await fetch("https://id.twitch.tv/oauth2/token", {
            method: "POST", signal: AbortSignal.timeout(12000),
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refreshToken, client_id: app.clientId, client_secret: process.env["TWITCH_CLIENT_SECRET"]! }),
          });
          if (!refresh.ok) throw new Error("Reconnect Twitch to renew analytics access.");
          const next = await refresh.json();
          token = { ...token, accessToken: next.access_token, refreshToken: next.refresh_token ?? token.refreshToken, scopes: next.scope ?? token.scopes, expiresAt: Date.now() + next.expires_in * 1000 };
          await writeIntegrationSecret(db, secretName, JSON.stringify(token), auth.user.id);
        }
        const headers = { "Client-Id": app.clientId, Authorization: `Bearer ${token.accessToken}` };
        const validation = await fetch("https://id.twitch.tv/oauth2/validate", {
          headers: { Authorization: `OAuth ${token.accessToken}` }, signal: AbortSignal.timeout(12000),
        });
        if (!validation.ok) throw new Error("Twitch authorization is no longer valid.");
        const identity = await validation.json();
        if (identity.user_id !== userId || identity.client_id !== app.clientId) throw new Error("Twitch authorization does not match this account.");
        const [followerData, chatterData] = await Promise.all([
          helix(`channels/followers?broadcaster_id=${userId}&first=1`, headers),
          helix(`chat/chatters?broadcaster_id=${userId}&moderator_id=${userId}&first=1`, headers),
        ]);
        followers = followerData.total ?? null;
        chatters = chatterData.total ?? null;
        reconnect = false;
        permissionMessage = "Connected chatters are users currently in chat, not unique message authors from your last stream.";
      } catch {
        permissionMessage = "Twitch analytics permissions expired or could not be read. Reconnect Twitch and approve analytics access.";
      }
    }
    const fetchedAt = new Date().toISOString();
    const currentStream = live.data?.[0];
    const observation = {
      observed_at: fetchedAt, is_live: Boolean(currentStream),
      stream_id: currentStream?.id ?? null, viewer_count: currentStream?.viewer_count ?? 0, followers,
    };
    // Keep channel-scoped measurements for future comparisons, at most one per 30-minute bucket.
    const { error: captureError } = await db.from("creator_twitch_observations").upsert({
      ...observation, creator_id: `twitch:${userId}`,
      observed_bucket: new Date(Math.floor(Date.now() / 1800000) * 1800000).toISOString(),
      game_name: currentStream?.game_name ?? "",
    }, { onConflict: "creator_id,observed_bucket", ignoreDuplicates: true });
    const chartRows = [...(history ?? []), observation];
    return {
      followerHistory: observationSeries(chartRows, "followers"),
      viewerHistory: observationSeries(chartRows, "viewers"),
      captureWarning: captureError ? "The current measurement could not be saved for future growth comparisons." : null,
      login, fetchedAt, followers, chatters, reconnect, permissionMessage,
      currentViewers: live.data?.[0]?.viewer_count ?? null,
      streams: summarizeStreams(history ?? []), historyTruncated: (history?.length ?? 0) >= 1000,
      broadcasts: (videos.data ?? []).filter((v: any) => v.created_at >= cutoff).map((v: any) => ({
        id: String(v.id), streamId: String(v.stream_id ?? ""), title: String(v.title),
        url: `https://www.twitch.tv/videos/${encodeURIComponent(v.id)}`, createdAt: String(v.created_at),
        duration: String(v.duration), videoViews: Number(v.view_count),
      })) as Array<{ id: string; streamId: string; title: string; url: string; createdAt: string; duration: string; videoViews: number }>,
    };
  });

export async function fetchRealTwitchChannelData(login: string) {
  const cleanLogin = login.toLowerCase().replace(/^@/, "").trim();
  try {
    const gqlRes = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          operationName: "ChannelFollowers",
          variables: { login: cleanLogin },
          query: `query ChannelFollowers($login: String!) {
            user(login: $login) {
              id
              login
              displayName
              description
              profileImageURL(width: 300)
              bannerImageURL
              followers {
                totalCount
              }
              stream {
                id
                viewersCount
                game {
                  name
                }
                title
                previewImageURL(width: 1280, height: 720)
              }
            }
          }`,
        },
      ]),
    });

    if (gqlRes.ok) {
      const data = await gqlRes.json();
      const user = data?.[0]?.data?.user;
      if (user) {
        const isLive = Boolean(user.stream);
        const liveThumbnail = user.stream?.previewImageURL || "";
        return {
          id: user.id as string,
          name: user.displayName as string,
          handle: `@${user.login}`,
          bio: (user.description || (user.stream ? `${user.stream.game?.name ? `${user.stream.game.name} · ` : ""}${user.stream.title || ""}` : "")) as string,
          avatar: (user.profileImageURL || "") as string,
          banner: (liveThumbnail || user.bannerImageURL || "") as string,
          followers: (user.followers?.totalCount || 0) as number,
          viewerCount: (user.stream?.viewersCount || 0) as number,
          gameName: (user.stream?.game?.name || "") as string,
          streamTitle: (user.stream?.title || "") as string,
          status: isLive ? ("live" as const) : ("offline" as const),
          platform: "Twitch",
        };
      }
    }
  } catch (err) {
    console.error(`Twitch real lookup error for ${login}:`, err);
  }
  return null;
}

export const getTwitchChannel = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }) => {
    const login = twitchLogin(data.channelUrl);
    const realData = await fetchRealTwitchChannelData(login);
    if (realData) {
      return realData;
    }

    // Fallback to Helix API if GQL is unreachable
    try {
      const { clientId, token } = await getAppToken();
      const headers = { "Client-Id": clientId, Authorization: `Bearer ${token}` };
      const [userResponse, streamResponse] = await Promise.all([
        fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers }),
        fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, { headers }),
      ]);
      if (userResponse.ok) {
        const users = (await userResponse.json()) as { data?: Array<{ id: string; display_name: string; login: string; description: string; profile_image_url: string; offline_image_url: string }> };
        const user = users.data?.[0];
        if (user) {
          const streams = streamResponse.ok ? ((await streamResponse.json()) as { data?: Array<{ title?: string; game_name?: string; thumbnail_url?: string; viewer_count?: number }> }) : { data: [] };
          const stream = streams.data?.[0];
          const liveBanner = stream?.thumbnail_url?.replace("{width}", "1280").replace("{height}", "720") ?? "";
          return {
            name: user.display_name,
            handle: `@${user.login}`,
            bio: user.description || "",
            avatar: user.profile_image_url ?? "",
            banner: liveBanner || user.offline_image_url || "",
            status: stream ? ("live" as const) : ("offline" as const),
            followers: undefined,
            viewerCount: stream?.viewer_count ?? 0,
            gameName: stream?.game_name ?? "",
            streamTitle: stream?.title ?? "",
            platform: "Twitch",
          };
        }
      }
    } catch {
      // ignore fallback error
    }

    throw new Error(`Could not find Twitch channel for ${login}`);
  });

export const refreshTwitchStatuses = createServerFn({ method: "POST" })
  .validator(refreshInput)
  .handler(async ({ data }) => {
    if(usingVpsJobs()) {
      const cached=await vpsServerRequest('/v1/live');
      if(!cached.refreshedAt || Date.parse(cached.refreshedAt)<Date.now()-600000)throw new Error('Live collector has no recent verified snapshot');
      const ids=new Set(data.channels.map(c=>c.id));
      return cached.snapshots.filter((s:TwitchStatusSnapshot)=>ids.has(s.id));
    }
    const valid = data.channels.flatMap((channel) => {
      try { return [{ ...channel, login: twitchLogin(channel.channelUrl).toLowerCase() }]; } catch { return []; }
    });
    if (!valid.length) return [];

    const signature = valid
      .map((channel) => `${channel.id}:${channel.login}`)
      .sort()
      .join("|");
    if (!data.force && memoryStatusCache?.signature === signature && memoryStatusCache.expiresAt > Date.now()) {
      return memoryStatusCache.snapshots;
    }

    let persistedCache: { signature?: string; snapshots?: TwitchStatusSnapshot[]; refreshedAt?: string } | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await (supabaseAdmin as any)
        .from("integration_settings")
        .select("setting_value")
        .eq("setting_name", "twitch_status_snapshot")
        .maybeSingle();
      persistedCache = row?.setting_value ?? null;
      const refreshedAt = persistedCache?.refreshedAt ? Date.parse(persistedCache.refreshedAt) : 0;
      if (
        !data.force &&
        persistedCache?.signature === signature &&
        Array.isArray(persistedCache.snapshots) &&
        refreshedAt > Date.now() - 90_000
      ) {
        memoryStatusCache = {
          signature,
          snapshots: persistedCache.snapshots,
          expiresAt: Date.now() + 90_000,
        };
        return persistedCache.snapshots;
      }
    } catch {
      // A process-local cache still protects Helix if the shared cache is unavailable.
    }

    // Use the official Helix API as the single source of truth. One batched
    // users request and one batched streams request are enough for the whole
    // community, so offline transitions are both accurate and inexpensive.
    const { clientId, token } = await getAppToken();
    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token}` };
    const usersUrl = new URL("https://api.twitch.tv/helix/users");
    for (const channel of valid) usersUrl.searchParams.append("login", channel.login);
    const usersResponse = await fetch(usersUrl, { headers });
    if (!usersResponse.ok) {
      if (
        persistedCache?.signature === signature &&
        Array.isArray(persistedCache.snapshots) &&
        Date.parse(persistedCache.refreshedAt ?? "") > Date.now() - 10 * 60_000
      ) return persistedCache.snapshots;
      throw new Error(`Twitch users lookup failed (${usersResponse.status})`);
    }
    const usersPayload = (await usersResponse.json()) as {
      data?: Array<{
        id: string;
        login: string;
        display_name: string;
        description: string;
        profile_image_url: string;
        offline_image_url: string;
      }>;
    };
    const users = usersPayload.data ?? [];
    const userByLogin = new Map(users.map((user) => [user.login.toLowerCase(), user]));

    const streamsUrl = new URL("https://api.twitch.tv/helix/streams");
    for (const user of users) streamsUrl.searchParams.append("user_id", user.id);
    const streamsResponse = users.length ? await fetch(streamsUrl, { headers }) : null;
    if (streamsResponse && !streamsResponse.ok) {
      if (
        persistedCache?.signature === signature &&
        Array.isArray(persistedCache.snapshots) &&
        Date.parse(persistedCache.refreshedAt ?? "") > Date.now() - 10 * 60_000
      ) return persistedCache.snapshots;
      throw new Error(`Twitch streams lookup failed (${streamsResponse.status})`);
    }
    const streamsPayload = streamsResponse
      ? ((await streamsResponse.json()) as {
          data?: Array<{
            id: string;
            user_id: string;
            game_id: string;
            game_name: string;
            title: string;
            viewer_count: number;
            thumbnail_url: string;
          }>;
        })
      : { data: [] };
    const streams = streamsPayload.data ?? [];
    const streamByUserId = new Map(streams.map((stream) => [stream.user_id, stream]));

    const gameIds = Array.from(new Set(streams.map((stream) => stream.game_id).filter(Boolean)));
    const gamesUrl = new URL("https://api.twitch.tv/helix/games");
    for (const gameId of gameIds) gamesUrl.searchParams.append("id", gameId);
    const gamesResponse = gameIds.length ? await fetch(gamesUrl, { headers }) : null;
    const gamesPayload = gamesResponse?.ok
      ? ((await gamesResponse.json()) as { data?: Array<{ id: string; box_art_url: string }> })
      : { data: [] };
    const gameImageById = new Map(
      (gamesPayload.data ?? []).map((game) => [
        game.id,
        game.box_art_url.replace("{width}", "285").replace("{height}", "380"),
      ]),
    );

    const snapshots: TwitchStatusSnapshot[] = valid.map((channel) => {
      const user = userByLogin.get(channel.login);
      const stream = user ? streamByUserId.get(user.id) : undefined;
      return {
        id: channel.id,
        name: user?.display_name ?? channel.login,
        handle: user?.login ? `@${user.login}` : `@${channel.login}`,
        status: stream ? ("live" as const) : ("offline" as const),
        banner: stream
          ? stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720")
          : (user?.offline_image_url ?? ""),
        avatar: user?.profile_image_url ?? "",
        bio: user?.description ?? "",
        gameName: stream?.game_name ?? "",
        gameImage: stream ? (gameImageById.get(stream.game_id) ?? "") : "",
        viewerCount: stream?.viewer_count ?? 0,
        title: stream?.title ?? "",
        streamId: stream?.id,
        followers: typeof channel.followers === "number" ? channel.followers : undefined,
      };
    });

    const previousSnapshots = Array.isArray(persistedCache?.snapshots) ? persistedCache.snapshots : [];
    if (previousSnapshots.length) {
      const previousById = new Map(previousSnapshots.map((snapshot) => [snapshot.id, snapshot]));
      const channelById = new Map(valid.map((channel) => [channel.id, channel]));
      for (const snapshot of snapshots) {
        if (snapshot.status !== "live" || previousById.get(snapshot.id)?.status === "live") continue;
        const channel = channelById.get(snapshot.id);
        if (!channel) continue;
        try {
          const { dispatchConfiguredResendEvent } = await import("@/lib/resend.server");
          const safeName = snapshot.name.replace(/[<>&\"']/g, "");
          const safeGame = snapshot.gameName.replace(/[<>&\"']/g, "");
          await dispatchConfiguredResendEvent({
            kind: "live",
            dedupeKey: `live:${snapshot.id}:${snapshot.streamId || Date.now()}`,
            subject: `🔴 ${snapshot.name} is live${snapshot.gameName ? ` playing ${snapshot.gameName}` : ""}`,
            text: `${snapshot.name} is now live on Twitch${snapshot.gameName ? ` in ${snapshot.gameName}` : ""}.`,
            html: `<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#ef4444">${safeName} is live now</h2><p>${safeGame ? `Category: ${safeGame}` : "Open the live stream on Twitch."}</p><a href="https://www.twitch.tv/${encodeURIComponent(channel.login)}" style="color:#a78bfa">Watch on Twitch →</a></div>`,
          });
        } catch (error) {
          console.error("Resend live alert failed", error);
        }
      }
    }

    memoryStatusCache = { signature, snapshots, expiresAt: Date.now() + 90_000 };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const now = new Date();
      const observedBucket = new Date(Math.floor(now.getTime() / (30 * 60_000)) * 30 * 60_000).toISOString();
      await Promise.all([
        db.from("integration_settings").upsert(
          {
            setting_name: "twitch_status_snapshot",
            setting_value: { signature, snapshots, refreshedAt: now.toISOString() },
            updated_by: null,
            updated_at: now.toISOString(),
          },
          { onConflict: "setting_name" },
        ),
        db.from("creator_twitch_observations").upsert(
          snapshots.map((snapshot) => ({
            creator_id: snapshot.id,
            observed_bucket: observedBucket,
            observed_at: now.toISOString(),
            is_live: snapshot.status === "live",
            viewer_count: snapshot.viewerCount,
            followers: snapshot.followers ?? null,
            game_name: snapshot.gameName,
            stream_id: snapshot.streamId ?? null,
          })),
          { onConflict: "creator_id,observed_bucket" },
        ),
      ]);
    } catch {
      // The live result is still valid even if the shared cache write fails.
    }
    return snapshots;
  });

/** Tests Twitch App Credentials by obtaining an app access token and fetching a sample profile. */
export const testTwitchConnection = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const { clientId, token } = await getAppToken();
      const userResponse = await fetch("https://api.twitch.tv/helix/users?login=kaicenat", {
        headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
      });
      if (!userResponse.ok) {
        const errorText = await userResponse.text().catch(() => "");
        return { success: false, message: `Twitch API HTTP ${userResponse.status}: ${errorText}` };
      }
      const data = (await userResponse.json()) as { data?: Array<{ id: string; display_name: string; login: string }> };
      const user = data.data?.[0];
      return {
        success: true,
        message: `✅ Twitch API Connected! Live Helix lookup verified (${user?.display_name || "Kai Cenat"}, ID: ${user?.id}). Real Twitch data is syncing.`,
      };
    } catch (err: any) {
      return { success: false, message: `❌ Twitch Connection Failed: ${err.message}` };
    }
  });

/** Fetches public clips for an admin-managed Twitch channel. Credentials stay server-side. */
export const getTwitchClips = createServerFn({ method: "POST" })
  .validator(clipsInput)
  .handler(async ({ data }) => {
    const login = twitchLogin(data.channelUrl);
    const { clientId, token } = await getAppToken();
    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token}` };
    const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers });
    if (!userResponse.ok) throw new Error("Twitch profile lookup failed");
    const users = (await userResponse.json()) as { data?: Array<{ id: string; display_name: string; profile_image_url: string }> };
    const user = users.data?.[0];
    if (!user) throw new Error("Twitch channel not found");
    const response = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${encodeURIComponent(user.id)}&first=${data.first ?? 6}`, { headers });
    if (!response.ok) throw new Error("Twitch clips lookup failed");
    const payload = (await response.json()) as { data?: Array<{ id: string; url: string; title: string; creator_name: string; thumbnail_url: string; view_count: number; created_at: string }> };
    return (payload.data ?? []).map((clip) => ({ ...clip, broadcaster_name: user.display_name, broadcaster_avatar: user.profile_image_url }));
  });
