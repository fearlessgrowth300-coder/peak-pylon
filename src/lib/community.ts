import { useCallback, useEffect, useState } from "react";

export type Status = "online" | "live" | "offline";

export type Member = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  status: Status;
  link: string;
  bio: string;
  avatar: string;
  banner: string;
  joined?: number | undefined;
};

export type Post = {
  id: string;
  authorId: string;
  text: string;
  image: string;
  video?: string | undefined;
  sticker?: string | undefined;
  replyToId?: string | undefined;
  time: number;
};

export type PostInput = {
  authorId: string;
  text: string;
  image?: string | undefined;
  video?: string | undefined;
  sticker?: string | undefined;
  replyToId?: string | undefined;
};

export type Stats = { members: string; online: string; rank: string };

export type State = { stats: Stats; members: Member[]; posts: Post[] };

const KEY = "streamcore-demo-v1";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function defaultState(): State {
  const m1 = uid();
  const m2 = uid();
  const m3 = uid();
  return {
    stats: { members: "42M", online: "1.6K", rank: "#3" },
    members: [
      {
        id: m1,
        name: "NovaRush",
        handle: "@novarush",
        platform: "Twitch",
        status: "live",
        link: "https://www.twitch.tv/",
        bio: "Competitive streamer, late-night energy, and community-first vibes.",
        avatar: "",
        banner: "",
        joined: Date.now() - 1000 * 60 * 60 * 24 * 400,
      },
      {
        id: m2,
        name: "PixelMaya",
        handle: "@pixelmaya",
        platform: "YouTube",
        status: "online",
        link: "https://www.youtube.com/",
        bio: "Variety creator sharing challenges, reactions, and creator tips.",
        avatar: "",
        banner: "",
        joined: Date.now() - 1000 * 60 * 60 * 24 * 400,
      },
      {
        id: m3,
        name: "KaiVertex",
        handle: "@kaivertex",
        platform: "Kick",
        status: "offline",
        link: "https://kick.com/",
        bio: "FPS, ranked grinds, clips, and creator collaborations.",
        avatar: "",
        banner: "",
        joined: Date.now() - 1000 * 60 * 60 * 24 * 400,
      },
    ],
    posts: [
      {
        id: uid(),
        authorId: m1,
        text: "Tonight we are spotlighting competitive creators. Drop into the creators directory and discover somebody new.",
        image: "",
        time: Date.now() - 1000 * 60 * 7,
      },
      {
        id: uid(),
        authorId: m2,
        text: "Creator tip: make your profile instantly understandable. One sentence for who you are, one for what you stream, one reason people should follow.",
        image: "",
        time: Date.now() - 1000 * 60 * 42,
      },
    ],
  };
}

export function useCommunity() {
  const [state, setState] = useState<State>(() => defaultState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw) as State);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const addMember = useCallback((member: Omit<Member, "id">) => {
    setState((s) => ({
      ...s,
      members: [{ joined: Date.now(), ...member, id: uid() }, ...s.members],
    }));
  }, []);

  const removeMember = useCallback((id: string) => {
    setState((s) =>
      s.members.length <= 1
        ? s
        : {
            ...s,
            members: s.members.filter((m) => m.id !== id),
            posts: s.posts.filter((p) => p.authorId !== id),
          },
    );
  }, []);

  const addPost = useCallback((input: PostInput) => {
    setState((s) => ({
      ...s,
      posts: [
        {
          ...input,
          id: uid(),
          image: input.image ?? "",
          time: Date.now(),
        },
        ...s.posts,
      ],
    }));
  }, []);

  const setStats = useCallback((stats: Stats) => {
    setState((s) => ({ ...s, stats }));
  }, []);

  return { state, hydrated, addMember, removeMember, addPost, setStats };
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SC"
  );
}

export function timeAgo(ts: number) {
  const m = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function readFileAsDataUrl(file: File | undefined | null): Promise<string> {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export const STICKERS = ["🔥", "😂", "🎉", "👑", "🎮", "💜", "🚀", "👀", "🏆", "🤝", "⚡", "😎"];

export function formatDate(ts: number | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
