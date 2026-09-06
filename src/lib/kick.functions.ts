import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ channelUrl: z.string().url() });

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
    const clean = channelUrl.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/^kick\.com\/?/i, "").split("/")[0]?.replace(/^@/, "");
    if (clean) return clean.toLowerCase();
    throw new Error("Enter a valid Kick channel URL or username");
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

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    };

    try {
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

        const socials: KickSocial[] = [];
        if (user?.twitter) {
          socials.push({
            platform: "X",
            label: `@${user.twitter.replace(/^@/, "")}`,
            url: `https://x.com/${user.twitter.replace(/^@/, "")}`,
          });
        }
        if (user?.instagram) {
          const igHandle = user.instagram.replace(/\/$/, "").split("/").pop() || user.instagram;
          socials.push({
            platform: "Instagram",
            label: `@${igHandle.replace(/^@/, "")}`,
            url: `https://instagram.com/${igHandle.replace(/^@/, "")}`,
          });
        }
        if (user?.youtube) {
          const ytUrl = user.youtube.startsWith("http")
            ? user.youtube
            : `https://youtube.com/${user.youtube}`;
          socials.push({
            platform: "YouTube",
            label: "YouTube",
            url: ytUrl,
          });
        }
        if (user?.discord) {
          const dcUrl = user.discord.startsWith("http")
            ? user.discord
            : `https://discord.gg/${user.discord}`;
          socials.push({
            platform: "Discord",
            label: "Discord",
            url: dcUrl,
          });
        }
        if (user?.tiktok) {
          const ttHandle = user.tiktok.replace(/^@/, "");
          socials.push({
            platform: "TikTok",
            label: `@${ttHandle}`,
            url: `https://tiktok.com/@${ttHandle}`,
          });
        }

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
          socials,
        };
      }
    } catch (e) {
      console.warn(`Kick v2 channel fetch failed for ${slug}:`, e);
    }

    try {
      const responseV1 = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(slug)}`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      if (responseV1.ok) {
        const json1 = await responseV1.json();
        const user = json1?.user;
        return {
          ...fallback,
          name: user?.username || fallback.name,
          handle: `@${json1.slug || slug}`,
          bio: user?.bio || "",
          avatar: user?.profile_pic || "",
          banner: json1?.banner_image?.url || "",
          status: json1?.livestream ? "live" : "offline",
          followers: json1?.followersCount || undefined,
        };
      }
    } catch {
      // ignore
    }

    return fallback;
  });
