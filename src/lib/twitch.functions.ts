import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ channelUrl: z.string().url() });
const refreshInput = z.object({
  channels: z.array(z.object({ id: z.string(), channelUrl: z.string().url(), followers: z.number().int().nonnegative().optional() })).max(100),
  force: z.boolean().optional(),
});
const clipsInput = z.object({ channelUrl: z.string().url(), first: z.number().int().min(1).max(20).optional() });
const codeInput = z.object({ code: z.string().min(1) });

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
  streamId?: string;
  followers?: number;
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
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: twitchRedirectUri(), response_type: "code", scope: "user:read:email" });
  return { url: `https://id.twitch.tv/oauth2/authorize?${params}` };
});

export const completeTwitchAuthorization = createServerFn({ method: "POST" })
  .validator(codeInput)
  .handler(async ({ data }) => {
    const clientId = process.env["TWITCH_CLIENT_ID"];
    const clientSecret = process.env["TWITCH_CLIENT_SECRET"];
    if (!clientId || !clientSecret) throw new Error("Twitch credentials are not configured");
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: data.code, grant_type: "authorization_code", redirect_uri: twitchRedirectUri() }) });
    if (!tokenResponse.ok) throw new Error("Twitch authorization could not be completed");
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Twitch did not return an access token");
    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token.access_token}` };
    const userResponse = await fetch("https://api.twitch.tv/helix/users", { headers });
    if (!userResponse.ok) throw new Error("Twitch profile lookup failed");
    const users = (await userResponse.json()) as { data?: Array<{ id: string; display_name: string; login: string; description: string; profile_image_url: string; offline_image_url: string }> };
    const user = users.data?.[0];
    if (!user) throw new Error("Twitch did not return a profile");
    const ownStreamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(user.id)}`, { headers });
    const streams = ownStreamResponse.ok ? (await ownStreamResponse.json()) as { data?: Array<{ thumbnail_url?: string }> } : { data: [] };
    const thumbnail = streams.data?.[0]?.thumbnail_url?.replace("{width}", "1280").replace("{height}", "720") ?? "";
    return { display_name: user.display_name, handle: `@${user.login}`, bio: user.description || "", avatar_url: user.profile_image_url || "", banner_url: thumbnail || user.offline_image_url || "", platform: "Twitch", channel_url: `https://www.twitch.tv/${user.login}`, status: thumbnail ? "live" : "offline" };
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
