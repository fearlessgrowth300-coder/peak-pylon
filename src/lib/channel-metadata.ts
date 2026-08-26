export type ChannelMetadata = {
  platform: string;
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  banner: string;
};

const platformFor = (host: string) => {
  if (host.includes("twitch.tv")) return "Twitch";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
  if (host.includes("tiktok.com")) return "TikTok";
  if (host.includes("instagram.com")) return "Instagram";
  if (host.includes("spotify.com")) return "Spotify";
  if (host.includes("kick.com")) return "Kick";
  return "Other";
};

export async function getChannelMetadata(channelUrl: string): Promise<ChannelMetadata> {
  const url = new URL(channelUrl);
  const platform = platformFor(url.hostname.toLowerCase());
  const slug = url.pathname.split("/").filter(Boolean).at(-1)?.replace(/^@/, "") || url.hostname;
  const fallback: ChannelMetadata = {
    platform,
    name: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    handle: `@${slug}`,
    bio: "",
    avatar: "",
    banner: "",
  };

  try {
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url.href)}`);
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      author_url?: string;
      thumbnail_url?: string;
      description?: string;
    };
    const name = data.author_name || data.title || fallback.name;
    return {
      ...fallback,
      name: name.replace(/\s*[-|·]\s*(Twitch|YouTube|TikTok|Instagram|Spotify).*$/i, "") || fallback.name,
      handle: data.author_url?.split("/").filter(Boolean).at(-1)?.replace(/^@/, "")
        ? `@${data.author_url.split("/").filter(Boolean).at(-1)!.replace(/^@/, "")}`
        : fallback.handle,
      bio: data.description || "",
      avatar: data.thumbnail_url || "",
      banner: data.thumbnail_url || "",
    };
  } catch {
    return fallback;
  }
}
