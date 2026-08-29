import { useState, useMemo } from "react";
import {
  TrendingUp,
  Eye,
  Users,
  MessageSquare,
  Flame,
  Sparkles,
  Award,
  Film,
  FileText,
  Radio,
  Clock,
  Zap,
  Calendar,
  ChevronUp,
  Bot,
  RefreshCw,
  BarChart3,
  Share2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Member, Post } from "@/lib/community";

type TimeRange = "7D" | "30D" | "90D" | "1Y";
type MetricTab = "followers" | "views" | "viewers" | "engagement";

const CHART_DATA_BY_RANGE: Record<TimeRange, Array<{ date: string; followers: number; views: number; viewers: number; engagement: number }>> = {
  "7D": [
    { date: "Mon", followers: 1120, views: 18400, viewers: 420, engagement: 2100 },
    { date: "Tue", followers: 1340, views: 22100, viewers: 510, engagement: 2800 },
    { date: "Wed", followers: 1680, views: 28900, viewers: 680, engagement: 3400 },
    { date: "Thu", followers: 1450, views: 25400, viewers: 590, engagement: 3100 },
    { date: "Fri", followers: 2100, views: 36800, viewers: 890, engagement: 4900 },
    { date: "Sat", followers: 2850, views: 48200, viewers: 1240, engagement: 6800 },
    { date: "Sun", followers: 2421, views: 41200, viewers: 1080, engagement: 5600 },
  ],
  "30D": [
    { date: "Week 1", followers: 1840, views: 38200, viewers: 540, engagement: 4800 },
    { date: "Week 2", followers: 2450, views: 46800, viewers: 720, engagement: 6200 },
    { date: "Week 3", followers: 3120, views: 58400, viewers: 940, engagement: 8100 },
    { date: "Week 4", followers: 4210, views: 79200, viewers: 1280, engagement: 11400 },
  ],
  "90D": [
    { date: "Month 1", followers: 5200, views: 98000, viewers: 480, engagement: 14200 },
    { date: "Month 2", followers: 8900, views: 164000, viewers: 820, engagement: 23600 },
    { date: "Month 3", followers: 14200, views: 284000, viewers: 1340, engagement: 41800 },
  ],
  "1Y": [
    { date: "Q1", followers: 12400, views: 240000, viewers: 410, engagement: 38000 },
    { date: "Q2", followers: 28900, views: 510000, viewers: 780, engagement: 82000 },
    { date: "Q3", followers: 54200, views: 980000, viewers: 1150, engagement: 146000 },
    { date: "Q4", followers: 89400, views: 1680000, viewers: 1620, engagement: 248000 },
  ],
};

export function CreatorAnalyticsView({
  myMember,
  posts,
  setToast,
}: {
  myMember?: Member | null | undefined;
  posts: Post[];
  setToast?: ((msg: string) => void) | undefined;
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30D");
  const [metricTab, setMetricTab] = useState<MetricTab>("followers");
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiInsightsCount, setAiInsightsCount] = useState(4);

  const chartData = CHART_DATA_BY_RANGE[timeRange];

  const summaryMetrics = useMemo(() => {
    switch (timeRange) {
      case "7D":
        return { views: "41,200", followers: "+2,421", engagements: "6.8K", streams: "5", hours: "16.8" };
      case "30D":
        return { views: "184,421", followers: "+8,421", engagements: "24.8K", streams: "18", hours: "62.4" };
      case "90D":
        return { views: "546,400", followers: "+28,320", engagements: "79.6K", streams: "52", hours: "184.2" };
      case "1Y":
        return { views: "3,410,000", followers: "+184,900", engagements: "514K", streams: "210", hours: "740.0" };
    }
  }, [timeRange]);

  const handleRefreshAiAudit = () => {
    setAiAuditLoading(true);
    setTimeout(() => {
      setAiAuditLoading(false);
      setAiInsightsCount(4);
      setToast?.("StreamCore AI intelligence refreshed with latest stream data!");
    }, 900);
  };

  const metricColors: Record<MetricTab, { stroke: string; fill: string; label: string }> = {
    followers: { stroke: "#10b981", fill: "#10b981", label: "Follower Growth" },
    views: { stroke: "#06b6d4", fill: "#06b6d4", label: "Broadcast Views" },
    viewers: { stroke: "#f59e0b", fill: "#f59e0b", label: "Average Concurrent Viewers" },
    engagement: { stroke: "#ec4899", fill: "#ec4899", label: "Chat & Reaction Engagements" },
  };

  return (
    <div className="space-y-8 px-4 py-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <BarChart3 className="h-4 w-4" />
            </span>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
              Personal Intelligence Center
            </p>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
            Creator Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear, actionable intelligence answering: <strong className="text-foreground font-semibold">“Am I growing?”</strong>
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {(["7D", "30D", "90D", "1Y"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-black transition ${
                timeRange === range
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* TOP SUMMARY STATS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            YOUR PERFORMANCE · {timeRange}
          </p>
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            +22.8% vs previous period
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Total Views</span>
              <Eye className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black text-foreground">👁 {summaryMetrics.views}</p>
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <ChevronUp className="h-3 w-3" /> +14.2% organic impressions
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">New Followers</span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">👥 {summaryMetrics.followers}</p>
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <ChevronUp className="h-3 w-3" /> +22.8% net follower growth
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Engagements</span>
              <MessageSquare className="h-4 w-4 text-pink-400" />
            </div>
            <p className="text-2xl font-black text-foreground">💬 {summaryMetrics.engagements}</p>
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <ChevronUp className="h-3 w-3" /> 8.4% chat conversion rate
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Streams Completed</span>
              <Flame className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-foreground">🔥 {summaryMetrics.streams} streams</p>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {summaryMetrics.hours} hrs broadcasted
            </p>
          </div>
        </div>
      </section>

      {/* GROWTH GRAPH WITH METRIC SELECTOR */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Growth Trajectory
            </h2>
            <p className="text-xs text-muted-foreground">
              Visualizing performance across your selected time window.
            </p>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {(
              [
                { id: "followers", label: "Followers" },
                { id: "views", label: "Views" },
                { id: "viewers", label: "Avg Viewers" },
                { id: "engagement", label: "Engagement" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMetricTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  metricTab === tab.id
                    ? "bg-accent font-extrabold text-foreground border border-border shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricColors[metricTab].stroke} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={metricColors[metricTab].stroke} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
              <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  borderColor: "#3f3f46",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Area
                type="monotone"
                dataKey={metricTab}
                stroke={metricColors[metricTab].stroke}
                strokeWidth={3}
                fill="url(#metricGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* STREAMCORE AI INSIGHTS */}
      <section className="relative overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-br from-card via-purple-950/20 to-card p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                🤖 STREAMCORE AI INSIGHT
                <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] font-black text-purple-300">
                  REALTIME INTELLIGENCE
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Algorithmic recommendations tailored to your category benchmarks.
              </p>
            </div>
          </div>

          <button
            onClick={handleRefreshAiAudit}
            disabled={aiAuditLoading}
            className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-3.5 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${aiAuditLoading ? "animate-spin" : ""}`} />
            {aiAuditLoading ? "Analyzing Stream Data..." : "Refresh AI Audit"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1.5">
            <p className="text-[11px] font-extrabold uppercase text-purple-400">Growth Velocity</p>
            <p className="text-sm font-bold text-foreground leading-snug">
              You're growing faster than <span className="text-emerald-400 font-extrabold">82% of creators</span> in your category.
            </p>
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1.5">
            <p className="text-[11px] font-extrabold uppercase text-purple-400">Strongest Category</p>
            <p className="text-sm font-bold text-foreground leading-snug">
              <span className="text-cyan-300 font-extrabold">Valorant</span> generates 4.2x higher chat participation than variety streams.
            </p>
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1.5">
            <p className="text-[11px] font-extrabold uppercase text-purple-400">Prime Broadcast Window</p>
            <p className="text-sm font-bold text-foreground leading-snug">
              Best time to stream: <span className="text-amber-300 font-extrabold">8 PM – 11 PM UTC</span> (US & EU crossover peak).
            </p>
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1.5">
            <p className="text-[11px] font-extrabold uppercase text-purple-400">Clip Momentum</p>
            <p className="text-sm font-bold text-foreground leading-snug">
              Your clips are getting <span className="text-pink-400 font-extrabold">46% more engagement</span> than last month.
            </p>
          </div>
        </div>
      </section>

      {/* CONTENT PERFORMANCE & CREATOR RANKINGS GRID */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CONTENT PERFORMANCE */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              TOP PERFORMING CONTENT
            </h3>
            <span className="text-xs font-bold text-muted-foreground">{timeRange}</span>
          </div>

          <div className="space-y-3">
            {/* Top Clip */}
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-accent/30 p-4 transition hover:bg-accent/60">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Film className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-cyan-400 uppercase">🎬 Clip</span>
                    <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-[260px]">
                      "Unreal 1v5 clutch on Haven"
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">4.8K shares · 920 chat clips</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-cyan-300">284K</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Views</p>
              </div>
            </div>

            {/* Top Post */}
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-accent/30 p-4 transition hover:bg-accent/60">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-pink-400 uppercase">📝 Post</span>
                    <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-[260px]">
                      "Tournament announcement & squad reveal"
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">892 comments · 410 re-shares</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-pink-300">14.2K</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Reactions</p>
              </div>
            </div>

            {/* Top Stream */}
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-accent/30 p-4 transition hover:bg-accent/60">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                  <Radio className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-rose-400 uppercase">🔴 Stream</span>
                    <span className="text-xs font-bold text-foreground truncate max-w-[180px] sm:max-w-[260px]">
                      "24-Hour Marathon Stream"
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">1,420 new followers acquired</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-rose-400">8.4K</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Peak Viewers</p>
              </div>
            </div>
          </div>
        </section>

        {/* CREATOR RANKING BREAKDOWN */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              🏆 YOUR RANK BREAKDOWN
            </h3>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
              🔥 Rising Rapidly
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/80 bg-accent/30 p-4 space-y-1">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Overall StreamCore</p>
              <p className="text-2xl font-black text-foreground">#842</p>
              <p className="text-[10px] font-semibold text-emerald-400">Top 3% of all creators</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-accent/30 p-4 space-y-1">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Gaming Category</p>
              <p className="text-2xl font-black text-foreground">#214</p>
              <p className="text-[10px] font-semibold text-emerald-400">Top 2.1% in FPS / Gaming</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-accent/30 p-4 space-y-1">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Regional (Nigeria / Africa)</p>
              <p className="text-2xl font-black text-cyan-300">#38</p>
              <p className="text-[10px] font-semibold text-cyan-400">Regional Leaderboard</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1">
              <p className="text-[11px] font-bold uppercase text-amber-400">Rising Creators</p>
              <p className="text-2xl font-black text-amber-300">#17</p>
              <p className="text-[10px] font-extrabold text-emerald-400">▲ +4 spots this week!</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-accent/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Tip: Keep up consistent stream schedules to break into the <strong className="text-foreground">Top #10 Rising Creators</strong>!
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
