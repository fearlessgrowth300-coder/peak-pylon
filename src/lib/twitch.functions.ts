import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ channelUrl: z.string().url() });
const refreshInput = z.object({ channels: z.array(z.object({ id: z.string(), channelUrl: z.string().url() })).max(50) });
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

async function getAppToken() {
  const clientId = process.env["TWITCH_CLIENT_ID"];
  const clientSecret = process.env["TWITCH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Twitch credentials are not configured");
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error("Twitch authorization failed");
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Twitch did not return an access token");
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

export const getTwitchChannel = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }) => {
    const login = twitchLogin(data.channelUrl);
    const { clientId, token } = await getAppToken();
    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token}` };
    const [userResponse, streamResponse] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers }),
      fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, { headers }),
    ]);
    if (!userResponse.ok) throw new Error("Twitch profile lookup failed");
    const users = (await userResponse.json()) as { data?: Array<{ id: string; display_name: string; login: string; description: string; profile_image_url: string; offline_image_url: string }> };
    const user = users.data?.[0];
    if (!user) throw new Error("Twitch channel not found");

    let followersCount = 0;
    try {
      const followersRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(user.id)}`, { headers });
      if (followersRes.ok) {
        const followersPayload = (await followersRes.json()) as { total?: number };
        if (typeof followersPayload.total === "number") {
          followersCount = followersPayload.total;
        }
      }
    } catch {
      // fallback
    }

    const streams = streamResponse.ok
      ? ((await streamResponse.json()) as {
          data?: Array<{ title?: string; game_name?: string; thumbnail_url?: string; viewer_count?: number }>;
        })
      : { data: [] };
    const stream = streams.data?.[0];
    const liveBanner = stream?.thumbnail_url?.replace("{width}", "1280").replace("{height}", "720") ?? "";
    const fallbackBio = stream?.title
      ? `${stream.game_name ? `${stream.game_name} · ` : ""}${stream.title}`
      : "";
    return {
      name: user.display_name,
      handle: `@${user.login}`,
      bio: user.description || fallbackBio,
      avatar: user.profile_image_url ?? "",
      banner: liveBanner || user.offline_image_url || "",
      status: stream ? "live" : "offline",
      followers: followersCount > 0 ? followersCount : undefined,
      viewerCount: stream?.viewer_count ?? 0,
      gameName: stream?.game_name ?? "",
      streamTitle: stream?.title ?? "",
      platform: "Twitch",
    };
  });

export const refreshTwitchStatuses = createServerFn({ method: "POST" })
  .validator(refreshInput)
  .handler(async ({ data }) => {
    const valid = data.channels.flatMap((channel) => {
      try { return [{ ...channel, login: twitchLogin(channel.channelUrl).toLowerCase() }]; } catch { return []; }
    });
    if (!valid.length) return [];
    const { clientId, token } = await getAppToken();
    const query = valid.map((channel) => `user_login=${encodeURIComponent(channel.login)}`).join("&");
    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token}` };
    const [response, usersResponse] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/streams?${query}`, { headers }),
      fetch(`https://api.twitch.tv/helix/users?${valid.map((channel) => `login=${encodeURIComponent(channel.login)}`).join("&")}`, { headers }),
    ]);
    if (!response.ok) throw new Error("Twitch live-status lookup failed");
    const payload = (await response.json()) as {
      data?: Array<{
        user_login: string;
        thumbnail_url?: string;
        viewer_count?: number;
        game_name?: string;
        title?: string;
      }>;
    };
    const users = usersResponse.ok
      ? ((await usersResponse.json()) as {
          data?: Array<{
            id: string;
            login: string;
            offline_image_url?: string;
            profile_image_url?: string;
            description?: string;
          }>;
        })
      : { data: [] };

    // Fetch real follower counts for each creator via Helix followers endpoint
    const followersMap = new Map<string, number>();
    await Promise.all(
      (users.data ?? []).map(async (u) => {
        try {
          const followersRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(u.id)}`, { headers });
          if (followersRes.ok) {
            const fData = (await followersRes.json()) as { total?: number };
            if (typeof fData.total === "number") {
              followersMap.set(u.login.toLowerCase(), fData.total);
            }
          }
        } catch {
          // ignore
        }
      })
    );

    const live = new Set((payload.data ?? []).map((stream) => stream.user_login.toLowerCase()));
    const streamByLogin = new Map((payload.data ?? []).map((stream) => [stream.user_login.toLowerCase(), stream]));
    const userByLogin = new Map((users.data ?? []).map((user) => [user.login.toLowerCase(), user]));

    return valid.map((channel) => {
      const stream = streamByLogin.get(channel.login);
      const user = userByLogin.get(channel.login);
      const isLive = live.has(channel.login);
      const liveBanner = stream?.thumbnail_url?.replace("{width}", "1280").replace("{height}", "720");
      const streamTitle = stream?.title || "";
      const gameName = stream?.game_name || "";
      const viewerCount = stream?.viewer_count || 0;
      const realFollowers = followersMap.get(channel.login);

      return {
        id: channel.id,
        status: isLive ? ("live" as const) : ("offline" as const),
        banner: liveBanner || user?.offline_image_url || "",
        avatar: user?.profile_image_url || "",
        bio: isLive
          ? `${gameName ? `${gameName} · ` : ""}${streamTitle || user?.description || ""}`
          : user?.description || "",
        gameName,
        viewerCount,
        title: streamTitle,
        followers: realFollowers,
      };
    });
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
