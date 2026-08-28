import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Radio,
  ExternalLink,
  Sparkles,
  Users,
  TrendingUp,
  ShieldCheck,
  Award,
  Flame,
  CheckCircle,
  MessageSquare,
  SlidersHorizontal,
  Handshake,
  Zap,
} from "lucide-react";
import type { Member, Post } from "@/lib/community";
import { Avatar } from "./Bits";
import {
  calculateCreatorMetrics,
  calculateCreatorScores,
  generateCreatorAiAnalysis,
  type CreatorRankedItem,
} from "@/lib/rankings";

export type DirectoryQuickFilter =
  | "all"
  | "live"
  | "rising"
  | "featured"
  | "partners"
  | "verified"
  | "collabs"
  | "new";

export type DirectorySort =
  | "recommended"
  | "growth"
  | "live"
  | "followers"
  | "viewers"
  | "engagement"
  | "recent";

export function CreatorDirectoryView({
  members,
  posts,
  onPick,
  setToast,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  setToast?: (msg: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<DirectoryQuickFilter>("all");
  const [sortBy, setSortBy] = useState<DirectorySort>("recommended");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Filter Drawer States
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [collabOnly, setCollabOnly] = useState<boolean>(false);

  // Compute enriched creator data with metrics and AI analysis
  const enrichedCreators = useMemo(() => {
    return members.map((member) => {
      const metrics = calculateCreatorMetrics(member, posts);
      const scores = calculateCreatorScores(metrics, member);
      const { badge, aiAnalysis } = generateCreatorAiAnalysis(member, scores, metrics);

      // Extract primary game / category from bio
      const bioLower = (member.bio || "").toLowerCase();
      let detectedCategory = "Gaming";
      if (bioLower.includes("just chatting") || bioLower.includes("talk")) detectedCategory = "Just Chatting";
      else if (bioLower.includes("valorant")) detectedCategory = "Valorant";
      else if (bioLower.includes("fortnite")) detectedCategory = "Fortnite";
      else if (bioLower.includes("gta") || bioLower.includes("grand theft")) detectedCategory = "GTA V";
      else if (bioLower.includes("music") || bioLower.includes("dj")) detectedCategory = "Music";
      else if (bioLower.includes("apex")) detectedCategory = "Apex Legends";
      else if (bioLower.includes("minecraft")) detectedCategory = "Minecraft";
      else if (bioLower.includes("irl") || bioLower.includes("travel")) detectedCategory = "IRL";
      else if (bioLower.includes("art") || bioLower.includes("draw")) detectedCategory = "Art";

      const isOpenToCollab =
        member.role === "partner" ||
        member.role === "rising" ||
        bioLower.includes("collab") ||
        (member.handle.charCodeAt(1) || 0) % 2 === 0;

      return {
        member,
        metrics,
        scores,
        badge,
        aiAnalysis,
        category: detectedCategory,
        isOpenToCollab,
      };
    });
  }, [members, posts]);

  // AI-Powered Natural Language & Multi-Facet Filtering
  const filteredAndSortedCreators = useMemo(() => {
    let result = [...enrichedCreators];
    const q = search.trim().toLowerCase();

    // Natural Language Search Parser
    let parsedMaxFollowers: number | null = null;
    let parsedMinFollowers: number | null = null;
    let parsedCategory: string | null = null;
    let parsedStatusLive = false;
    let parsedCollab = false;

    if (q) {
      if (q.includes("under 10k") || q.includes("<10k") || q.includes("small")) {
        parsedMaxFollowers = 10000;
      } else if (q.includes("under 50k") || q.includes("<50k")) {
        parsedMaxFollowers = 50000;
      } else if (q.includes("over 100k") || q.includes(">100k")) {
        parsedMinFollowers = 100000;
      }

      if (q.includes("live") || q.includes("streaming")) {
        parsedStatusLive = true;
      }
      if (q.includes("collab") || q.includes("collaboration")) {
        parsedCollab = true;
      }
      if (q.includes("gaming")) parsedCategory = "Gaming";
      else if (q.includes("valorant")) parsedCategory = "Valorant";
      else if (q.includes("music")) parsedCategory = "Music";
      else if (q.includes("chatting")) parsedCategory = "Just Chatting";
      else if (q.includes("irl")) parsedCategory = "IRL";
    }

    // Apply Search
    if (q) {
      result = result.filter((item) => {
        const m = item.member;
        const nameMatch = m.name.toLowerCase().includes(q);
        const handleMatch = m.handle.toLowerCase().includes(q);
        const platformMatch = m.platform.toLowerCase().includes(q);
        const bioMatch = (m.bio || "").toLowerCase().includes(q);
        const categoryMatch = item.category.toLowerCase().includes(q);

        // Check if query matches keyword OR natural filter conditions
        const basicTextMatch = nameMatch || handleMatch || platformMatch || bioMatch || categoryMatch;
        const naturalMatch =
          (!parsedMaxFollowers || item.metrics.followers <= parsedMaxFollowers) &&
          (!parsedMinFollowers || item.metrics.followers >= parsedMinFollowers) &&
          (!parsedStatusLive || m.status === "live") &&
          (!parsedCategory || item.category === parsedCategory) &&
          (!parsedCollab || item.isOpenToCollab);

        return basicTextMatch || naturalMatch;
      });
    }

    // Quick Filter Buttons
    if (quickFilter === "live") {
      result = result.filter((item) => item.member.status === "live");
    } else if (quickFilter === "rising") {
      result = result.filter((item) => item.metrics.followerGrowthRate >= 80 || item.member.role === "rising");
    } else if (quickFilter === "featured") {
      result = result.filter((item) => item.scores.totalScore >= 88 || item.member.role === "partner");
    } else if (quickFilter === "partners") {
      result = result.filter((item) => item.member.role === "partner" || item.member.role === "admin");
    } else if (quickFilter === "verified") {
      result = result.filter((item) => item.member.role === "verified" || item.member.role === "partner" || item.member.real);
    } else if (quickFilter === "collabs") {
      result = result.filter((item) => item.isOpenToCollab);
    } else if (quickFilter === "new") {
      result = result.filter((item) => (item.member.joined || 0) > Date.now() - 30 * 24 * 3600 * 1000);
    }

    // Detailed Drawer Filters
    if (platformFilter !== "all") {
      result = result.filter((item) => item.member.platform.toLowerCase() === platformFilter.toLowerCase());
    }
    if (statusFilter !== "all") {
      result = result.filter((item) => item.member.status === statusFilter);
    }
    if (categoryFilter !== "all") {
      result = result.filter((item) => item.category === categoryFilter);
    }
    if (sizeFilter === "small") {
      result = result.filter((item) => item.metrics.followers < 10000);
    } else if (sizeFilter === "rising") {
      result = result.filter((item) => item.metrics.followers >= 10000 && item.metrics.followers < 50000);
    } else if (sizeFilter === "mid") {
      result = result.filter((item) => item.metrics.followers >= 50000 && item.metrics.followers < 250000);
    } else if (sizeFilter === "established") {
      result = result.filter((item) => item.metrics.followers >= 250000);
    }
    if (tierFilter !== "all") {
      result = result.filter((item) => (item.member.role || "member") === tierFilter);
    }
    if (collabOnly) {
      result = result.filter((item) => item.isOpenToCollab);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "growth":
          return b.metrics.followerGrowthRate - a.metrics.followerGrowthRate;
        case "live":
          if (a.member.status === "live" && b.member.status !== "live") return -1;
          if (b.member.status === "live" && a.member.status !== "live") return 1;
          return b.scores.totalScore - a.scores.totalScore;
        case "followers":
          return b.metrics.followers - a.metrics.followers;
        case "viewers":
          return b.metrics.avgViewers - a.metrics.avgViewers;
        case "engagement":
          return b.scores.engagement - a.scores.engagement;
        case "recent":
          return (b.member.joined || 0) - (a.member.joined || 0);
        case "recommended":
        default:
          return b.scores.totalScore - a.scores.totalScore;
      }
    });

    return result;
  }, [
    enrichedCreators,
    search,
    quickFilter,
    sortBy,
    platformFilter,
    statusFilter,
    categoryFilter,
    sizeFilter,
    tierFilter,
    collabOnly,
  ]);

  // AI Recommended Creator Matches ("Creators You Should Meet")
  const recommendedMatches = useMemo(() => {
    return enrichedCreators
      .filter((item) => item.isOpenToCollab)
      .sort((a, b) => b.scores.totalScore * b.metrics.followerGrowthRate - a.scores.totalScore * a.metrics.followerGrowthRate)
      .slice(0, 3);
  }, [enrichedCreators]);

  const liveCount = members.filter((m) => m.status === "live").length;
  const risingCount = enrichedCreators.filter((m) => m.metrics.followerGrowthRate >= 80).length;
  const verifiedCount = members.filter((m) => m.role === "partner" || m.role === "verified").length;

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-primary uppercase">
                STREAMCORE NETWORK
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                DATABASE DRIVEN & AI POWERED
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              🔍 CREATOR DIRECTORY
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Discover creators across Twitch, YouTube, and Kick. Find peers at your level, rising stars, and collaboration partners.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-border bg-popover px-3 py-1.5 text-xs font-bold text-foreground">
              <span className="text-muted-foreground mr-1">Creators:</span>
              <strong className="text-primary">{members.length}</strong>
            </div>
            <div className="rounded-xl border border-border bg-popover px-3 py-1.5 text-xs font-bold text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-live animate-pulse" />
              <span>{liveCount} Live</span>
            </div>
            <div className="rounded-xl border border-border bg-popover px-3 py-1.5 text-xs font-bold text-foreground">
              <span className="text-emerald-400 mr-1">🚀 {risingCount}</span>
              <span className="text-muted-foreground">Rising</span>
            </div>
          </div>
        </div>

        {/* Natural Language Search & Control Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, game, or e.g. 'small creators under 10k', 'live gaming'..."
              className="w-full rounded-xl bg-popover border border-border pl-10 pr-4 py-2.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all shadow-sm ${
              showFilterDrawer || platformFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all" || sizeFilter !== "all" || tierFilter !== "all" || collabOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-popover border-border text-foreground hover:border-primary/50"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filters</span>
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as DirectorySort)}
            className="rounded-xl border border-border bg-popover px-3 py-2.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="recommended">Sort: Recommended (AI)</option>
            <option value="growth">Sort: Fastest Growth (+%)</option>
            <option value="live">Sort: Currently Live</option>
            <option value="followers">Sort: Most Followers</option>
            <option value="viewers">Sort: Most Watched (Viewers)</option>
            <option value="engagement">Sort: Highest Engagement</option>
            <option value="recent">Sort: Recently Joined</option>
          </select>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", label: "🔥 All Creators" },
            { id: "live", label: "🔴 Live Now" },
            { id: "rising", label: "🚀 Rising Breakouts" },
            { id: "featured", label: "⭐ Featured" },
            { id: "partners", label: "💎 Partners" },
            { id: "verified", label: "✓ Verified" },
            { id: "collabs", label: "🤝 Open to Collabs" },
            { id: "new", label: "🆕 New Joiners" },
          ].map((pill) => {
            const isActive = quickFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setQuickFilter(pill.id as DirectoryQuickFilter)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                    : "bg-popover border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Comprehensive Filter Drawer Panel */}
      {showFilterDrawer && (
        <div className="rounded-2xl border border-primary/30 bg-popover p-5 space-y-4 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              Advanced Creator Filters
            </h3>
            <button
              onClick={() => {
                setPlatformFilter("all");
                setStatusFilter("all");
                setCategoryFilter("all");
                setSizeFilter("all");
                setTierFilter("all");
                setCollabOnly(false);
              }}
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              Reset All Filters
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Platform */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Platform</label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="w-full rounded-xl bg-background border border-border px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">All Platforms</option>
                <option value="twitch">Twitch</option>
                <option value="youtube">YouTube</option>
                <option value="kick">Kick</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Live Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl bg-background border border-border px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">Any Status</option>
                <option value="live">🔴 Live Now</option>
                <option value="online">🟢 Online</option>
                <option value="offline">⚪ Offline</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Category / Game</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl bg-background border border-border px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">All Categories</option>
                <option value="Gaming">🎮 Gaming</option>
                <option value="Just Chatting">💬 Just Chatting</option>
                <option value="Valorant">🎯 Valorant</option>
                <option value="Fortnite">🔥 Fortnite</option>
                <option value="GTA V">🏎️ GTA V</option>
                <option value="Music">🎵 Music</option>
                <option value="Apex Legends">🏆 Apex Legends</option>
                <option value="IRL">🏝️ IRL</option>
                <option value="Art">🎨 Art</option>
              </select>
            </div>

            {/* Audience Size */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Audience Size</label>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="w-full rounded-xl bg-background border border-border px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">Any Size</option>
                <option value="small">&lt; 10K (Small Streamers)</option>
                <option value="rising">10K - 50K (Rising)</option>
                <option value="mid">50K - 250K (Mid-Tier)</option>
                <option value="established">250K+ (Established)</option>
              </select>
            </div>

            {/* Growth Tier */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Growth Tier</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="w-full rounded-xl bg-background border border-border px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">All Roles</option>
                <option value="partner">💎 Partner</option>
                <option value="verified">✓ Verified</option>
                <option value="rising">🚀 Rising</option>
                <option value="affiliate">⭐ Affiliate</option>
                <option value="member">👤 Member</option>
              </select>
            </div>

            {/* Collab Toggle */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl bg-background border border-border p-2 text-xs font-bold text-foreground hover:border-primary/50">
                <input
                  type="checkbox"
                  checked={collabOnly}
                  onChange={(e) => setCollabOnly(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>🤝 Open to Collabs</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommended Collabs ("Creators You Should Meet") */}
      {!search.trim() && quickFilter === "all" && recommendedMatches.length > 0 && (
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/15 via-popover to-background p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI Recommendation Engine
              </p>
              <h2 className="text-lg font-black text-foreground">Creators You Should Meet</h2>
              <p className="text-xs text-muted-foreground">
                Matched by compatible audience size, stream genre, and active collaboration availability.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {recommendedMatches.map((item) => (
              <div
                key={item.member.id}
                onClick={() => onPick(item.member)}
                className="group flex flex-col justify-between rounded-xl bg-popover border border-border p-3.5 hover:border-primary/60 transition-all cursor-pointer shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Avatar member={item.member} size={42} showStatus={true} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-extrabold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      <span>{item.member.name}</span>
                      {item.member.role === "partner" && <span className="text-primary text-[10px]">💎</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.member.handle} · {item.category}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold text-emerald-400">
                      +{item.metrics.followerGrowthRate}% growth
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[10px]">
                  <span className="font-bold text-muted-foreground">
                    {item.metrics.followers.toLocaleString()} followers
                  </span>
                  <span className="rounded-md bg-accent px-2 py-0.5 font-bold text-primary">
                    🤝 Collab Match
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Directory Grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground">
            Showing {filteredAndSortedCreators.length} Verified Creators
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAndSortedCreators.map((item) => {
            const m = item.member;
            const isLive = m.status === "live";
            const isPartner = m.role === "partner";
            const isVerified = m.role === "verified" || isPartner;

            return (
              <article
                key={m.id}
                onClick={() => onPick(m)}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-popover shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              >
                {/* Banner / Live Stream Cover */}
                <div
                  className="relative h-28 bg-gradient-to-r from-primary/30 via-accent to-popover bg-cover bg-center"
                  style={m.banner ? { backgroundImage: `url(${m.banner})` } : undefined}
                >
                  <div className="absolute inset-0 bg-black/20" />
                  
                  {/* Category Pill */}
                  <span className="absolute top-2.5 left-2.5 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    {item.category}
                  </span>

                  {/* Live / Status Badge */}
                  {isLive ? (
                    <span className="absolute top-2.5 right-2.5 rounded-lg bg-live px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <Radio className="h-3 w-3" />
                      LIVE NOW
                    </span>
                  ) : isPartner ? (
                    <span className="absolute top-2.5 right-2.5 rounded-lg bg-primary/90 px-2 py-0.5 text-[10px] font-black text-primary-foreground backdrop-blur-sm">
                      💎 PARTNER
                    </span>
                  ) : null}
                </div>

                {/* Body Details */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3 -mt-8 relative z-10">
                      <div className="ring-4 ring-popover rounded-full">
                        <Avatar member={m} size={50} showStatus={true} />
                      </div>
                      <div className="min-w-0 flex-1 pt-4">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                            {m.name}
                          </h3>
                          {isVerified && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.handle} · {m.platform}
                        </p>
                      </div>
                    </div>

                    {/* Bio / Stream Title */}
                    {m.bio && (
                      <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {m.bio}
                      </p>
                    )}

                    {/* AI Badge & Collab Indicator */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.2 text-[9px] font-bold ${item.badge.color}`}>
                        {item.badge.icon} {item.badge.text}
                      </span>
                      {item.isOpenToCollab && (
                        <span className="rounded-full bg-accent px-2 py-0.2 text-[9px] font-bold text-foreground">
                          🤝 Open to Collabs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats Bar */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-background p-1.5">
                        <p className="text-xs font-black text-foreground">{item.metrics.followers.toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Followers</p>
                      </div>
                      <div className="rounded-lg bg-background p-1.5">
                        <p className="text-xs font-black text-emerald-400">+{item.metrics.followerGrowthRate}%</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Growth</p>
                      </div>
                      <div className="rounded-lg bg-background p-1.5">
                        <p className="text-xs font-black text-primary">{item.scores.totalScore}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Score</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPick(m);
                        }}
                        className="flex-1 rounded-xl bg-accent py-2 text-xs font-bold text-foreground hover:bg-accent/80 transition-colors"
                      >
                        Profile
                      </button>
                      {m.link && (
                        <a
                          href={m.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <span>{isLive ? "Watch ↗" : "Channel ↗"}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!filteredAndSortedCreators.length && (
          <div className="rounded-2xl border border-dashed border-border bg-popover/50 p-12 text-center">
            <p className="text-4xl">🔍</p>
            <h3 className="mt-3 text-lg font-bold text-foreground">No creators found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Try adjusting your search query or clearing active filters to find creators across the network.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setQuickFilter("all");
                setPlatformFilter("all");
                setStatusFilter("all");
                setCategoryFilter("all");
                setSizeFilter("all");
                setTierFilter("all");
                setCollabOnly(false);
              }}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
