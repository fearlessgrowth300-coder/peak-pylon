import { useState, useMemo } from "react";
import {
  Trophy,
  TrendingUp,
  Eye,
  MessageSquare,
  Sparkles,
  Film,
  Activity,
  Search,
  ChevronUp,
  ChevronDown,
  Minus,
  Info,
  Radio,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import type { Member, Post } from "@/lib/community";
import { Avatar } from "./Bits";
import {
  computeRankings,
  type CreatorRankedItem,
  type RankingCategory,
} from "@/lib/rankings";

export function CreatorRankingsView({
  members,
  posts,
  onPick,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
}) {
  const [category, setCategory] = useState<RankingCategory>("overall");
  const [search, setSearch] = useState("");
  const [timeframe, setTimeframe] = useState<"week" | "month" | "all">("week");
  const [inspectedItem, setInspectedItem] = useState<CreatorRankedItem | null>(null);
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  const rankedCreators = useMemo(() => {
    return computeRankings(members, posts, category);
  }, [members, posts, category]);

  const filteredRankings = useMemo(() => {
    if (!search.trim()) return rankedCreators;
    const q = search.toLowerCase();
    return rankedCreators.filter(
      (r) =>
        r.member.name.toLowerCase().includes(q) ||
        r.member.handle.toLowerCase().includes(q) ||
        r.member.platform.toLowerCase().includes(q)
    );
  }, [rankedCreators, search]);

  const topThree = rankedCreators.slice(0, 3);

  const categoryTabs: { id: RankingCategory; label: string; icon: any; desc: string }[] = [
    { id: "overall", label: "🏆 Overall", icon: Trophy, desc: "Best overall creators according to the transparent multi-metric scoring model." },
    { id: "rising", label: "📈 Rising Creators", icon: TrendingUp, desc: "Small and mid-sized creators showing extraordinary breakout growth." },
    { id: "growing", label: "🚀 Fastest Growing", icon: Sparkles, desc: "Creators gaining followers and audience percentage fastest." },
    { id: "watched", label: "👁 Most Watched", icon: Eye, desc: "Highest average viewer performance and watch hours." },
    { id: "engaged", label: "💬 Most Engaged", icon: MessageSquare, desc: "Best community reactions, chat activity, and discussion responses." },
    { id: "content", label: "🎬 Top Content", icon: Film, desc: "Creators whose clips, highlights, and posts perform best." },
    { id: "active", label: "🟢 Most Active", icon: Activity, desc: "Most consistent broadcast schedule and daily StreamCore participation." },
  ];

  const currentTab = categoryTabs.find((t) => t.id === category)!;

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-primary uppercase">
                STREAMCORE ANALYTICS ENGINE
              </span>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                v2.0 TRANSPARENT RANKINGS
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              🏆 CREATOR RANKINGS
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              {currentTab.desc}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFormulaInfo(!showFormulaInfo)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-popover px-3.5 py-2 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors shadow-sm"
            >
              <Info className="h-4 w-4 text-primary" />
              <span>How Scoring Works</span>
            </button>
            <div className="flex rounded-xl bg-popover p-1 border border-border">
              {(["week", "month", "all"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-all ${
                    timeframe === tf
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tf === "week" ? "This Week" : tf === "month" ? "This Month" : "All Time"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* How Scoring Works Interactive Breakdown Banner */}
        {showFormulaInfo && (
          <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-popover to-background p-5 text-xs animate-in fade-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                  <span>🧠</span> 100-Point Transparent Scoring Engine
                </h3>
                <p className="mt-1 text-muted-foreground">
                  StreamCore calculates scores mathematically from real creator signals—no black boxes or bias.
                </p>
              </div>
              <button
                onClick={() => setShowFormulaInfo(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <p className="text-base font-black text-primary">25%</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Audience Growth</p>
                <p className="text-[9px] text-muted-foreground/80 mt-1">Follower gain & growth rate</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <p className="text-base font-black text-blue-400">20%</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Viewer Performance</p>
                <p className="text-[9px] text-muted-foreground/80 mt-1">Avg, peak & live viewers</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <p className="text-base font-black text-purple-400">20%</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Engagement</p>
                <p className="text-[9px] text-muted-foreground/80 mt-1">Chat & community reactions</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <p className="text-base font-black text-emerald-400">15%</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Consistency</p>
                <p className="text-[9px] text-muted-foreground/80 mt-1">Stream schedule & duration</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <p className="text-base font-black text-amber-400">10%</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Community Activity</p>
                <p className="text-[9px] text-muted-foreground/80 mt-1">Posts, comments & replies</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <p className="text-base font-black text-rose-400">10%</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">Content Performance</p>
                <p className="text-[9px] text-muted-foreground/80 mt-1">Clips, shares & viral score</p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categoryTabs.map((tab) => {
          const isActive = category === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-[1.02]"
                  : "bg-popover border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Top 3 Podium Cards */}
      {topThree.length >= 3 && !search.trim() && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Silver #2 */}
          <div
            onClick={() => setInspectedItem(topThree[1]!)}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-popover p-5 transition-all hover:border-zinc-400 cursor-pointer order-2 sm:order-1"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-400/20 text-xs font-black text-zinc-300">
                  🥈 #2
                </span>
                <span className="text-[10px] font-bold text-zinc-400">RUNNER-UP</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                <ChevronUp className="h-3.5 w-3.5" />
                <span>{Math.abs(topThree[1]!.rankDelta) || 1}</span>
              </div>
            </div>

            <div className="my-4 text-center">
              <div className="mx-auto w-fit relative">
                <Avatar member={topThree[1]!.member} size={64} showStatus={true} />
              </div>
              <h3 className="mt-3 font-extrabold text-base text-foreground truncate">{topThree[1]!.member.name}</h3>
              <p className="text-xs text-muted-foreground">{topThree[1]!.member.handle}</p>
              <span className={`inline-block mt-2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${topThree[1]!.badge.color}`}>
                {topThree[1]!.badge.icon} {topThree[1]!.badge.text}
              </span>
            </div>

            <div className="rounded-xl bg-background p-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">StreamCore Score</span>
              <span className="text-base font-black text-foreground">{topThree[1]!.scores.totalScore}</span>
            </div>
          </div>

          {/* Gold #1 */}
          <div
            onClick={() => setInspectedItem(topThree[0]!)}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-amber-500/60 bg-gradient-to-b from-amber-500/10 via-popover to-popover p-5 transition-all hover:border-amber-400 shadow-lg shadow-amber-500/10 cursor-pointer order-1 sm:order-2 sm:-translate-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-500/30 text-xs font-black text-amber-300">
                  🥇 #1
                </span>
                <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase">CHAMPION</span>
              </div>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                TOP RANKED
              </span>
            </div>

            <div className="my-4 text-center">
              <div className="mx-auto w-fit relative ring-4 ring-amber-500/30 rounded-full">
                <Avatar member={topThree[0]!.member} size={76} showStatus={true} />
              </div>
              <h3 className="mt-3 font-black text-lg text-foreground truncate">{topThree[0]!.member.name}</h3>
              <p className="text-xs text-muted-foreground">{topThree[0]!.member.handle}</p>
              <span className={`inline-block mt-2 rounded-full border px-3 py-0.5 text-[10px] font-black ${topThree[0]!.badge.color}`}>
                {topThree[0]!.badge.icon} {topThree[0]!.badge.text}
              </span>
            </div>

            <div className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300">StreamCore Score</span>
              <span className="text-xl font-black text-amber-400">{topThree[0]!.scores.totalScore}</span>
            </div>
          </div>

          {/* Bronze #3 */}
          <div
            onClick={() => setInspectedItem(topThree[2]!)}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-popover p-5 transition-all hover:border-amber-700 cursor-pointer order-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-700/20 text-xs font-black text-amber-500">
                  🥉 #3
                </span>
                <span className="text-[10px] font-bold text-amber-600">3RD PLACE</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                <Minus className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="my-4 text-center">
              <div className="mx-auto w-fit relative">
                <Avatar member={topThree[2]!.member} size={64} showStatus={true} />
              </div>
              <h3 className="mt-3 font-extrabold text-base text-foreground truncate">{topThree[2]!.member.name}</h3>
              <p className="text-xs text-muted-foreground">{topThree[2]!.member.handle}</p>
              <span className={`inline-block mt-2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${topThree[2]!.badge.color}`}>
                {topThree[2]!.badge.icon} {topThree[2]!.badge.text}
              </span>
            </div>

            <div className="rounded-xl bg-background p-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">StreamCore Score</span>
              <span className="text-base font-black text-foreground">{topThree[2]!.scores.totalScore}</span>
            </div>
          </div>
        </div>
      )}

      {/* Search & Total count */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creator by name or handle..."
            className="w-full rounded-xl bg-popover border border-border pl-10 pr-4 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <p className="text-xs font-bold text-muted-foreground">
          Showing {filteredRankings.length} Ranked Creators
        </p>
      </div>

      {/* Full Leaderboard Table / Cards */}
      <div className="space-y-2.5">
        {filteredRankings.map((item) => {
          const isTop3 = item.rank <= 3;
          const isLive = item.member.status === "live";

          return (
            <div
              key={item.member.id}
              onClick={() => setInspectedItem(item)}
              className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-popover p-4 shadow-sm transition-all hover:border-primary/50 hover:bg-accent/40 cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Rank Pill */}
                <div className="flex flex-col items-center justify-center w-10 shrink-0">
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-xl text-sm font-black ${
                      item.rank === 1
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : item.rank === 2
                          ? "bg-zinc-400/20 text-zinc-300 border border-zinc-400/40"
                          : item.rank === 3
                            ? "bg-amber-700/20 text-amber-500 border border-amber-700/40"
                            : "bg-background text-muted-foreground border border-border"
                    }`}
                  >
                    #{item.rank}
                  </span>
                  {/* Delta indicator */}
                  <div className="mt-1 flex items-center text-[10px] font-extrabold">
                    {item.rankDelta > 0 ? (
                      <span className="flex items-center text-emerald-400">
                        <ChevronUp className="h-3 w-3" />
                        {item.rankDelta}
                      </span>
                    ) : item.rankDelta < 0 ? (
                      <span className="flex items-center text-rose-400">
                        <ChevronDown className="h-3 w-3" />
                        {Math.abs(item.rankDelta)}
                      </span>
                    ) : (
                      <span className="flex items-center text-muted-foreground">
                        <Minus className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Avatar & Info */}
                <div className="relative">
                  <Avatar member={item.member} size={46} showStatus={true} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <strong className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                      {item.member.name}
                    </strong>
                    {isLive && (
                      <span className="rounded bg-live px-1.5 py-0.2 text-[9px] font-black text-white uppercase tracking-wider animate-pulse">
                        LIVE
                      </span>
                    )}
                    <span className={`hidden sm:inline-flex rounded-full border px-2 py-0.2 text-[10px] font-bold ${item.badge.color}`}>
                      {item.badge.icon} {item.badge.text}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.member.handle} · {item.member.platform}
                  </p>
                </div>
              </div>

              {/* Key Highlights & Score */}
              <div className="flex items-center gap-4 sm:gap-6 ml-auto">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-extrabold text-foreground">
                    {item.metrics.followers.toLocaleString()} followers
                  </p>
                  <p className="text-[10px] font-bold text-emerald-400">
                    +{item.metrics.followerGrowthRate}% growth
                  </p>
                </div>

                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-foreground">
                    {item.metrics.avgViewers.toLocaleString()} avg viewers
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.metrics.streamFrequencyDays} streams/week
                  </p>
                </div>

                {/* Total Score Badge */}
                <div className="flex flex-col items-center justify-center rounded-xl bg-background border border-border px-3.5 py-1.5 min-w-[72px]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">SCORE</span>
                  <span className="text-base font-black text-primary">
                    {item.scores.totalScore}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectedItem(item);
                  }}
                  className="rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-foreground hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  Scorecard →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparent Scorecard & AI Growth Analysis Modal */}
      {inspectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
          onClick={() => setInspectedItem(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-popover p-6 shadow-2xl border border-border space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Avatar member={inspectedItem.member} size={52} showStatus={true} />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-foreground">{inspectedItem.member.name}</h2>
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                      RANK #{inspectedItem.rank}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inspectedItem.member.handle} · {inspectedItem.member.platform}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedItem(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-bold text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Total Score Banner */}
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary/20 via-popover to-accent p-4 border border-primary/30">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  STREAMCORE SCORE
                </p>
                <p className="text-3xl font-black text-primary">
                  {inspectedItem.scores.totalScore} <span className="text-sm font-bold text-muted-foreground">/ 100</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-foreground">
                  Leaderboard: #{inspectedItem.rank}
                </p>
                <p className="text-xs font-bold text-emerald-400">
                  {inspectedItem.rankDelta > 0
                    ? `↑ ${inspectedItem.rankDelta} positions this week`
                    : inspectedItem.rankDelta < 0
                      ? `↓ ${Math.abs(inspectedItem.rankDelta)} positions`
                      : "─ Steady rank"}
                </p>
              </div>
            </div>

            {/* AI Momentum & Growth Interpretation */}
            <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>🤖</span> AI Growth Interpretation
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${inspectedItem.badge.color}`}>
                  {inspectedItem.badge.icon} {inspectedItem.badge.text}
                </span>
              </div>
              <h4 className="font-extrabold text-sm text-foreground">
                {inspectedItem.aiAnalysis.headline}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {inspectedItem.aiAnalysis.summary}
              </p>
            </div>

            {/* 6-Dimension Transparent Score Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Score Breakdown (100 pts Max)
              </h4>
              <div className="space-y-3">
                {/* 1. Audience Growth (25%) */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">Audience Growth (25%)</span>
                    <span className="font-black text-primary">{inspectedItem.scores.audienceGrowth}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${inspectedItem.scores.audienceGrowth}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {inspectedItem.metrics.followers.toLocaleString()} followers (+{inspectedItem.metrics.followerGrowthRate}% growth rate)
                  </p>
                </div>

                {/* 2. Viewer Performance (20%) */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">Viewer Performance (20%)</span>
                    <span className="font-black text-blue-400">{inspectedItem.scores.viewerPerformance}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${inspectedItem.scores.viewerPerformance}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {inspectedItem.metrics.avgViewers} avg viewers · {inspectedItem.metrics.peakViewers} peak viewers
                  </p>
                </div>

                {/* 3. Engagement (20%) */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">Engagement Rate (20%)</span>
                    <span className="font-black text-purple-400">{inspectedItem.scores.engagement}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-400"
                      style={{ width: `${inspectedItem.scores.engagement}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {inspectedItem.metrics.engagementRate}% viewer interaction · {inspectedItem.metrics.communityReactions} reactions
                  </p>
                </div>

                {/* 4. Consistency (15%) */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">Consistency & Schedule (15%)</span>
                    <span className="font-black text-emerald-400">{inspectedItem.scores.consistency}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${inspectedItem.scores.consistency}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {inspectedItem.metrics.streamFrequencyDays} days/week · {inspectedItem.metrics.hoursStreamed} hours streamed
                  </p>
                </div>

                {/* 5. Community Activity (10%) */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">Community Participation (10%)</span>
                    <span className="font-black text-amber-400">{inspectedItem.scores.communityActivity}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${inspectedItem.scores.communityActivity}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {inspectedItem.metrics.communityPosts} community posts · {inspectedItem.metrics.communityComments} discussion replies
                  </p>
                </div>

                {/* 6. Content Performance (10%) */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">Content & Clip Performance (10%)</span>
                    <span className="font-black text-rose-400">{inspectedItem.scores.contentPerformance}/100</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-400"
                      style={{ width: `${inspectedItem.scores.contentPerformance}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {inspectedItem.metrics.clipsCount} clips · {inspectedItem.metrics.clipViews.toLocaleString()} total views
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <button
                onClick={() => {
                  const m = inspectedItem.member;
                  setInspectedItem(null);
                  onPick(m);
                }}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-foreground hover:bg-accent/80 transition-colors"
              >
                View Full Profile
              </button>
              {inspectedItem.member.link && (
                <a
                  href={inspectedItem.member.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Radio className="h-3.5 w-3.5" />
                  <span>Watch Stream ↗</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
