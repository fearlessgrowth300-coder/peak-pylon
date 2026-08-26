import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Status = "online" | "live" | "offline";

export type Connection = {
  id: string;
  platform: string;
  label: string;
  url: string;
  verified: boolean;
};

export type Member = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  status: Status;
  manualStatus?: "online" | "offline" | undefined;
  link: string;
  bio: string;
  avatar: string;
  banner: string;
  joined?: number | undefined;
  real?: boolean | undefined;
  role?: string | undefined;
  connections?: Connection[] | undefined;
};

export type Post = {
  id: string;
  authorId: string;
  text: string;
  image: string;
  video?: string | undefined;
  sticker?: string | undefined;
  replyToId?: string | undefined;
  channel?: string | undefined;
  reactions?: Record<string, number> | undefined;
  time: number;
};

export type PostInput = {
  authorId: string;
  text: string;
  image?: string | undefined;
  video?: string | undefined;
  sticker?: string | undefined;
  replyToId?: string | undefined;
  channel?: string | undefined;
};

export type Stats = { members: string; online: string; rank: string };

export type Community = { name: string; logo: string; banner: string; tagline: string; rules: string };
export type CommunityChannel = { id: string; name: string; topic: string; type: "text" | "media" | "voice" | "announcement" | "testimony" | "social"; allowChat: boolean; createdAt: number };

export type State = {
  stats: Stats;
  community: Community;
  members: Member[];
  posts: Post[];
  channels: CommunityChannel[];
};

const KEY = "streamcore-demo-v1";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const defaultCommunity: Community = {
  name: "StreamCore",
  logo: "",
  banner: "",
  tagline: "The home of streamers",
  rules: "Respect every member.\nKeep posts relevant to the channel.\nNo spam, scams, or private information.\nUse creator profiles and live notifications honestly.",
};

export function defaultState(): State {
  const m1 = uid();
  const m2 = uid();
  const m3 = uid();
  return {
    stats: { members: "42M", online: "1.6K", rank: "#3" },
    community: { ...defaultCommunity },
    channels: [{ id: "rules", name: "rules", topic: "Read the community rules before joining the conversation.", type: "announcement", allowChat: false, createdAt: Date.now() }],
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
  const mutationVersion = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        setState((s) => ({
          ...s,
          ...parsed,
          community: { ...defaultCommunity, ...(parsed.community ?? {}) },
          channels: Array.isArray(parsed.channels) && parsed.channels.length ? parsed.channels : s.channels,
        }));
      }
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

  // Shared community content: keep the owner-created directory and messages in
  // Supabase so every signed-in account sees the same community.
  useEffect(() => {
    if (!hydrated) return;
    const db = supabase as any;
    let active = true;
    const sync = async () => {
      const versionAtStart = mutationVersion.current;
      const [{ data: memberRows, error: memberError }, { data: postRows, error: postError }] = await Promise.all([
        db.from("community_listed_members").select("id, data"),
        db.from("community_posts").select("id, data").order("created_at", { ascending: true }),
      ]);
      // An empty result is meaningful: it means the owner deliberately removed
      // the final member or post.  Never repopulate it from browser sample data.
      if (!active || memberError || postError || versionAtStart !== mutationVersion.current) return;
      const members = (memberRows ?? []).map((row: { id: string; data: Member }) => ({ ...row.data, id: row.id })) as Member[];
      const posts = (postRows ?? []).map((row: { id: string; data: Post }) => ({ ...row.data, id: row.id })) as Post[];
      setState((current) => ({ ...current, members, posts }));
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 12_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [hydrated]);

  const addMember = useCallback((member: Omit<Member, "id">) => {
    const id = uid();
    mutationVersion.current += 1;
    setState((s) => ({
      ...s,
      members: [{ joined: Date.now(), ...member, id }, ...s.members],
    }));
    void (supabase as any).from("community_listed_members").upsert({ id, data: { joined: Date.now(), ...member } });
  }, []);

  const updateMember = useCallback((id: string, patch: Partial<Member>) => {
    mutationVersion.current += 1;
    setState((s) => ({
      ...s,
      members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
    void (supabase as any).from("community_listed_members").select("data").eq("id", id).maybeSingle().then(({ data }: any) => data && (supabase as any).from("community_listed_members").update({ data: { ...data.data, ...patch } }).eq("id", id));
  }, []);

  const removeMember = useCallback(async (id: string) => {
    mutationVersion.current += 1;
    const db = supabase as any;
    const { error } = await db.from("community_listed_members").delete().eq("id", id);
    if (error) throw error;
    setState((s) => ({
      ...s,
      members: s.members.filter((m) => m.id !== id),
      posts: s.posts.filter((p) => p.authorId !== id),
    }));
    // Posts are secondary data; a failed cleanup must not bring the member back.
    void db.from("community_posts").delete().eq("data->>authorId", id);
  }, []);

  const addPost = useCallback(async (input: PostInput) => {
    const id = uid();
    const post = { ...input, id, image: input.image ?? "", channel: input.channel ?? "general", reactions: {}, time: Date.now() };
    mutationVersion.current += 1;
    const { id: _id, ...data } = post;
    const { error } = await (supabase as any).from("community_posts").upsert({ id, data });
    if (error) {
      mutationVersion.current += 1;
      throw error;
    }
    setState((s) => ({
      ...s,
      posts: [
        post,
        ...s.posts,
      ],
    }));
  }, []);

  const setStats = useCallback((stats: Stats) => {
    setState((s) => ({ ...s, stats }));
  }, []);

  const setCommunity = useCallback((community: Community) => {
    setState((s) => ({ ...s, community }));
  }, []);

  const addChannel = useCallback((channel: Omit<CommunityChannel, "id" | "createdAt">) => {
    setState((s) => ({ ...s, channels: [...s.channels, { ...channel, id: uid(), createdAt: Date.now() }] }));
  }, []);

  const removeChannel = useCallback((id: string) => {
    if (id === "rules") return;
    setState((s) => ({ ...s, channels: s.channels.filter((channel) => channel.id !== id) }));
  }, []);

  const toggleReaction = useCallback((id: string, emoji: string) => {
    setState((s) => ({ ...s, posts: s.posts.map((post) => post.id === id ? { ...post, reactions: { ...(post.reactions ?? {}), [emoji]: ((post.reactions ?? {})[emoji] ?? 0) + 1 } } : post) }));
  }, []);

  return {
    state,
    hydrated,
    addMember,
    updateMember,
    removeMember,
    addPost,
    setStats,
    setCommunity,
    addChannel,
    removeChannel,
    toggleReaction,
  };
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
export const EMOJI_LIBRARY = [
  ["😀", "grinning happy"], ["😂", "laughing tears"], ["😍", "love heart eyes"], ["🥳", "party celebration"],
  ["🔥", "fire hype"], ["💜", "purple heart"], ["🎮", "gaming controller"], ["🎉", "party popper"],
  ["🚀", "rocket launch"], ["👀", "eyes look"], ["🏆", "trophy winner"], ["🤝", "handshake"],
  ["⚡", "lightning energy"], ["😎", "cool sunglasses"], ["😭", "crying sad"], ["😡", "angry"],
  ["👍", "thumbs up like"], ["👎", "thumbs down"], ["🙏", "thanks pray"], ["🎵", "music note"],
  ["📸", "camera photo"], ["💯", "hundred perfect"], ["✨", "sparkles"], ["🫡", "salute"],
] as const;

export function formatDate(ts: number | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
