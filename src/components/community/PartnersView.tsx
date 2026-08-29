import { useState, useMemo } from "react";
import {
  Gem,
  CheckCircle,
  Radio,
  ExternalLink,
  ShieldCheck,
  Users,
  Award,
  MessageSquare,
  Sparkles,
  Heart,
  Send,
  Calendar,
  Lock,
  Megaphone,
  Briefcase,
  Layers,
  HelpCircle,
  Search,
  Plus,
  X,
  FileText,
  Download,
  Share2,
  TrendingUp,
} from "lucide-react";
import type { Member, Post } from "@/lib/community";
import { Avatar } from "./Bits";
import { BrandIcon } from "./BrandIcon";

interface PartnerLoungePost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  tag: "Discussion" | "Announcement" | "Opportunity" | "Event" | "Resource";
  title: string;
  content: string;
  timestamp: string;
  reactions: Record<string, number>;
  repliesCount: number;
}

const INITIAL_LOUNGE_POSTS: PartnerLoungePost[] = [
  {
    id: "pl-1",
    authorId: "admin",
    authorName: "StreamCore Staff",
    authorHandle: "@streamcore",
    tag: "Announcement",
    title: "🚀 Q3 Creator Fund & Global Partner Raid Train Kickoff",
    content:
      "Welcome all official StreamCore Partners! The Q3 Partner Fund is now active. We are coordinating a 48-hour global raid train this weekend. Sign up your stream schedule below to get featured on the main homepage carousel.",
    timestamp: "2 hours ago",
    reactions: { "🔥": 28, "💎": 42, "🙌": 19 },
    repliesCount: 14,
  },
  {
    id: "pl-2",
    authorId: "p-2",
    authorName: "ValkyriePrime",
    authorHandle: "@valkyrie",
    tag: "Opportunity",
    title: "Looking for 3 Squad Partners for Apex Legends Pro-Am Tournament",
    content:
      "Hey partners! I'm putting together a high-tier squad for the StreamCore Invitational next Friday ($15k prize pool). Looking for 2 aggressive fraggers and 1 support flex. Drop your Discord tag or DM me directly!",
    timestamp: "5 hours ago",
    reactions: { "🎮": 15, "💥": 11, "🔥": 8 },
    repliesCount: 9,
  },
  {
    id: "pl-3",
    authorId: "p-3",
    authorName: "EchoBeats",
    authorHandle: "@echobeats",
    tag: "Resource",
    title: "📦 Official StreamCore Partner 4K Animated Overlay & Emote Pack V2",
    content:
      "Just dropped the new animated partner overlays (Stinger transitions, starting soon screens, 💎 animated bit badges). Completely free for all verified partners in the resource vault.",
    timestamp: "1 day ago",
    reactions: { "❤️": 31, "💎": 25, "✨": 18 },
    repliesCount: 6,
  },
];

export function PartnersView({
  members,
  posts,
  onPick,
  isAdmin,
  currentUserId,
  setToast,
  onSendMessage,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  isAdmin?: boolean | undefined;
  currentUserId?: string | undefined;
  setToast?: ((msg: string) => void) | undefined;
  onSendMessage?: ((member: Member) => void) | undefined;
}) {
  const [activeTab, setActiveTab] = useState<"directory" | "lounge" | "benefits">("directory");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loungePosts, setLoungePosts] = useState<PartnerLoungePost[]>(INITIAL_LOUNGE_POSTS);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("streamcore:following") || "{}");
    } catch {
      return {};
    }
  });

  const [partnerMap, setPartnerMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("streamcore:partner-overrides") || "{}");
    } catch {
      return {};
    }
  });

  // Lounge post creation modal
  const [loungeModalOpen, setLoungeModalOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostTag, setNewPostTag] = useState<PartnerLoungePost["tag"]>("Discussion");

  const toggleFollow = (id: string, name: string) => {
    setFollowingMap((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("streamcore:following", JSON.stringify(updated));
      } catch {}
      setToast?.(updated[id] ? `Followed partner ${name}!` : `Unfollowed ${name}`);
      return updated;
    });
  };

  const togglePartnerStatus = (memberId: string, name: string) => {
    setPartnerMap((prev) => {
      const current = prev[memberId] !== undefined ? prev[memberId] : true;
      const updated = { ...prev, [memberId]: !current };
      try {
        localStorage.setItem("streamcore:partner-overrides", JSON.stringify(updated));
      } catch {}
      setToast?.(updated[memberId] ? `Granted Partner status to ${name}!` : `Revoked Partner status from ${name}`);
      return updated;
    });
  };

  // Partners list
  const partnerMembers = useMemo(() => {
    return members.filter((m) => {
      if (partnerMap[m.id] !== undefined) return partnerMap[m.id];
      // Default: admin, partner role, or top tier creators
      return m.role === "partner" || m.role === "admin" || (m.followers && m.followers >= 800000);
    });
  }, [members, partnerMap]);

  const filteredPartners = useMemo(() => {
    let list = partnerMembers;
    if (selectedCategory !== "all") {
      list = list.filter((m) =>
        (m.gameName || m.role || "gaming").toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.handle.toLowerCase().includes(q) ||
          (m.bio && m.bio.toLowerCase().includes(q))
      );
    }
    return list;
  }, [partnerMembers, selectedCategory, search]);

  const handleCreateLoungePost = () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      setToast?.("Please enter a title and content");
      return;
    }
    const myMember = members.find((m) => m.id === currentUserId) || members[0];
    const newEntry: PartnerLoungePost = {
      id: `pl-${Date.now()}`,
      authorId: myMember?.id || "partner",
      authorName: myMember?.name || "Official Partner",
      authorHandle: myMember?.handle || "@partner",
      tag: newPostTag,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      timestamp: "Just now",
      reactions: { "💎": 1 },
      repliesCount: 0,
    };
    setLoungePosts([newEntry, ...loungePosts]);
    setNewPostTitle("");
    setNewPostContent("");
    setLoungeModalOpen(false);
    setToast?.("Published to 💎 Partner Lounge!");
  };

  const partnerPerks = [
    {
      title: "💎 Official Partner Badge",
      desc: "Distinctive holographic partner badge showcased across your profile, chat messages, and leaderboard rankings.",
    },
    {
      title: "🔒 Private Partner Lounge",
      desc: "Exclusive access to private collab spaces, sponsorship boards, and direct lines to game developers.",
    },
    {
      title: "⭐ Priority Editorial Spotlight",
      desc: "Guaranteed rotation on the StreamCore homepage Hero Spotlight and Featured Creator carousels.",
    },
    {
      title: "⚡ Priority 24/7 Staff Support",
      desc: "Fast-track verification, direct account manager assistance, and emergency stream protection.",
    },
    {
      title: "🎟 Exclusive Tournaments & Events",
      desc: "VIP invitations to partner-only invitational tournaments, offline meetups, and creator summits.",
    },
    {
      title: "🤝 Advanced Collaboration Tools",
      desc: "One-click co-stream squad scheduling, automatic host handoffs, and synchronized multi-view embeds.",
    },
    {
      title: "📊 Deep Partner Analytics",
      desc: "Real-time viewer retention heatmaps, raid conversion rates, and cross-platform demographic insights.",
    },
  ];

  return (
    <div className="space-y-8 px-4 py-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-card via-card/90 to-cyan-950/20 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Gem className="h-4 w-4" />
              </span>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-400">
                Official Creator Partnership
              </p>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              💎 STREAMCORE PARTNERS
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              <strong className="text-foreground font-bold">{partnerMembers.length || 128} official partners</strong> helping shape the network. These are creators officially partnered with StreamCore.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center">
              <p className="text-2xl font-black text-cyan-300">{partnerMembers.length || 128}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Partners</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
              <p className="text-2xl font-black text-emerald-400">98.4%</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              activeTab === "directory"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "bg-card border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Partner Directory ({filteredPartners.length})
          </button>

          <button
            onClick={() => setActiveTab("lounge")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              activeTab === "lounge"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "bg-card border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
            💎 Partner Lounge
          </button>

          <button
            onClick={() => setActiveTab("benefits")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              activeTab === "benefits"
                ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                : "bg-card border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Partner Benefits
          </button>
        </div>

        {activeTab === "directory" && (
          <div className="relative w-full sm:w-64">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search official partners..."
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-cyan-400"
            />
          </div>
        )}
      </div>

      {/* TAB 1: PARTNER DIRECTORY CARDS */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPartners.map((m, idx) => {
              const isFollowing = !!followingMap[m.id];
              const isLive = m.status === "live";
              const isOnline = m.status === "online";
              const rank = idx + 1;

              return (
                <article
                  key={m.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-cyan-500/20 bg-card transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-xl"
                >
                  {/* Large Banner */}
                  <div
                    className="relative h-28 w-full bg-cover bg-center bg-accent"
                    style={
                      m.banner
                        ? { backgroundImage: `url(${m.banner})` }
                        : { background: "linear-gradient(135deg, #164e63, #0f172a)" }
                    }
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

                    {/* Top Status Badges */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-950/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-cyan-300 border border-cyan-400/40">
                        <Gem className="h-3 w-3" />
                        PARTNER
                      </span>

                      {isLive ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-live/90 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
                          <Radio className="h-3 w-3" />
                          LIVE
                        </span>
                      ) : isOnline ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-online">
                          <span className="h-1.5 w-1.5 rounded-full bg-online" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="relative px-4 pb-4 pt-0 -mt-8 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-end justify-between mb-2">
                        <div
                          onClick={() => onPick(m)}
                          className="cursor-pointer relative rounded-xl overflow-hidden ring-2 ring-card group-hover:scale-105 transition-transform"
                        >
                          <Avatar member={m} size={60} showStatus={false} />
                        </div>

                        {/* StreamCore Rank */}
                        <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-black text-cyan-300">
                          <Award className="h-3 w-3" />
                          Rank #{rank}
                        </span>
                      </div>

                      {/* Name + Verified Checkmark */}
                      <div className="cursor-pointer" onClick={() => onPick(m)}>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-foreground text-sm group-hover:text-cyan-400 transition-colors truncate">
                            {m.name}
                          </h3>
                          <CheckCircle className="h-3.5 w-3.5 text-sky-400 fill-sky-400/20 shrink-0" />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{m.handle}</p>
                      </div>

                      {/* Followers & Category */}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">
                          {(m.followers || 3800000).toLocaleString()} followers
                        </span>
                        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                          {m.gameName || m.role || "Gaming"}
                        </span>
                      </div>

                      {/* Platform Icons */}
                      <div className="mt-2.5 flex items-center gap-2">
                        {m.platform ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/80 bg-accent/60 px-2 py-0.5 rounded-md">
                            <BrandIcon platform={m.platform} size={13} />
                            {m.platform}
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                              🟣 Twitch
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                              🔴 YouTube
                            </span>
                          </>
                        )}
                      </div>

                      {/* Bio */}
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {m.bio || "Official StreamCore partner creating high-energy community streams and esports events."}
                      </p>

                      {/* Partner Since */}
                      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2 font-semibold">
                        <span>Partner since:</span>
                        <span className="text-foreground font-bold">March 2026</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onPick(m)}
                          className="flex-1 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 py-2 text-xs font-bold transition text-center"
                        >
                          [View Profile]
                        </button>
                        <button
                          onClick={() => {
                            if (onSendMessage) onSendMessage(m);
                            else setToast?.(`Opened direct message with ${m.name}`);
                          }}
                          className="rounded-lg border border-border bg-accent/60 p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition"
                          title="Message Partner"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleFollow(m.id, m.name)}
                          className={`rounded-lg border p-2 transition ${
                            isFollowing
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                              : "border-border bg-accent/60 text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                          title={isFollowing ? "Following" : "Follow"}
                        >
                          <Heart className={`h-3.5 w-3.5 ${isFollowing ? "fill-emerald-400 text-emerald-400" : ""}`} />
                        </button>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => togglePartnerStatus(m.id, m.name)}
                          className="w-full text-center text-[10px] font-bold text-rose-400 hover:underline pt-1"
                        >
                          Admin: Revoke Partner
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PARTNER LOUNGE */}
      {activeTab === "lounge" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <Lock className="h-5 w-5 text-cyan-400" />
                💎 Partner Lounge
              </h2>
              <p className="text-xs text-muted-foreground">
                Private collaboration space, announcements, and opportunities exclusive to official partners.
              </p>
            </div>

            <button
              onClick={() => setLoungeModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-black text-black hover:bg-cyan-400 transition"
            >
              <Plus className="h-4 w-4" />
              New Discussion / Collab Request
            </button>
          </div>

          <div className="grid gap-4">
            {loungePosts.map((post) => (
              <div
                key={post.id}
                className="rounded-2xl border border-cyan-500/20 bg-card p-5 shadow-sm space-y-3 transition-all hover:border-cyan-500/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 font-bold text-sm">
                      💎
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-foreground">{post.authorName}</strong>
                        <CheckCircle className="h-3.5 w-3.5 text-sky-400 fill-sky-400/20" />
                        <span className="text-xs text-muted-foreground">{post.authorHandle}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{post.timestamp}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      post.tag === "Announcement"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : post.tag === "Opportunity"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : post.tag === "Resource"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                            : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    }`}
                  >
                    {post.tag}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground">{post.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    {Object.entries(post.reactions).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => setToast?.(`Reacted with ${emoji}`)}
                        className="flex items-center gap-1 rounded-lg border border-border/80 bg-accent/60 px-2.5 py-1 text-xs font-bold hover:bg-accent"
                      >
                        <span>{emoji}</span>
                        <span>{count}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setToast?.("Opened discussion thread")}
                    className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:underline"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {post.repliesCount} replies
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PARTNER BENEFITS SHOWCASE */}
      {activeTab === "benefits" && (
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-xs font-black text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" />
              PARTNER BENEFITS
            </span>
            <h2 className="text-2xl font-black">What Partnership Unlocks</h2>
            <p className="text-xs text-muted-foreground">
              Official StreamCore partnership is awarded to creators committed to high broadcast standards, community safety, and collaborative growth.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {partnerPerks.map((perk) => (
              <div
                key={perk.title}
                className="rounded-2xl border border-cyan-500/20 bg-card p-5 space-y-2 shadow-sm transition hover:border-cyan-500/50"
              >
                <h3 className="text-sm font-extrabold text-cyan-300">{perk.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{perk.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-accent/30 p-6 text-center space-y-3">
            <h4 className="font-bold text-sm">Interested in becoming an Official Partner?</h4>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto">
              Partnership applications are reviewed on a rolling basis by StreamCore staff. Streamers with 100+ active followers and consistent broadcast schedules are eligible to apply.
            </p>
            <button
              onClick={() => setToast?.("Partner application submitted for review!")}
              className="rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-black text-black hover:bg-cyan-400 transition"
            >
              Apply for StreamCore Partnership
            </button>
          </div>
        </div>
      )}

      {/* NEW LOUNGE POST MODAL */}
      {loungeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                Post to 💎 Partner Lounge
              </h3>
              <button
                onClick={() => setLoungeModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Category Tag</label>
                <select
                  value={newPostTag}
                  onChange={(e) => setNewPostTag(e.target.value as any)}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="Discussion">Discussion</option>
                  <option value="Opportunity">Opportunity / Sponsorship</option>
                  <option value="Event">Event / Tournament</option>
                  <option value="Resource">Resource / Asset</option>
                  <option value="Announcement">Announcement (Staff)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Title</label>
                <input
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="e.g. Looking for 2 squad members for weekend tournament..."
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Details / Content</label>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={4}
                  placeholder="Share details, rules, Discord link, or collaboration requirements..."
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setLoungeModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLoungePost}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-black hover:bg-cyan-400"
              >
                Publish Discussion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
