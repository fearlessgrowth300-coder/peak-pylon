import type { Member, Post } from "./community";

export type CategoryTab = "top" | "rising" | "creators" | "discussed";

export type CategoryInsight = {
  id: string;
  name: string;
  emoji: string;
  boxArtUrl: string;
  creatorsLive: number;
  totalViewers: number;
  growthRate: number;
  discussionCount: number;
  score: number;
  aiTrend: { badge: string; summary: string; color: string };
};

const KNOWN_TWITCH_CATEGORIES: Record<string, { emoji: string; boxArt: string }> = {
  "Just Chatting": { emoji: "💬", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg" },
  "Valorant": { emoji: "🎯", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg" },
  "Grand Theft Auto V": { emoji: "🏎️", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/32982-285x380.jpg" },
  "Fortnite": { emoji: "🔥", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg" },
  "Music": { emoji: "🎵", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/26936-285x380.jpg" },
  "Apex Legends": { emoji: "🏆", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/511224-285x380.jpg" },
  "Minecraft": { emoji: "⛏️", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg" },
  "League of Legends": { emoji: "⚔️", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg" },
  "IRL": { emoji: "🏝️", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg" },
  "Art": { emoji: "🎨", boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/509660-285x380.jpg" },
};

function inferCategory(member: Member) {
  if (member.gameName?.trim()) return member.gameName.trim();
  const text = `${member.bio || ""} ${member.streamTitle || ""}`.toLowerCase();
  return Object.keys(KNOWN_TWITCH_CATEGORIES).find((name) => text.includes(name.toLowerCase())) || "";
}

export function aggregateTopCategories(members: Member[], posts: Post[], tab: CategoryTab = "top"): CategoryInsight[] {
  const map = new Map<string, { creatorsLive: number; totalViewers: number; discussionCount: number }>();

  for (const member of members) {
    const name = inferCategory(member);
    if (!name) continue;
    const current = map.get(name) ?? { creatorsLive: 0, totalViewers: 0, discussionCount: 0 };
    if (member.status === "live") {
      current.creatorsLive += 1;
      current.totalViewers += member.viewerCount ?? 0;
    }
    map.set(name, current);
  }

  for (const post of posts) {
    const text = post.text.toLowerCase();
    for (const [name, current] of map) {
      if (!text.includes(name.toLowerCase())) continue;
      current.discussionCount += 1 + (post.comments?.length ?? 0);
    }
  }

  const insights = [...map.entries()].map(([name, data]) => {
    const metadata = KNOWN_TWITCH_CATEGORIES[name] ?? {
      emoji: "🎮",
      boxArt: "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg",
    };
    const score = data.totalViewers + data.creatorsLive * 100 + data.discussionCount * 10;
    return {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      emoji: metadata.emoji,
      boxArtUrl: metadata.boxArt,
      creatorsLive: data.creatorsLive,
      totalViewers: data.totalViewers,
      growthRate: 0,
      discussionCount: data.discussionCount,
      score,
      aiTrend: {
        badge: data.creatorsLive ? "Live category" : "Community category",
        summary: `${data.creatorsLive} connected creator${data.creatorsLive === 1 ? "" : "s"} live with ${data.totalViewers.toLocaleString()} current viewers and ${data.discussionCount} recorded discussions.`,
        color: "bg-primary/20 text-primary border-primary/40",
      },
    };
  });

  insights.sort((left, right) => {
    if (tab === "creators") return right.creatorsLive - left.creatorsLive;
    if (tab === "discussed") return right.discussionCount - left.discussionCount;
    return right.score - left.score;
  });
  return insights;
}
