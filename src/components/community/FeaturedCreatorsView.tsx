import { useState, useMemo } from "react";
import {
  Star,
  Sparkles,
  TrendingUp,
  Radio,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  Users,
  Award,
  Pin,
  Settings2,
  X,
  Play,
  Heart,
  Flame,
  Gamepad2,
  Mic,
  Music,
  Globe,
  Rocket,
  Clock,
} from "lucide-react";
import type { Member, Post } from "@/lib/community";
import { Avatar } from "./Bits";
import { BrandIcon } from "./BrandIcon";

export type FeaturedCategory = "all" | "gaming" | "conversation" | "music" | "irl" | "breakout";

interface SpotlightConfig {
  heroCreatorId?: string;
  heroQuote?: string;
  heroDuration?: string;
  featuredList: Array<{
    creatorId: string;
    category: FeaturedCategory;
    quote: string;
    growth: string;
    rank: number;
    pinned?: boolean;
    expiresAt?: number;
  }>;
}

const DEFAULT_SPOTLIGHT: SpotlightConfig = {
  heroQuote: "One of the fastest-growing FPS creators this month. Dominating high-rank lobbies with unmatched mechanical skill and high-energy community streams.",
  heroDuration: "7 Days",
  featuredList: [],
};

export function FeaturedCreatorsView({
  members,
  posts,
  onPick,
  isAdmin,
  setToast,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  isAdmin?: boolean;
  setToast?: (msg: string) => void;
}) {
  const [category, setCategory] = useState<FeaturedCategory>("all");
  const [search, setSearch] = useState("");
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("streamcore:following") || "{}");
    } catch {
      return {};
    }
  });

  const [spotlightConfig, setSpotlightConfig] = useState<SpotlightConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_SPOTLIGHT;
    try {
      const saved = localStorage.getItem("streamcore:featured-config");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SPOTLIGHT;
  });

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editHeroId, setEditHeroId] = useState(spotlightConfig.heroCreatorId || "");
  const [editHeroQuote, setEditHeroQuote] = useState(spotlightConfig.heroQuote || "");
  const [editSelectedCreatorId, setEditSelectedCreatorId] = useState("");
  const [editCreatorCategory, setEditCreatorCategory] = useState<FeaturedCategory>("gaming");
  const [editCreatorQuote, setEditCreatorQuote] = useState("");
  const [editCreatorGrowth, setEditCreatorGrowth] = useState("+128%");
  const [editCreatorRank, setEditCreatorRank] = useState(14);
  const [editDurationDays, setEditDurationDays] = useState(7);

  const toggleFollow = (id: string, name: string) => {
    setFollowingMap((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("streamcore:following", JSON.stringify(updated));
      } catch {}
      setToast?.(updated[id] ? `Followed ${name}!` : `Unfollowed ${name}`);
      return updated;
    });
  };

  // Select Hero Creator
  const heroMember = useMemo(() => {
    if (spotlightConfig.heroCreatorId) {
      const found = members.find((m) => m.id === spotlightConfig.heroCreatorId);
      if (found) return found;
    }
    // Fallback: pick top live creator or top follower creator
    const liveCandidate = members.find((m) => m.status === "live");
    if (liveCandidate) return liveCandidate;
    return members.slice().sort((a, b) => (b.followers || 0) - (a.followers || 0))[0] || members[0];
  }, [members, spotlightConfig.heroCreatorId]);

  // Featured Creators List
  const featuredCreators = useMemo(() => {
    const customList = spotlightConfig.featuredList;
    const result: Array<{
      member: Member;
      category: FeaturedCategory;
      quote: string;
      growth: string;
      rank: number;
      pinned?: boolean;
    }> = [];

    const seenIds = new Set<string>();

    if (customList.length > 0) {
      for (const item of customList) {
        const m = members.find((x) => x.id === item.creatorId);
        if (m) {
          seenIds.add(m.id);
          result.push({
            member: m,
            category: item.category,
            quote: item.quote,
            growth: item.growth,
            rank: item.rank,
            pinned: item.pinned,
          });
        }
      }
    }

    // Default seeded featured creators if list has room
    const defaultCategories: FeaturedCategory[] = ["gaming", "conversation", "music", "irl", "breakout"];
    const quotes = [
      "One of the fastest-growing FPS creators this month.",
      "Consistently driving massive chat engagement and late-night hype.",
      "Incredible musical freestyle sessions and top-tier community vibes.",
      "Documenting high-octane real-world adventures across the globe.",
      "Breakout talent surging up the StreamCore rankings this week.",
      "Pioneering tactical coaching and high-IQ competitive gameplay.",
      "Community favorite with 100+ hours streamed this month.",
      "Viral clip champion with unmatched comedic timing on stream.",
    ];

    const growthPercentages = ["+184%", "+128%", "+94%", "+76%", "+215%", "+142%", "+88%", "+160%"];

    let count = 0;
    for (const m of members) {
      if (m.id === heroMember?.id || seenIds.has(m.id)) continue;
      if (result.length >= 12) break;

      const cat = defaultCategories[count % defaultCategories.length] || "gaming";
      result.push({
        member: m,
        category: cat,
        quote: quotes[count % quotes.length] || "Outstanding creator shaping the StreamCore network.",
        growth: growthPercentages[count % growthPercentages.length] || "+110%",
        rank: count + 2,
        pinned: count < 2,
      });
      seenIds.add(m.id);
      count++;
    }

    return result;
  }, [members, spotlightConfig, heroMember]);

  const filteredCards = useMemo(() => {
    let list = featuredCreators;
    if (category !== "all") {
      list = list.filter((item) => item.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.member.name.toLowerCase().includes(q) ||
          item.member.handle.toLowerCase().includes(q) ||
          item.quote.toLowerCase().includes(q)
      );
    }
    return list;
  }, [featuredCreators, category, search]);

  const saveAdminSettings = () => {
    const updated: SpotlightConfig = {
      heroCreatorId: editHeroId || undefined,
      heroQuote: editHeroQuote || DEFAULT_SPOTLIGHT.heroQuote,
      heroDuration: `${editDurationDays} Days`,
      featuredList: [...spotlightConfig.featuredList],
    };

    if (editSelectedCreatorId) {
      // Add or update
      const existingIdx = updated.featuredList.findIndex((x) => x.creatorId === editSelectedCreatorId);
      const item = {
        creatorId: editSelectedCreatorId,
        category: editCreatorCategory,
        quote: editCreatorQuote || "Featured by StreamCore staff for outstanding community presence.",
        growth: editCreatorGrowth || "+125%",
        rank: editCreatorRank || 10,
        expiresAt: Date.now() + editDurationDays * 86400000,
      };
      if (existingIdx >= 0) {
        updated.featuredList[existingIdx] = item;
      } else {
        updated.featuredList.unshift(item);
      }
    }

    setSpotlightConfig(updated);
    try {
      localStorage.setItem("streamcore:featured-config", JSON.stringify(updated));
    } catch {}
    setToast?.("Spotlight settings saved!");
    setAdminModalOpen(false);
  };

  const removeFeaturedItem = (creatorId: string) => {
    const updated: SpotlightConfig = {
      ...spotlightConfig,
      featuredList: spotlightConfig.featuredList.filter((x) => x.creatorId !== creatorId),
    };
    setSpotlightConfig(updated);
    try {
      localStorage.setItem("streamcore:featured-config", JSON.stringify(updated));
    } catch {}
    setToast?.("Removed creator from featured list");
  };

  const categoryTabs: Array<{ id: FeaturedCategory; label: string; icon: any }> = [
    { id: "all", label: "All Featured", icon: Star },
    { id: "gaming", label: "Gaming", icon: Gamepad2 },
    { id: "conversation", label: "Conversation", icon: Mic },
    { id: "music", label: "Music", icon: Music },
    { id: "irl", label: "IRL", icon: Globe },
    { id: "breakout", label: "Breakout", icon: Rocket },
  ];

  return (
    <div className="space-y-8 px-4 py-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Star className="h-4 w-4 fill-amber-400" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Curated Spotlight Room
            </p>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
            Featured Creators
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            These are the creators StreamCore wants everyone to discover.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setEditHeroId(heroMember?.id || "");
              setEditHeroQuote(spotlightConfig.heroQuote || DEFAULT_SPOTLIGHT.heroQuote!);
              setAdminModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg border border-border/80 bg-accent/60 px-3.5 py-2 text-xs font-bold transition hover:bg-accent hover:border-amber-400/50"
          >
            <Settings2 className="h-4 w-4 text-amber-400" />
            Admin Spotlight Control
          </button>
        )}
      </div>

      {/* HERO CREATOR SPOTLIGHT */}
      {heroMember && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-card shadow-2xl transition-all">
          {/* Background Ambient Glow & Banner */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-sm"
            style={
              heroMember.banner
                ? { backgroundImage: `url(${heroMember.banner})` }
                : {
                    background:
                      "radial-gradient(ellipse at top, rgba(245, 158, 11, 0.35), transparent 70%), linear-gradient(180deg, #18191c 0%, #0e0e10 100%)",
                  }
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-transparent" />

          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs font-black text-amber-300 shadow-sm">
                <Star className="h-3.5 w-3.5 fill-amber-300" />
                HERO CREATOR SPOTLIGHT
              </span>

              {heroMember.status === "live" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-live/20 border border-live/40 px-2.5 py-0.5 text-xs font-bold text-live animate-pulse">
                  <Radio className="h-3.5 w-3.5" />
                  LIVE NOW {heroMember.viewerCount ? `· ${heroMember.viewerCount.toLocaleString()} viewers` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-online/20 border border-online/40 px-2.5 py-0.5 text-xs font-bold text-online">
                  <span className="h-2 w-2 rounded-full bg-online" />
                  ONLINE
                </span>
              )}

              <span className="inline-flex items-center gap-1 rounded-full bg-accent/80 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                <Clock className="h-3 w-3" />
                Featured for {spotlightConfig.heroDuration || "7 Days"}
              </span>
            </div>

            <div className="grid gap-6 md:grid-cols-[auto_1fr_auto] items-start">
              {/* Avatar */}
              <div className="relative group cursor-pointer" onClick={() => onPick(heroMember)}>
                <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden ring-4 ring-amber-500/40 shadow-xl transition-transform group-hover:scale-105">
                  <Avatar member={heroMember} size={112} showStatus={false} />
                </div>
                {heroMember.status === "live" && (
                  <span className="absolute -bottom-2 inset-x-0 mx-auto w-max rounded-md bg-live px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-md">
                    LIVE
                  </span>
                )}
              </div>

              {/* Info & Bio */}
              <div className="min-w-0 space-y-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2
                      onClick={() => onPick(heroMember)}
                      className="cursor-pointer text-2xl sm:text-3xl font-black text-foreground hover:text-amber-400 transition-colors"
                    >
                      {heroMember.name}
                    </h2>
                    <CheckCircle className="h-5 w-5 text-sky-400 fill-sky-400/20" title="Verified Creator" />
                    <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-muted-foreground">
                      {heroMember.handle}
                    </span>
                    <span className="rounded-md bg-primary/20 border border-primary/30 px-2 py-0.5 text-xs font-bold text-primary">
                      {heroMember.gameName || heroMember.role || "FPS Creator"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-foreground/90 leading-relaxed max-w-2xl">
                    {heroMember.bio || "Leading the competitive community with daily high-level gameplay and interactive community events."}
                  </p>
                </div>

                {/* Why They're Featured Quote Card */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 sm:p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Why they're featured
                  </p>
                  <p className="mt-1 text-sm font-medium italic text-foreground/90">
                    "{spotlightConfig.heroQuote || DEFAULT_SPOTLIGHT.heroQuote}"
                  </p>
                </div>

                {/* Community Metrics */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground pt-1">
                  <span className="flex items-center gap-1.5 text-foreground font-bold">
                    <Users className="h-4 w-4 text-amber-400" />
                    {(heroMember.followers || 2400000).toLocaleString()} followers
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <TrendingUp className="h-4 w-4" />
                    +128% growth this month
                  </span>
                  <span className="flex items-center gap-1 text-amber-300 font-bold">
                    <Award className="h-4 w-4" />
                    StreamCore Rank #1
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full font-medium">
                    <Heart className="h-3 w-3 fill-rose-400" />
                    Community Favorite · 14,821 members follow
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row md:flex-col gap-2.5 w-full md:w-44 shrink-0">
                <button
                  onClick={() => onPick(heroMember)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-black transition hover:bg-amber-400 shadow-lg hover:shadow-amber-500/20"
                >
                  <Award className="h-4 w-4" />
                  View Profile
                </button>

                {heroMember.link && (
                  <a
                    href={heroMember.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-live/50 bg-live/10 px-4 py-2.5 text-xs font-bold text-live transition hover:bg-live hover:text-white"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch Live
                  </a>
                )}

                <button
                  onClick={() => toggleFollow(heroMember.id, heroMember.name)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
                    followingMap[heroMember.id]
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border/80 bg-accent/60 text-foreground hover:bg-accent"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${followingMap[heroMember.id] ? "fill-emerald-400 text-emerald-400" : ""}`} />
                  {followingMap[heroMember.id] ? "Following" : "Follow"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CATEGORY SELECTOR & SEARCH */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categoryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  active
                    ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                    : "bg-card border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spotlight creators..."
            className="w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-amber-400/80"
          />
        </div>
      </div>

      {/* FEATURED THIS WEEK GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              ⭐ FEATURED THIS WEEK
            </h2>
            <p className="text-xs text-muted-foreground">
              Hand-picked creators accelerating community growth.
            </p>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {filteredCards.length} creators
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCards.map((item) => {
            const m = item.member;
            const isFollowing = !!followingMap[m.id];
            const isLive = m.status === "live";

            return (
              <article
                key={m.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-xl"
              >
                {/* Banner image with header badges */}
                <div
                  className="relative h-24 w-full bg-cover bg-center bg-accent"
                  style={
                    m.banner
                      ? { backgroundImage: `url(${m.banner})` }
                      : { background: "linear-gradient(135deg, #27272a, #18181b)" }
                  }
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

                  {/* Top badges */}
                  <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/30">
                      ⭐ FEATURED
                    </span>

                    {isLive ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-live/90 px-2 py-0.5 text-[10px] font-black text-white shadow-sm animate-pulse">
                        <Radio className="h-3 w-3" />
                        LIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-online">
                        <span className="h-1.5 w-1.5 rounded-full bg-online" />
                        Online
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="relative px-4 pb-4 pt-0 -mt-7 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Avatar & Follow button */}
                    <div className="flex items-end justify-between mb-2">
                      <div
                        onClick={() => onPick(m)}
                        className="cursor-pointer relative rounded-xl overflow-hidden ring-2 ring-card group-hover:scale-105 transition-transform"
                      >
                        <Avatar member={m} size={54} showStatus={false} />
                      </div>

                      <button
                        onClick={() => toggleFollow(m.id, m.name)}
                        className={`rounded-lg p-2 transition ${
                          isFollowing
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-accent/60 text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                        title={isFollowing ? "Following" : "Follow"}
                      >
                        <Heart className={`h-4 w-4 ${isFollowing ? "fill-emerald-400 text-emerald-400" : ""}`} />
                      </button>
                    </div>

                    {/* Name & Handle */}
                    <div className="cursor-pointer" onClick={() => onPick(m)}>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-foreground text-sm group-hover:text-amber-400 transition-colors truncate">
                          {m.name}
                        </h3>
                        <CheckCircle className="h-3.5 w-3.5 text-sky-400 fill-sky-400/20 shrink-0" />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{m.handle}</p>
                    </div>

                    {/* Followers & Category */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">
                        {(m.followers || 2400000).toLocaleString()} followers
                      </span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                        {item.category}
                      </span>
                    </div>

                    {/* Spotlight Description Quote */}
                    <div className="mt-2.5 rounded-lg border border-border/70 bg-accent/30 p-2.5">
                      <p className="text-xs italic text-muted-foreground line-clamp-2 leading-relaxed">
                        "{item.quote}"
                      </p>
                    </div>

                    {/* Growth & Rank Pills */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        <TrendingUp className="h-3 w-3" />
                        {item.growth} growth
                      </span>
                      <span className="inline-flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        <Award className="h-3 w-3" />
                        Rank #{item.rank}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
                    <button
                      onClick={() => onPick(m)}
                      className="flex-1 rounded-lg bg-accent/80 hover:bg-amber-500 hover:text-black py-2 text-xs font-bold transition text-center"
                    >
                      [View Profile]
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => removeFeaturedItem(m.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Remove from featured list"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* COMMUNITY SPOTLIGHT BANNER */}
      <section className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-accent/30 to-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-400">
              <Heart className="h-4 w-4 fill-rose-400" />
              Community Spotlight & Voting
            </span>
            <h3 className="text-lg font-bold">Community Favorites of the Month</h3>
            <p className="text-xs text-muted-foreground max-w-xl">
              Creators voted by StreamCore members for outstanding community mentorship, raid trains, and collaborative streams.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border bg-card px-4 py-2 text-center">
              <p className="text-lg font-black text-amber-400">14,821</p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Community Votes</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2 text-center">
              <p className="text-lg font-black text-emerald-400">+128%</p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Avg Spotlight Growth</p>
            </div>
          </div>
        </div>
      </section>

      {/* ADMIN SPOTLIGHT CONTROL MODAL */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-amber-400" />
                <h3 className="font-extrabold text-base">Admin Spotlight Control</h3>
              </div>
              <button
                onClick={() => setAdminModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Set Hero Creator */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Hero Spotlight Creator</label>
              <select
                value={editHeroId}
                onChange={(e) => setEditHeroId(e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs font-semibold outline-none"
              >
                <option value="">Auto (Top Ranked Live / Follower)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.handle}) - {m.followers?.toLocaleString() || 0} followers
                  </option>
                ))}
              </select>
            </div>

            {/* Hero Quote */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Hero Spotlight Reason / Quote</label>
              <textarea
                value={editHeroQuote}
                onChange={(e) => setEditHeroQuote(e.target.value)}
                rows={2}
                placeholder="Why they're featured..."
                className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs outline-none"
              />
            </div>

            <hr className="border-border" />

            {/* Feature New Creator Card */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-amber-400">Feature a Creator in the Weekly Grid</h4>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Select Creator</label>
                <select
                  value={editSelectedCreatorId}
                  onChange={(e) => setEditSelectedCreatorId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="">-- Choose a creator to feature --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.handle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Category</label>
                  <select
                    value={editCreatorCategory}
                    onChange={(e) => setEditCreatorCategory(e.target.value as FeaturedCategory)}
                    className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs font-semibold outline-none"
                  >
                    <option value="gaming">🎮 Gaming</option>
                    <option value="conversation">🎙 Conversation</option>
                    <option value="music">🎵 Music</option>
                    <option value="irl">🌍 IRL</option>
                    <option value="breakout">🚀 Breakout</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Duration</label>
                  <select
                    value={editDurationDays}
                    onChange={(e) => setEditDurationDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs font-semibold outline-none"
                  >
                    <option value={1}>24 Hours</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Growth Tag</label>
                  <input
                    value={editCreatorGrowth}
                    onChange={(e) => setEditCreatorGrowth(e.target.value)}
                    placeholder="+128%"
                    className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">StreamCore Rank</label>
                  <input
                    type="number"
                    value={editCreatorRank}
                    onChange={(e) => setEditCreatorRank(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Spotlight Description</label>
                <input
                  value={editCreatorQuote}
                  onChange={(e) => setEditCreatorQuote(e.target.value)}
                  placeholder="One of the fastest-growing creators this month..."
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setAdminModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={saveAdminSettings}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black hover:bg-amber-400"
              >
                Save Spotlight Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
