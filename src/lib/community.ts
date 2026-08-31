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
  followers?: number | undefined;
  viewerCount?: number | undefined;
  gameName?: string | undefined;
  gameImage?: string | undefined;
  streamTitle?: string | undefined;
  joined?: number | undefined;
  real?: boolean | undefined;
  managedByAdmin?: boolean | undefined;
  isPinned?: boolean | undefined;
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
  aiGenerated?: boolean | undefined;
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
  aiGenerated?: boolean | undefined;
};

export type Stats = { members: string; online: string; rank: string };

export type Community = { name: string; logo: string; banner: string; tagline: string; rules: string };
export type CommunityChannel = { id: string; name: string; topic: string; type: "text" | "media" | "voice" | "announcement" | "testimony" | "social"; allowChat: boolean; createdAt: number };

export type State = {
  stats: Stats;
  community: Community;
  members: Member[];
  posts: Post[];
  totalPosts: number;
  channels: CommunityChannel[];
};

const POSTS_PAGE_SIZE = 40;
const CHANNEL_POSTS_PAGE_SIZE = 40;

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
  return {
    stats: { members: "0", online: "0", rank: "—" },
    community: { ...defaultCommunity },
    channels: [
      { id: "rules", name: "rules", topic: "Read the community rules before joining the conversation.", type: "announcement", allowChat: false, createdAt: 0 },
      { id: "clips", name: "clips", topic: "Share your best clips and moments.", type: "media", allowChat: true, createdAt: 0 },
    ],
    members: [],
    posts: [],
    totalPosts: 0,
  };
}

export function useCommunity() {
  // The first render must be identical on the server and in the browser.
  // Members and posts are loaded from Supabase after hydration; no demo/local data is used.
  const [state, setState] = useState<State>(defaultState);

  const [hydrated, setHydrated] = useState(false);
  const [hasOlderPosts, setHasOlderPosts] = useState(true);
  const [loadingOlderPosts, setLoadingOlderPosts] = useState(false);
  const mutationVersion = useRef(0);
  const oldestPostCreatedAt = useRef<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const db = supabase as any;
    let active = true;
    const loadInitial = async () => {
      const versionAtStart = mutationVersion.current;
      const [
        { data: memberRows, error: memberError },
        { data: generalRows, error: generalError },
        { data: channelRows, error: channelError },
        { count: totalPostCount, error: totalPostCountError },
      ] = await Promise.all([
        db.from("community_listed_members").select("id, data").limit(100),
        db
          .from("community_posts")
          .select("id, data, created_at")
          .eq("data->>channel", "general")
          .order("created_at", { ascending: false })
          .limit(POSTS_PAGE_SIZE),
        db
          .from("community_posts")
          .select("id, data, created_at")
          .neq("data->>channel", "general")
          .order("created_at", { ascending: false })
          .limit(CHANNEL_POSTS_PAGE_SIZE),
        db.from("community_posts").select("id", { count: "exact", head: true }),
      ]);
      if (!active || versionAtStart !== mutationVersion.current) return;
      if (!memberError && memberRows && memberRows.length > 0) {
        const members = memberRows.map((row: { id: string; data: Member }) => ({ ...row.data, id: row.id })) as Member[];
        setState((current) => ({ ...current, members }));
      }
      if (!generalError || !channelError) {
        // General is intentionally paginated independently. High-frequency
        // chat must never push durable #clips, trending posts, or events out
        // of a visitor's initial result set.
        const rows = [
          ...(!generalError ? generalRows ?? [] : []),
          ...(!channelError ? channelRows ?? [] : []),
        ];
        const postMap = new Map<string, Post>();
        for (const r of rows) {
          if (r?.id && r?.data) {
            postMap.set(r.id, { ...r.data, id: r.id });
          }
        }
        const posts = Array.from(postMap.values()).sort((a, b) => b.time - a.time);
        const loadedGeneralRows = !generalError ? generalRows ?? [] : [];
        oldestPostCreatedAt.current = loadedGeneralRows.at(-1)?.created_at ?? null;
        setHasOlderPosts(loadedGeneralRows.length === POSTS_PAGE_SIZE);
        setState((current) => ({
          ...current,
          posts,
          totalPosts: !totalPostCountError && typeof totalPostCount === "number"
            ? totalPostCount
            : current.totalPosts,
        }));
      } else if (!totalPostCountError && typeof totalPostCount === "number") {
        setState((current) => ({ ...current, totalPosts: totalPostCount }));
      }
    };
    void loadInitial();

    const subscription = db
      .channel("streamcore-community-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, (payload: any) => {
        if (!active) return;
        if (payload.eventType === "DELETE") {
          setState((current) => ({
            ...current,
            posts: current.posts.filter((post) => post.id !== payload.old.id),
            totalPosts: Math.max(0, current.totalPosts - 1),
          }));
          return;
        }
        if (payload.new?.id && payload.new?.data) {
          const incoming = { ...payload.new.data, id: payload.new.id } as Post;
          setState((current) => {
            const alreadyLoaded = current.posts.some((post) => post.id === incoming.id);
            return {
              ...current,
              posts: [incoming, ...current.posts.filter((post) => post.id !== incoming.id)],
              totalPosts: payload.eventType === "INSERT" && !alreadyLoaded
                ? current.totalPosts + 1
                : current.totalPosts,
            };
          });
        }
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
        .eq("data->>channel", "general")
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
    // This table is exclusively managed through the admin creator form. Keep
    // the provenance explicit so server automations never select self-signups.
    const record = { joined: Date.now(), ...member, managedByAdmin: true };
    const { error } = await (supabase as any).from("community_listed_members").upsert({ id, data: record });
    if (error) {
      mutationVersion.current += 1;
      throw error;
    }

    try {
      const profileRecord = {
        id,
        display_name: member.name,
        handle: member.handle ? member.handle.replace(/^@/, "") : member.name.toLowerCase().replace(/\s+/g, ""),
        bio: member.bio || "",
        avatar_url: member.avatar || "",
        banner_url: member.banner || "",
        platform: member.platform || "Twitch",
        channel_url: member.link || "",
        status: member.status || "online",
        is_banned: false,
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        twitch_verified: false,
        social_links: member.connections || [],
      };
      await (supabase as any).from("profiles").upsert(profileRecord);
      await (supabase as any).from("user_roles").upsert({ user_id: id, role: member.role || "streamer" });
    } catch {
      // ignore
    }

    setState((s) => ({
      ...s,
      members: [{ ...record, id }, ...s.members],
    }));
  }, []);

  const updateMember = useCallback(async (id: string, patch: Partial<Member>) => {
    mutationVersion.current += 1;
    const db = supabase as any;
    const { data } = await db.from("community_listed_members").select("data").eq("id", id).maybeSingle();
    if (data?.data) {
      await db.from("community_listed_members").update({ data: { ...data.data, ...patch } }).eq("id", id);
    } else {
      const currentListed = state.members.find((m) => m.id === id);
      if (currentListed) {
        await db.from("community_listed_members").upsert({ id, data: { ...currentListed, ...patch } });
      }
    }

    try {
      const profilePatch: any = {};
      if (patch.name) profilePatch.display_name = patch.name;
      if (patch.handle) profilePatch.handle = patch.handle.replace(/^@/, "");
      if (patch.bio !== undefined) profilePatch.bio = patch.bio;
      if (patch.avatar !== undefined) profilePatch.avatar_url = patch.avatar;
      if (patch.banner !== undefined) profilePatch.banner_url = patch.banner;
      if (patch.platform) profilePatch.platform = patch.platform;
      if (patch.link !== undefined) profilePatch.channel_url = patch.link;
      if (patch.status) profilePatch.status = patch.status;
      if (patch.connections) profilePatch.social_links = patch.connections;
      if (Object.keys(profilePatch).length) {
        await db.from("profiles").update(profilePatch).eq("id", id);
      }
    } catch {
      // ignore
    }

    setState((s) => {
      const exists = s.members.some((m) => m.id === id);
      if (exists) {
        return { ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
      } else {
        const dummy: Member = {
          id,
          name: patch.name || "Streamer",
          handle: patch.handle || "@streamer",
          platform: patch.platform || "Twitch",
          status: patch.status || "online",
          link: patch.link || "",
          bio: patch.bio || "",
          avatar: patch.avatar || "",
          banner: patch.banner || "",
          ...patch,
        };
        return { ...s, members: [dummy, ...s.members] };
      }
    });
  }, [state.members]);

  const removeMember = useCallback(async (id: string) => {
    mutationVersion.current += 1;
    const db = supabase as any;
    const { error } = await db.from("community_listed_members").delete().eq("id", id);
    if (error) throw error;

    try {
      await db.from("profiles").delete().eq("id", id);
      await db.from("user_roles").delete().eq("user_id", id);
    } catch {
      // ignore
    }

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
    const cleanText = (input.text || "").trim();
    const channel = input.channel ?? "general";

    // Prevent duplicate spam/burst posts
    const isDuplicate = state.posts.some(
      (p) =>
        p.channel === channel &&
        p.authorId === input.authorId &&
        ((cleanText && p.text?.trim() === cleanText) || (Boolean(input.image) && p.image === input.image)) &&
        Math.abs(Date.now() - p.time) < 45_000,
    );
    if (isDuplicate) {
      return;
    }

    const id = uid();
    const post: Post = {
      ...input,
      id,
      image: input.image ?? "",
      channel,
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
    const db = supabase as any;
    try {
      await db.from("community_posts").delete().eq("id", id);
    } catch (err) {
      console.error("Failed to delete post from DB:", err);
    }
    setState((s) => {
      const nextPosts = s.posts.filter((post) => post.id !== id);
      return { ...s, posts: nextPosts };
    });
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

  const toggleReaction = useCallback((id: string, emoji: string, userId?: string) => {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return;
    const currentCount = (post.reactions ?? {})[emoji] ?? 0;
    const reactions = {
      ...(post.reactions ?? {}),
      [emoji]: currentCount + 1,
    };
    const userKey = userId || "me";
    const currentLikes = post.likes ?? [];
    const isLikeEmoji = emoji === "❤️" || emoji === "💖";
    const likes = isLikeEmoji
      ? (currentLikes.includes(userKey) ? currentLikes.filter((x) => x !== userKey) : [...currentLikes, userKey])
      : currentLikes;

    void updatePost(id, { reactions, likes });
  }, [state.posts, updatePost]);

  // Twitch polling is transient, authoritative data. Apply it locally in one
  // render without turning every viewer-count change into a Supabase write.
  const applyMemberSnapshots = useCallback(
    (snapshots: Array<{ id: string; patch: Partial<Member> }>) => {
      if (!snapshots.length) return;
      const patches = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.patch]));
      setState((current) => ({
        ...current,
        members: current.members.map((member) => {
          const patch = patches.get(member.id);
          return patch ? { ...member, ...patch } : member;
        }),
      }));
    },
    [],
  );

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
    applyMemberSnapshots,
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

export function formatDate(ts: number | string | undefined | null) {
  if (!ts) return "—";
  const num = typeof ts === "string" ? new Date(ts).getTime() : typeof ts === "number" ? ts : NaN;
  if (!num || isNaN(num)) return "—";
  try {
    return new Date(num).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
