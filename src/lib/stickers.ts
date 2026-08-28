export type StickerCategory = "custom" | "streamer" | "anime" | "gaming" | "memes";

export interface CommunitySticker {
  id: string;
  name: string;
  url: string;
  category: StickerCategory;
  animated?: boolean;
}

export const COMMUNITY_STICKERS: CommunitySticker[] = [
  // Streamer Emotes & Hype (Animated GIFs)
  {
    id: "st-pepe-hype",
    name: "Pepe Hype",
    url: "https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-cat-vibe",
    name: "Cat Jam Vibing",
    url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-party-dance",
    name: "Party Dance",
    url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-hype-yay",
    name: "Stream Hype Yay",
    url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-confetti-celebrate",
    name: "Confetti Celebrate",
    url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-thumbs-up",
    name: "Thumbs Up Streamer",
    url: "https://media.giphy.com/media/l41YkxvU8c7J7Bba0/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-clapping-hype",
    name: "Clapping Hype",
    url: "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-fire-flame",
    name: "Fire Flame",
    url: "https://media.giphy.com/media/ibolLe3mOqHE3PQTtk/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-sunglasses-cool",
    name: "Cool Glasses",
    url: "https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif",
    category: "streamer",
    animated: true,
  },

  // Reaction Stickers (High-res Vector SVGs)
  {
    id: "st-fire-vector",
    name: "Fire Lit",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f525.svg",
    category: "memes",
  },
  {
    id: "st-rocket",
    name: "Rocket To The Moon",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f680.svg",
    category: "gaming",
  },
  {
    id: "st-100",
    name: "100 Percent",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4af.svg",
    category: "memes",
  },
  {
    id: "st-crown",
    name: "Crown King",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f451.svg",
    category: "streamer",
  },
  {
    id: "st-mind-blown",
    name: "Mind Blown",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f92f.svg",
    category: "memes",
  },
  {
    id: "st-star-struck",
    name: "Star Struck",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f929.svg",
    category: "anime",
  },
  {
    id: "st-laugh-tears",
    name: "LMAO Tears",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f602.svg",
    category: "memes",
  },
  {
    id: "st-party-face",
    name: "Party Popper",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f973.svg",
    category: "streamer",
  },
  {
    id: "st-gamepad",
    name: "Gaming Pad",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3ae.svg",
    category: "gaming",
  },
  {
    id: "st-trophy",
    name: "Victory Trophy",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3c6.svg",
    category: "gaming",
  },
  {
    id: "st-diamond",
    name: "Diamond Partner",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f48e.svg",
    category: "streamer",
  },
  {
    id: "st-muscle",
    name: "Flex Strong",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4aa.svg",
    category: "memes",
  },
  {
    id: "st-sparkles",
    name: "Sparkles Glow",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2728.svg",
    category: "anime",
  },
  {
    id: "st-headphones",
    name: "Stream Audio",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3a7.svg",
    category: "streamer",
  },
  {
    id: "st-pixel-heart",
    name: "Pixel Love",
    url: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif",
    category: "anime",
    animated: true,
  },
  {
    id: "st-sparkle-anime",
    name: "Anime Magic",
    url: "https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif",
    category: "anime",
    animated: true,
  },
  {
    id: "st-fire-burst",
    name: "Mega Fire",
    url: "https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif",
    category: "memes",
    animated: true,
  },
  {
    id: "st-stream-wave",
    name: "Hello Stream",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    category: "streamer",
    animated: true,
  },
  {
    id: "st-dance-cat",
    name: "Dancing Cat",
    url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
    category: "memes",
    animated: true,
  },
  {
    id: "st-joystick",
    name: "Arcade Joystick",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f579.svg",
    category: "gaming",
  },
  {
    id: "st-lightning",
    name: "High Voltage",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a1.svg",
    category: "gaming",
  },
  {
    id: "st-crystal-ball",
    name: "Crystal Ball",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f52e.svg",
    category: "anime",
  },
  {
    id: "st-live-camera",
    name: "Movie Camera",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3a5.svg",
    category: "streamer",
  },
  {
    id: "st-megaphone",
    name: "Megaphone Hype",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4e2.svg",
    category: "streamer",
  },
  {
    id: "st-money-bag",
    name: "Donation Bag",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4b0.svg",
    category: "streamer",
  },
  {
    id: "st-glowing-star",
    name: "Star Creator",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f31f.svg",
    category: "streamer",
  },
  {
    id: "st-rainbow",
    name: "Rainbow Vibe",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f308.svg",
    category: "memes",
  },
  {
    id: "st-target-dart",
    name: "Bullseye 100",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3af.svg",
    category: "gaming",
  },
  {
    id: "st-heart-fire",
    name: "Heart on Fire",
    url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2764.svg",
    category: "streamer",
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
