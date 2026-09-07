import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ channelUrl: z.string().trim().min(1).max(300) });
const refreshKickInput = z.object({
  channels: z.array(
    z.object({
      id: z.string(),
      channelUrl: z.string().url(),
      followers: z.number().int().nonnegative().optional(),
    })
  ).max(100),
});

export type KickSocial = {
  platform: string;
  url: string;
  label: string;
};

export type KickChannelData = {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  banner: string;
  status: "live" | "offline";
  followers?: number;
  viewerCount?: number;
  gameName?: string;
  streamTitle?: string;
  platform: "Kick";
  socials?: KickSocial[];
};

export const DEFAULT_KICK_CLIENT_ID = "01M1X8K591PXPRCREY7HS3F6S2";
export const DEFAULT_KICK_CLIENT_SECRET = "fdc44f9b127ec547fe499b2b2ce9f4a7e45f3207eff3fc81a8ace4c90e1b81d2";

let cachedKickToken: { token: string; expiresAt: number } | null = null;

export async function getKickAppToken(): Promise<string | null> {
  const clientId = process.env["KICK_CLIENT_ID"] || DEFAULT_KICK_CLIENT_ID;
  const clientSecret = process.env["KICK_CLIENT_SECRET"] || DEFAULT_KICK_CLIENT_SECRET;

  if (cachedKickToken && cachedKickToken.expiresAt > Date.now() + 60_000) {
    return cachedKickToken.token;
  }

  try {
    const res = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      console.warn("Kick OAuth token request returned status", res.status);
      return null;
    }

    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;

    cachedKickToken = {
      token: json.access_token,
      expiresAt: Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000,
    };
    return json.access_token;
  } catch (err) {
    console.error("Kick OAuth token exchange failed:", err);
    return null;
  }
}

export function extractKickSlug(channelUrl: string): string {
  try {
    const url = new URL(channelUrl.trim());
    if (!/(^|\.)kick\.com$/i.test(url.hostname)) {
      throw new Error("Use a kick.com channel URL");
    }
    const slug = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
    if (!slug) throw new Error("Add a Kick channel name to the URL");
    return slug.toLowerCase();
  } catch (err) {
    if (err instanceof Error && err.message.includes("Kick channel")) throw err;
    const clean = channelUrl
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/^kick\.com\/?/i, "")
      .split("/")[0]
      ?.replace(/^@/, "");
    if (clean) return clean.toLowerCase();
    throw new Error("Enter a valid Kick channel URL or username");
  }
}

export async function fetchKickOfficialChannel(slug: string, token: string): Promise<KickChannelData | null> {
  try {
    const channelRes = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!channelRes.ok) return null;
    const channelJson = await channelRes.json();
    const item = channelJson?.data?.[0];
    if (!item) return null;

    let displayName = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    let avatarUrl = "";

    if (item.broadcaster_user_id) {
      try {
        const userRes = await fetch(`https://api.kick.com/public/v1/users?id=${item.broadcaster_user_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5000),
        });
        if (userRes.ok) {
          const userJson = await userRes.json();
          const u = userJson?.data?.[0];
          if (u?.name) displayName = u.name;
          if (u?.profile_picture) avatarUrl = u.profile_picture;
        }
      } catch {
        // ignore user fetch error
      }
    }

    const stream = item.stream;
    const isLive = Boolean(stream && stream.is_live);
    const bannerUrl = (isLive && stream?.thumbnail) ? stream.thumbnail : (item.banner_picture || "");

    return {
      name: displayName,
      handle: `@${item.slug || slug}`,
      bio: item.channel_description || "",
      avatar: avatarUrl,
      banner: bannerUrl,
      status: isLive ? "live" : "offline",
      followers: typeof item.active_subscribers_count === "number" ? item.active_subscribers_count : undefined,
      viewerCount: isLive ? (stream?.viewer_count ?? 0) : 0,
      gameName: item.category?.name || "",
      streamTitle: item.stream_title || "",
      platform: "Kick",
      socials: [],
    };
  } catch (err) {
    console.error(`Kick official API channel fetch error for ${slug}:`, err);
    return null;
  }
}

export const getKickChannel = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }): Promise<KickChannelData> => {
    const slug = extractKickSlug(data.channelUrl);
    const fallback: KickChannelData = {
      name: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      handle: `@${slug}`,
      bio: "",
      avatar: "",
      banner: "",
      status: "offline",
      platform: "Kick",
      followers: 0,
      viewerCount: 0,
      gameName: "",
      streamTitle: "",
      socials: [],
    };

    // 1. Official Kick Public API with developer token
    const token = await getKickAppToken();
    if (token) {
      const officialData = await fetchKickOfficialChannel(slug, token);
      if (officialData) {
        return officialData;
      }
    }

    // 2. Fallback to v2 web endpoint if official token failed
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      };
      const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const json = await response.json();
        const user = json?.user;
        const bannerUrl =
          json?.banner_image?.url ||
          json?.offline_banner_image?.url ||
          json?.banner_image ||
          "";
        const avatarUrl = user?.profile_pic || "";
        const isLive = Boolean(json?.livestream);
        const livestream = json?.livestream;

        return {
          name: user?.username || fallback.name,
          handle: `@${json.slug || slug}`,
          bio: user?.bio || "",
          avatar: avatarUrl,
          banner: bannerUrl,
          status: isLive ? "live" : "offline",
          followers: typeof json?.followers_count === "number" ? json.followers_count : undefined,
          viewerCount: livestream?.viewer_count ?? 0,
          gameName: livestream?.categories?.[0]?.name || "",
          streamTitle: livestream?.session_title || "",
          platform: "Kick",
          socials: [],
        };
      }
    } catch {
      // ignore v2 fallback error
    }

    return fallback;
  });

export const refreshKickStatuses = createServerFn({ method: "POST" })
  .validator(refreshKickInput)
  .handler(async ({ data }) => {
    const token = await getKickAppToken();
    if (!token) return [];

    const updates: Array<{
      id: string;
      status: "live" | "offline";
      banner: string;
      avatar: string;
      bio: string;
      viewerCount: number;
      gameName: string;
      gameImage: string;
      title: string;
      followers?: number;
    }> = [];

    await Promise.all(
      data.channels.map(async (ch) => {
        try {
          const slug = extractKickSlug(ch.channelUrl);
          const channel = await fetchKickOfficialChannel(slug, token);
          if (channel) {
            updates.push({
              id: ch.id,
              status: channel.status,
              banner: channel.banner,
              avatar: channel.avatar,
              bio: channel.bio,
              viewerCount: channel.viewerCount || 0,
              gameName: channel.gameName || "",
              gameImage: "",
              title: channel.streamTitle || "",
              followers: channel.followers ?? ch.followers,
            });
          }
        } catch {
          // ignore individual error
        }
      })
    );

    return updates;
  });

export const testKickConnection = createServerFn({ method: "POST" }).handler(async () => {
  const token = await getKickAppToken();
  if (!token) {
    return { ok: false, message: "Could not authenticate with Kick Developer API. Check your Client ID & Secret." };
  }
  const testChannel = await fetchKickOfficialChannel("xqc", token);
  if (!testChannel) {
    return { ok: false, message: "Connected to Kick OAuth, but channel lookup failed." };
  }
  return {
    ok: true,
    message: `Connected to Kick Developer API! Successfully resolved @${testChannel.handle} (${testChannel.name}).`,
    channel: testChannel,
  };
});
