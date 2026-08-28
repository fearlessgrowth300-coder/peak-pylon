export type StickerCategory = "custom" | "streamer" | "anime" | "gaming" | "memes";

export interface CommunitySticker {
  id: string;
  name: string;
  url: string;
  category: StickerCategory;
  animated?: boolean;
}

export const COMMUNITY_STICKERS: CommunitySticker[] = [
  // Streamer Emotes & Hype
  {
    id: "st-pepe-hype",
    name: "Pepe Hype",
    url: "https://cdn3.emoji.gg/emojis/8687_pepe_hype.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-pogchamp",
    name: "PogChamp",
    url: "https://cdn3.emoji.gg/emojis/8276_Pog.png",
    category: "streamer",
  },
  {
    id: "st-kekw",
    name: "KEKW",
    url: "https://cdn3.emoji.gg/emojis/9623_KEKW.png",
    category: "streamer",
  },
  {
    id: "st-cat-vibe",
    name: "Cat Vibing",
    url: "https://cdn3.emoji.gg/emojis/3636_CatVibe.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-gigachad",
    name: "Gigachad",
    url: "https://cdn3.emoji.gg/emojis/3651-gigachad.png",
    category: "streamer",
  },
  {
    id: "st-popcat",
    name: "Pop Cat",
    url: "https://cdn3.emoji.gg/emojis/5549-popcat.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-monkas",
    name: "MonkaS",
    url: "https://cdn3.emoji.gg/emojis/3472_monkaS.png",
    category: "streamer",
  },
  {
    id: "st-pepe-jam",
    name: "Pepe Jam",
    url: "https://cdn3.emoji.gg/emojis/2625_pepe_jam.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-ez",
    name: "EZ Clap",
    url: "https://cdn3.emoji.gg/emojis/5578_EZ.png",
    category: "streamer",
  },
  {
    id: "st-kappa",
    name: "Kappa",
    url: "https://cdn3.emoji.gg/emojis/5969_Kappa.png",
    category: "streamer",
  },

  // Anime & Chibi Reactions
  {
    id: "st-anya-heh",
    name: "Anya Heh",
    url: "https://cdn3.emoji.gg/emojis/7697-anya-smug.png",
    category: "anime",
  },
  {
    id: "st-tohru-wave",
    name: "Tohru Dragon",
    url: "https://cdn3.emoji.gg/emojis/5438_dragon_maid_wave.png",
    category: "anime",
  },
  {
    id: "st-chika-dance",
    name: "Chika Dance",
    url: "https://cdn3.emoji.gg/emojis/7918_chika_dance.gif",
    category: "anime",
    animated: true,
  },
  {
    id: "st-nezuko-run",
    name: "Nezuko Running",
    url: "https://cdn3.emoji.gg/emojis/9059_nezuko_run.gif",
    category: "anime",
    animated: true,
  },
  {
    id: "st-anime-wow",
    name: "Anime Sparkle Wow",
    url: "https://cdn3.emoji.gg/emojis/8472-anime-sparkle.png",
    category: "anime",
  },
  {
    id: "st-genshin-paimon",
    name: "Paimon Shocked",
    url: "https://cdn3.emoji.gg/emojis/8580-paimon-shock.png",
    category: "anime",
  },
  {
    id: "st-anime-cry",
    name: "Anime Cry Tears",
    url: "https://cdn3.emoji.gg/emojis/4638-anime-crying.png",
    category: "anime",
  },

  // Gaming & Memes
  {
    id: "st-w-stream",
    name: "W Stream",
    url: "https://cdn3.emoji.gg/emojis/7281_W.png",
    category: "gaming",
  },
  {
    id: "st-l-stream",
    name: "L Stream",
    url: "https://cdn3.emoji.gg/emojis/4759_L.png",
    category: "gaming",
  },
  {
    id: "st-gg",
    name: "GG WP",
    url: "https://cdn3.emoji.gg/emojis/8724-gg.png",
    category: "gaming",
  },
  {
    id: "st-headshot",
    name: "Headshot Fire",
    url: "https://cdn3.emoji.gg/emojis/9520-headshot.png",
    category: "gaming",
  },
  {
    id: "st-victory",
    name: "Victory Crown",
    url: "https://cdn3.emoji.gg/emojis/4412-victory-crown.png",
    category: "gaming",
  },
  {
    id: "st-rip-skull",
    name: "RIP Skull",
    url: "https://cdn3.emoji.gg/emojis/6211-rip-skull.png",
    category: "gaming",
  },
  {
    id: "st-hype-train",
    name: "Hype Train",
    url: "https://cdn3.emoji.gg/emojis/4120-hype-train.gif",
    category: "gaming",
    animated: true,
  },
];

const STORAGE_KEY = "streamcore:custom-stickers";

export function getCustomStickers(): CommunitySticker[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSticker(name: string, url: string): CommunitySticker {
  const existing = getCustomStickers();
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newSticker: CommunitySticker = {
    id,
    name: name.trim() || "Custom Sticker",
    url: url.trim(),
    category: "custom",
    animated: url.endsWith(".gif"),
  };
  const updated = [newSticker, ...existing.filter((s) => s.url !== url)];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return newSticker;
}

export function removeCustomSticker(id: string): void {
  const existing = getCustomStickers();
  const updated = existing.filter((s) => s.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}

export function isStickerSaved(url: string): boolean {
  const existing = getCustomStickers();
  return existing.some((s) => s.url === url);
}
