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

export type PostComment = {
  id: string;
  authorId: string;
  text: string;
  time: number;
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
  likes?: string[] | undefined;
  shares?: number | undefined;
  comments?: PostComment[] | undefined;
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
  time?: number | undefined;
  likes?: string[] | undefined;
  shares?: number | undefined;
  comments?: PostComment[] | undefined;
  reactions?: Record<string, number> | undefined;
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
const POSTS_PAGE_SIZE = 30;

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
    channels: [
      { id: "rules", name: "rules", topic: "Read the community rules before joining the conversation.", type: "announcement", allowChat: false, createdAt: Date.now() },
      { id: "clips", name: "clips", topic: "Share your best clips and moments.", type: "media", allowChat: true, createdAt: Date.now() },
    ],
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
        text: "🔥 VTubers take over YouTube Gaming rankings in July 2026\n\nEven as esports took over the global livestreaming scene thanks to the start of the Esports World Cup 2026, VTubers held their own on YouTube Gaming in July 2026. However, most of the single-moment spikes seen last month from individual streamers came from coverage of competitive video gaming.\n\nAmong organizations, most of the top names came from studio channels covering the Esports World Cup 2026. We also saw the entry of Marvel Rivals, a game that is slowly picking up pace in terms of its competitive scene. Moreover, a Special Program for one of the most popular gacha games today, Genshin Impact, made the peak concurrent viewership list.",
        image: "",
        channel: "trending",
        likes: [m1, m2, m3],
        shares: 4,
        comments: [
          {
            id: uid(),
            authorId: m2,
            text: "VTubers are dominating the charts this year! Amazing breakdown 🔥",
            time: Date.now() - 1000 * 60 * 30,
          },
          {
            id: uid(),
            authorId: m3,
            text: "Marvel Rivals is huge right now, definitely streaming it tonight 🎮",
            time: Date.now() - 1000 * 60 * 15,
          }
        ],
        time: Date.now() - 1000 * 60 * 60 * 2,
      },
      {
        id: uid(),
        authorId: m2,
        text: "💡 Creator tip: make your profile instantly understandable. One sentence for who you are, one for what you stream, one reason people should follow.",
        image: "",
        channel: "trending",
        likes: [m1, m2],
        shares: 2,
        comments: [],
        time: Date.now() - 1000 * 60 * 60 * 5,
      },
    ],
  };
}

export function useCommunity() {
  const [state, setState] = useState<State>(() => defaultState());
  const [hydrated, setHydrated] = useState(false);
  const [hasOlderPosts, setHasOlderPosts] = useState(true);
  const [loadingOlderPosts, setLoadingOlderPosts] = useState(false);
  const mutationVersion = useRef(0);
  const oldestPostCreatedAt = useRef<string | null>(null);

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
          posts: Array.isArray(parsed.posts) && parsed.posts.length ? parsed.posts : s.posts,
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

  useEffect(() => {
    if (!hydrated) return;
    const db = supabase as any;
    let active = true;
    const mergePost = (incoming: Post) => {
      setState((current) => ({
        ...current,
        posts: [incoming, ...current.posts.filter((post) => post.id !== incoming.id)],
      }));
    };
    const loadInitial = async () => {
      const versionAtStart = mutationVersion.current;
      const [{ data: memberRows, error: memberError }, { data: postRows, error: postError }] = await Promise.all([
        db.from("community_listed_members").select("id, data").limit(100),
        db.from("community_posts").select("id, data, created_at").order("created_at", { ascending: false }).limit(POSTS_PAGE_SIZE),
      ]);
      if (!active || versionAtStart !== mutationVersion.current) return;
      if (!memberError && memberRows && memberRows.length > 0) {
        const members = memberRows.map((row: { id: string; data: Member }) => ({ ...row.data, id: row.id })) as Member[];
        setState((current) => ({ ...current, members }));
      }
      if (!postError && postRows && postRows.length > 0) {
        const rows = postRows ?? [];
        const posts = rows.map((row: { id: string; data: Post }) => ({ ...row.data, id: row.id })) as Post[];
        oldestPostCreatedAt.current = rows.at(-1)?.created_at ?? null;
        setHasOlderPosts(rows.length === POSTS_PAGE_SIZE);
        setState((current) => ({
          ...current,
          posts: [...posts, ...current.posts.filter((p) => !posts.some((dbP) => dbP.id === p.id))],
        }));
      }
    };
    void loadInitial();

    const subscription = db
      .channel("streamcore-community-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, (payload: any) => {
        if (!active) return;
        if (payload.eventType === "DELETE") {
          setState((current) => ({ ...current, posts: current.posts.filter((post) => post.id !== payload.old.id) }));
          return;
        }
        if (payload.new?.id && payload.new?.data) mergePost({ ...payload.new.data, id: payload.new.id } as Post);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_listed_members" }, (payload: any) => {
        if (!active) return;
        if (payload.eventType === "DELETE") {
          setState((current) => ({ ...current, members: current.members.filter((member) => member.id !== payload.old.id) }));
          return;
        }
        if (payload.new?.id && payload.new?.data) {
          const incoming = { ...payload.new.data, id: payload.new.id } as Member;
          setState((current) => ({ ...current, members: [...current.members.filter((member) => member.id !== incoming.id), incoming] }));
        }
      })
      .subscribe();

    return () => { active = false; void supabase.removeChannel(subscription); };
  }, [hydrated]);

  const loadOlderPosts = useCallback(async () => {
    if (loadingOlderPosts || !hasOlderPosts || !oldestPostCreatedAt.current) return;
    setLoadingOlderPosts(true);
    try {
      const { data, error } = await (supabase as any)
        .from("community_posts")
        .select("id, data, created_at")
        .lt("created_at", oldestPostCreatedAt.current)
        .order("created_at", { ascending: false })
        .limit(POSTS_PAGE_SIZE);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length) oldestPostCreatedAt.current = rows.at(-1)?.created_at ?? oldestPostCreatedAt.current;
      setHasOlderPosts(rows.length === POSTS_PAGE_SIZE);
      const older = rows.map((row: { id: string; data: Post }) => ({ ...row.data, id: row.id })) as Post[];
      setState((current) => ({
        ...current,
        posts: [...current.posts, ...older.filter((post) => !current.posts.some((currentPost) => currentPost.id === post.id))]
          .sort((left, right) => right.time - left.time),
      }));
    } finally {
      setLoadingOlderPosts(false);
    }
  }, [hasOlderPosts, loadingOlderPosts]);

  const addMember = useCallback(async (member: Omit<Member, "id">) => {
    const id = uid();
    mutationVersion.current += 1;
    const record = { joined: Date.now(), ...member };
    const { error } = await (supabase as any).from("community_listed_members").upsert({ id, data: record });
    if (error) {
      mutationVersion.current += 1;
      throw error;
    }
    setState((s) => ({
      ...s,
      members: [{ ...record, id }, ...s.members],
    }));
  }, []);

  const updateMember = useCallback(async (id: string, patch: Partial<Member>) => {
    mutationVersion.current += 1;
    const db = supabase as any;
    const { data, error: readError } = await db.from("community_listed_members").select("data").eq("id", id).maybeSingle();
    if (readError || !data) throw readError ?? new Error("Member record was not found");
    const { error } = await db.from("community_listed_members").update({ data: { ...data.data, ...patch } }).eq("id", id);
    if (error) throw error;
    setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
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
    void db.from("community_posts").delete().eq("data->>authorId", id);
  }, []);

  const addPost = useCallback(async (input: PostInput) => {
    if ([input.image, input.video].some((url) => url?.startsWith("data:"))) {
      throw new Error("Media must be uploaded to Storage before publishing.");
    }
    const id = uid();
    const post: Post = {
      ...input,
      id,
      image: input.image ?? "",
      channel: input.channel ?? "general",
      reactions: input.reactions ?? {},
      likes: input.likes ?? [],
      shares: input.shares ?? 0,
      comments: input.comments ?? [],
      time: input.time ?? Date.now(),
    };
    mutationVersion.current += 1;
    const { id: _id, ...data } = post;
    const { error } = await (supabase as any).from("community_posts").upsert({ id, data });
    if (error) {
      mutationVersion.current += 1;
      throw error;
    }
    setState((s) => ({
      ...s,
      posts: [post, ...s.posts],
    }));
  }, []);

  const updatePost = useCallback(async (id: string, patch: Partial<Post>) => {
    mutationVersion.current += 1;
    const db = supabase as any;
    const { data, error: readError } = await db.from("community_posts").select("data").eq("id", id).maybeSingle();
    const currentPost = state.posts.find((p) => p.id === id);
    const updatedData = { ...(data?.data ?? currentPost ?? {}), ...patch };
    const { error } = await db.from("community_posts").upsert({ id, data: updatedData });
    if (error) {
      mutationVersion.current += 1;
      throw error;
    }
    setState((s) => ({
      ...s,
      posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, [state.posts]);

  const removePost = useCallback(async (id: string) => {
    mutationVersion.current += 1;
    const { error } = await (supabase as any).from("community_posts").delete().eq("id", id);
    if (error) throw error;
    setState((s) => ({ ...s, posts: s.posts.filter((post) => post.id !== id) }));
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
    setState((s) => ({
      ...s,
      posts: s.posts.map((post) =>
        post.id === id
          ? { ...post, reactions: { ...(post.reactions ?? {}), [emoji]: ((post.reactions ?? {})[emoji] ?? 0) + 1 } }
          : post
      ),
    }));
  }, []);

  return {
    state,
    hydrated,
    addMember,
    updateMember,
    removeMember,
    addPost,
    updatePost,
    removePost,
    setStats,
    setCommunity,
    addChannel,
    removeChannel,
    toggleReaction,
    loadOlderPosts,
    hasOlderPosts,
    loadingOlderPosts,
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

export async function uploadCommunityMedia(file: File): Promise<string> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in before uploading media");

  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
  const path = `${auth.user.id}/${uid()}.${extension}`;
  const { error } = await supabase.storage.from("community-media").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl;
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
