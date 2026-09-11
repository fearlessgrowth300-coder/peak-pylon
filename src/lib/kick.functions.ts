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
const beginKickInput = z.object({ codeChallenge: z.string().min(43).max(128) });
const completeKickInput = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(43).max(128),
  accessToken: z.string().min(20),
  expectedSlug: z.string().max(25).optional(),
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

let cachedKickToken: { token: string; expiresAt: number } | null = null;

function kickRedirectUri() {
  return process.env["KICK_REDIRECT_URI"] || "https://peak-pylon.vercel.app/kick/callback";
}

export async function getKickAppToken(): Promise<string | null> {
  const clientId = process.env["KICK_CLIENT_ID"];
  const clientSecret = process.env["KICK_CLIENT_SECRET"];

  if (!clientId || !clientSecret) return null;

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

export const beginKickAuthorization = createServerFn({ method: "POST" })
  .validator(beginKickInput)
  .handler(async ({ data }) => {
    const clientId = process.env["KICK_CLIENT_ID"];
    if (!clientId) throw new Error("Kick OAuth is not configured yet. Add KICK_CLIENT_ID to the deployment environment.");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: kickRedirectUri(),
      scope: "user:read channel:read",
      code_challenge: data.codeChallenge,
      code_challenge_method: "S256",
    });
    return { url: `https://id.kick.com/oauth/authorize?${params}` };
  });

export const completeKickAuthorization = createServerFn({ method: "POST" })
  .validator(completeKickInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Your StreamCore session has expired. Please sign in again.");

    const db = supabaseAdmin as any;
    const { data: currentProfile, error: profileReadError } = await db
      .from("profiles")
      .select("rules_acknowledged, twitch_verified, platform, channel_url, social_links")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileReadError) throw profileReadError;
    if (!currentProfile?.rules_acknowledged) throw new Error("Accept the StreamCore community rules before connecting Kick.");

    const clientId = process.env["KICK_CLIENT_ID"];
    const clientSecret = process.env["KICK_CLIENT_SECRET"];
    if (!clientId || !clientSecret) throw new Error("Kick OAuth credentials are not configured.");

    const tokenResponse = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: kickRedirectUri(),
        code_verifier: data.codeVerifier,
        code: data.code,
      }),
    });
    if (!tokenResponse.ok) throw new Error("Kick authorization could not be completed.");
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Kick did not return an access token.");

    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" };
    const [channelResponse, userResponse] = await Promise.all([
      fetch("https://api.kick.com/public/v1/channels", { headers }),
      fetch("https://api.kick.com/public/v1/users", { headers }),
    ]);
    if (!channelResponse.ok) throw new Error("Kick did not return the authorized channel.");
    const channelPayload = await channelResponse.json();
    const channel = channelPayload?.data?.[0];
    if (!channel?.slug || !channel?.broadcaster_user_id) throw new Error("No Kick creator channel is attached to this account.");
    const userPayload = userResponse.ok ? await userResponse.json() : { data: [] };
    const kickUser = userPayload?.data?.[0];
    const slug = String(channel.slug).toLowerCase();
    const expectedSlug = (data.expectedSlug || "").trim().replace(/^@/, "").toLowerCase();
    if (expectedSlug && expectedSlug !== slug) {
      throw new Error(`You authorized @${slug}, but entered @${expectedSlug}. Sign in to the matching Kick account.`);
    }

    const stream = channel.stream;
    const isLive = Boolean(stream?.is_live);
    const kickUrl = `https://kick.com/${slug}`;
    const kickLink = {
      platform: "Kick",
      label: `@${slug}`,
      url: kickUrl,
      verified: true,
      provider: "kick",
      providerIdentityId: String(channel.broadcaster_user_id),
    };
    const currentLinks = Array.isArray(currentProfile.social_links) ? currentProfile.social_links : [];
    const socialLinks = [...currentLinks.filter((link: { platform?: string }) => link.platform !== "Kick"), kickLink];
    const connectedAt = new Date().toISOString();
    const sharedPatch = {
      channel_authorized: true,
      kick_verified: true,
      kick_user_id: String(channel.broadcaster_user_id),
      kick_authorized_at: connectedAt,
      social_links: socialLinks,
    };
    const profile = currentProfile.twitch_verified
      ? sharedPatch
      : {
          ...sharedPatch,
          display_name: String(kickUser?.name || slug),
          handle: `@${slug}`,
          bio: String(channel.channel_description || ""),
          avatar_url: String(kickUser?.profile_picture || ""),
          banner_url: String(stream?.thumbnail || channel.banner_picture || ""),
          platform: "Kick",
          channel_url: kickUrl,
          status: isLive ? "live" : "offline",
        };

    const { error: profileError } = await db.from("profiles").update(profile).eq("id", authData.user.id);
    if (profileError) throw profileError;
    return { profile, channel: { slug, url: kickUrl }, emailStatus: "not_configured" };
  });

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
