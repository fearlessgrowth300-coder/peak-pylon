export type StickerCategory = "custom" | "streamer" | "anime" | "gaming" | "memes";

export interface CommunitySticker {
  id: string;
  name: string;
  url: string;
  category: StickerCategory;
  animated?: boolean;
}

export const COMMUNITY_STICKERS: CommunitySticker[] = [
  {
    "id": "st-cat-vibe",
    "name": "Cat Jam Vibing",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif"
  },
  {
    "id": "st-pepe-hype",
    "name": "Pepe Hype",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif"
  },
  {
    "id": "st-party-dance",
    "name": "Party Dance",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif"
  },
  {
    "id": "st-confetti-celebrate",
    "name": "Confetti Celebrate",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif"
  },
  {
    "id": "st-thumbs-up",
    "name": "Thumbs Up Streamer",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/l41YkxvU8c7J7Bba0/giphy.gif"
  },
  {
    "id": "st-clapping-hype",
    "name": "Clapping Hype",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif"
  },
  {
    "id": "st-fire-flame",
    "name": "Fire Flame",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/ibolLe3mOqHE3PQTtk/giphy.gif"
  },
  {
    "id": "st-sunglasses-cool",
    "name": "Cool Glasses",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif"
  },
  {
    "id": "st-pixel-heart",
    "name": "Pixel Love",
    "category": "anime",
    "animated": true,
    "url": "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif"
  },
  {
    "id": "st-sparkle-anime",
    "name": "Anime Magic",
    "category": "anime",
    "animated": true,
    "url": "https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif"
  },
  {
    "id": "st-fire-burst",
    "name": "Mega Fire",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif"
  },
  {
    "id": "st-stream-wave",
    "name": "Hello Stream",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif"
  },
  {
    "id": "st-dance-cat",
    "name": "Dancing Cat",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif"
  },
  {
    "id": "st-cheers-leo",
    "name": "Cheers Toast",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif"
  },
  {
    "id": "st-great-success",
    "name": "Great Success",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/Od0QRnzwRBYmDU3eEO/giphy.gif"
  },
  {
    "id": "st-mind-blown-gif",
    "name": "Mind Explode",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif"
  },
  {
    "id": "st-kawaii-cute",
    "name": "Kawaii Sparkle",
    "category": "anime",
    "animated": true,
    "url": "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif"
  },
  {
    "id": "st-shocked-omg",
    "name": "OMG Shocked",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif"
  },
  {
    "id": "st-disco-dance",
    "name": "Disco Hype",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/26gsjCZpPolPr3sBy/giphy.gif"
  },
  {
    "id": "st-blinking-guy",
    "name": "Blinking Guy",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif"
  },
  {
    "id": "st-bye-wave",
    "name": "Wave Goodbye",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif"
  },
  {
    "id": "st-gg-gaming-gif",
    "name": "GG WP Gamer",
    "category": "gaming",
    "animated": true,
    "url": "https://media.giphy.com/media/d2Z4NRCUxsxZBvag/giphy.gif"
  },
  {
    "id": "st-popcorn-drama",
    "name": "Eating Popcorn",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif"
  },
  {
    "id": "st-pepe-dance",
    "name": "Pepe Dance",
    "category": "streamer",
    "animated": true,
    "url": "https://media.giphy.com/media/juNm2fVzTcLp27o4uP/giphy.gif"
  },
  {
    "id": "st-sad-cat",
    "name": "Sadge Cat",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif"
  },
  {
    "id": "st-side-eye-dog",
    "name": "Side Eye Dog",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/ule4akeXnY9Mb4kDuw/giphy.gif"
  },
  {
    "id": "st-doge-nod",
    "name": "Doge Nod",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/Lq0h93752f6J9tijrh/giphy.gif"
  },
  {
    "id": "st-drake-point",
    "name": "Drake Approve",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/26FPy3QZQqGtDcrJa/giphy.gif"
  },
  {
    "id": "st-roll-safe",
    "name": "Big Brain",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/l3q2wnlwbmJmvg704/giphy.gif"
  },
  {
    "id": "st-smart-tap",
    "name": "Smart Thinker",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif"
  },
  {
    "id": "st-grumpy-cat",
    "name": "Grumpy Mood",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/6gLyEFrDe5XZC/giphy.gif"
  },
  {
    "id": "st-excited-dog",
    "name": "Hyped Pup",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/fAnEC88LccN7a/giphy.gif"
  },
  {
    "id": "st-nice-meme",
    "name": "Noiceee",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/10uEX5kfeodYgo/giphy.gif"
  },
  {
    "id": "st-fine-fire",
    "name": "This Is Fine",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/kyLYXonQYYfwYDIeZl/giphy.gif"
  },
  {
    "id": "st-spiderman-point",
    "name": "Spiderman Point",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/B2l0NnxK9KiVa/giphy.gif"
  },
  {
    "id": "st-deal-with-it",
    "name": "Deal With It",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/xUPGcl3ijl0vAEyIDK/giphy.gif"
  },
  {
    "id": "st-shrek-dance",
    "name": "Shrek Hype",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif"
  },
  {
    "id": "st-shaq-shimmy",
    "name": "Shaq Shimmy",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/9xt1MUZqkneKDinpby/giphy.gif"
  },
  {
    "id": "st-spongebob-mock",
    "name": "Sponge Mock",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/l2JdTa0yVuHBpzIE8/giphy.gif"
  },
  {
    "id": "st-chipmunk-gasp",
    "name": "Dramatic Look",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/14ut8PhnIwzros/giphy.gif"
  },
  {
    "id": "st-rick-astley",
    "name": "Rick Roll Groove",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/DhstvI455Y0sE/giphy.gif"
  },
  {
    "id": "st-confused-john",
    "name": "Confused Where",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif"
  },
  {
    "id": "st-victory-swag",
    "name": "Victory Swag",
    "category": "gaming",
    "animated": true,
    "url": "https://media.giphy.com/media/26AHPxxnSw1L9T1rW/giphy.gif"
  },
  {
    "id": "st-excited-cat",
    "name": "Cat Hype OMG",
    "category": "anime",
    "animated": true,
    "url": "https://media.giphy.com/media/xTiTnqUxyWbsAXq7Ju/giphy.gif"
  },
  {
    "id": "st-salt-bae",
    "name": "Seasoning King",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif"
  },
  {
    "id": "st-laugh-hard",
    "name": "LMAOOO Died",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif"
  },
  {
    "id": "st-homer-hedge",
    "name": "Disappear Homer",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/jUwpNzg9IcyrK/giphy.gif"
  },
  {
    "id": "st-gosling-laugh",
    "name": "Gigachad Laugh",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/l3q2tzon8PJJCTTem/giphy.gif"
  },
  {
    "id": "st-mind-universe",
    "name": "Universe Brain",
    "category": "memes",
    "animated": true,
    "url": "https://media.giphy.com/media/3o7TKrEzvLbsVAud8I/giphy.gif"
  },
  {
    "id": "st-fire-vector",
    "name": "Fire Lit",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f525.svg",
    "category": "memes"
  },
  {
    "id": "st-rocket",
    "name": "Rocket To The Moon",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f680.svg",
    "category": "gaming"
  },
  {
    "id": "st-100",
    "name": "100 Percent",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4af.svg",
    "category": "memes"
  },
  {
    "id": "st-crown",
    "name": "Crown King",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f451.svg",
    "category": "streamer"
  },
  {
    "id": "st-mind-blown",
    "name": "Mind Blown",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f92f.svg",
    "category": "memes"
  },
  {
    "id": "st-star-struck",
    "name": "Star Struck",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f929.svg",
    "category": "anime"
  },
  {
    "id": "st-laugh-tears",
    "name": "LMAO Tears",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f602.svg",
    "category": "memes"
  },
  {
    "id": "st-party-face",
    "name": "Party Popper",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f973.svg",
    "category": "streamer"
  },
  {
    "id": "st-gamepad",
    "name": "Gaming Pad",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3ae.svg",
    "category": "gaming"
  },
  {
    "id": "st-trophy",
    "name": "Victory Trophy",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3c6.svg",
    "category": "gaming"
  },
  {
    "id": "st-diamond",
    "name": "Diamond Partner",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f48e.svg",
    "category": "streamer"
  },
  {
    "id": "st-muscle",
    "name": "Flex Strong",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4aa.svg",
    "category": "memes"
  },
  {
    "id": "st-sparkles",
    "name": "Sparkles Glow",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2728.svg",
    "category": "anime"
  },
  {
    "id": "st-headphones",
    "name": "Stream Audio",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3a7.svg",
    "category": "streamer"
  },
  {
    "id": "st-joystick",
    "name": "Arcade Joystick",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f579.svg",
    "category": "gaming"
  },
  {
    "id": "st-lightning",
    "name": "High Voltage",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a1.svg",
    "category": "gaming"
  },
  {
    "id": "st-crystal-ball",
    "name": "Crystal Ball",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f52e.svg",
    "category": "anime"
  },
  {
    "id": "st-live-camera",
    "name": "Movie Camera",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3a5.svg",
    "category": "streamer"
  },
  {
    "id": "st-megaphone",
    "name": "Megaphone Hype",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4e2.svg",
    "category": "streamer"
  },
  {
    "id": "st-money-bag",
    "name": "Donation Bag",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4b0.svg",
    "category": "streamer"
  },
  {
    "id": "st-glowing-star",
    "name": "Star Creator",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f31f.svg",
    "category": "streamer"
  },
  {
    "id": "st-rainbow",
    "name": "Rainbow Vibe",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f308.svg",
    "category": "memes"
  },
  {
    "id": "st-target-dart",
    "name": "Bullseye 100",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3af.svg",
    "category": "gaming"
  },
  {
    "id": "st-heart-fire",
    "name": "Heart on Fire",
    "url": "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2764.svg",
    "category": "streamer"
  }
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
  const id = "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const newSticker: CommunitySticker = {
    id,
    name: name.trim() || "Custom Sticker",
    url: url.trim(),
    category: "custom",
    animated: url.endsWith(".gif") || url.includes("giphy.com"),
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
