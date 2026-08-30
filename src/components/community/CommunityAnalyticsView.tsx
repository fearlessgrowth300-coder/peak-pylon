import { useState, useMemo } from "react";
import {
  Globe,
  Users,
  Eye,
  Flame,
  Radio,
  Sparkles,
  TrendingUp,
  Award,
  Layers,
  MessageSquare,
  ShieldCheck,
  Zap,
  BarChart3,
  Calendar,
  ChevronUp,
  PieChart as PieIcon,
  Shield,
  Activity,
  Search,
  Filter,
  CheckCircle,
  Gem,
  Rocket,
  Bot,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Member, Post } from "@/lib/community";

type CommunityTab =
  | "overview"
  | "creators"
  | "categories"
  | "geography"
  | "engagement"
  | "moderation";

export function CommunityAnalyticsView({
  members,
  posts,
  setToast,
}: {
  members: Member[];
  posts: Post[];
  setToast?: ((msg: string) => void) | undefined;
}) {
  const [tab, setTab] = useState<CommunityTab>("overview");
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "1Y">("30D");

  // Real data calculations derived directly from live database state
  const realTotalMembers = members.length;
  const recentlyActiveIds = new Set([
    ...members.filter((member) => member.status === "live").map((member) => member.id),
    ...posts.filter((post) => post.time >= Date.now() - 15 * 60_000).map((post) => post.authorId),
  ]);
  const realOnlineMembers = recentlyActiveIds.size;
  const realLiveStreams = members.filter((m) => m.status === "live").length;
  const realPartners = members.filter((m) => m.role === "partner" || m.role === "admin").length;
  const realTotalPosts = posts.length;
  const realAutomatedPosts = posts.filter((p) => p.aiGenerated).length;
  const realClips = posts.filter((p) => Boolean(p.video || p.channel === "clips")).length;
  const realDiscussions = posts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0);

  const realTotalReactions = useMemo(() => {
    return posts.reduce((sum, p) => {
      const rxCount = Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
      return sum + rxCount;
    }, 0);
  }, [posts]);

  // Dynamic category extraction from live creators
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    members.filter((member) => member.status === "live" && Boolean(member.gameName?.trim())).forEach((member) => {
      const category = member.gameName!.trim();
      counts[category] = (counts[category] || 0) + 1;
    });

    const colors = ["#8b5cf6", "#06b6d4", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"];
    const total = Math.max(1, Object.values(counts).reduce((sum, count) => sum + count, 0));

    const list = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], idx) => ({
        name,
        count,
        value: Math.round((count / total) * 100) || 1,
        color: colors[idx % colors.length],
      }));

    return list;
  }, [members]);

  const networkChartData = useMemo(() => {
    const days = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365 }[timeRange];
    const bucketDays = Math.max(1, Math.ceil(days / 14));
    const bucketMs = bucketDays * 86_400_000;
    const rangeStart = Date.now() - days * 86_400_000;
    const buckets = new Map<number, { day: string; posts: number; authors: Set<string> }>();
    for (const post of posts) {
      if (post.time < rangeStart) continue;
      const bucket = Math.floor((post.time - rangeStart) / bucketMs);
      const current = buckets.get(bucket) ?? { day: new Date(rangeStart + bucket * bucketMs).toLocaleDateString(undefined, { month: "short", day: "numeric" }), posts: 0, authors: new Set<string>() };
      current.posts += 1;
      current.authors.add(post.authorId);
      buckets.set(bucket, current);
    }
    return [...buckets.entries()].sort(([left], [right]) => left - right).map(([, bucket]) => ({ day: bucket.day, posts: bucket.posts, activeUsers: bucket.authors.size }));
  }, [posts, timeRange]);

  const sortedCreators = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      return (b.followers || 0) - (a.followers || 0);
    });
  }, [members]);

  return (
    <div className="space-y-8 px-4 py-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
              <Globe className="h-4 w-4" />
            </span>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-400">
              Admin & Network Intelligence
            </p>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
            🌎 Community Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Holistic, real-time live data from connected creators, automated AI schedules, and active feeds.
          </p>
        </div>

        {/* Time Filter */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {(["7D", "30D", "90D", "1Y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-black transition ${
                timeRange === r
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* STREAMCORE OVERVIEW METRIC CARDS - DRIVEN BY REAL DATA */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            STREAMCORE LIVE METRICS
          </p>
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" />
            Live Realtime Connected
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Total Members */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Total Creators & Members</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black text-foreground">{realTotalMembers.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <ChevronUp className="h-3 w-3" /> {realPartners} Official Partners
            </p>
          </div>

          {/* Online Members */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Active Signals</span>
              <span className="h-2.5 w-2.5 rounded-full bg-online animate-ping" />
            </div>
            <p className="text-2xl font-black text-online">{realOnlineMembers.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Live or posted in the last 15 minutes
            </p>
          </div>

          {/* Live Streams */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Live Streams</span>
              <Radio className="h-4 w-4 text-live animate-pulse" />
            </div>
            <p className="text-2xl font-black text-live">{realLiveStreams.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-live">
              ● Broadcasting right now
            </p>
          </div>

          {/* Real Community Posts */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Loaded Feed Posts</span>
              <MessageSquare className="h-4 w-4 text-pink-400" />
            </div>
            <p className="text-2xl font-black text-foreground">{realTotalPosts.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-pink-400 flex items-center gap-1">
              <Flame className="h-3 w-3" /> {realTotalReactions} loaded reactions & likes
            </p>
          </div>

          {/* Community Discussions */}
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Loaded Replies</span>
              <MessageSquare className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black text-cyan-300">{realDiscussions.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-cyan-400">
              From the currently loaded Supabase feed
            </p>
          </div>
        </div>
      </section>

      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        {(
          [
            { id: "overview", label: "Overview & Charts", icon: BarChart3 },
            { id: "categories", label: "Category Performance", icon: Layers },
            { id: "creators", label: "Real Creator Roster", icon: Users },
            { id: "geography", label: "Geography & Reach", icon: Globe },
            { id: "engagement", label: "Retention & Engagement", icon: Zap },
            { id: "moderation", label: "Safety & Moderation", icon: ShieldCheck },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                active
                  ? "bg-cyan-500 text-black shadow-sm"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & GROWTH CHARTS */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Network Activity Area Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-cyan-400" />
                    Network Engagement Activity
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Unique posting creators from real Supabase post timestamps. No projected values.
                  </p>
                </div>
                <span className="text-xs font-bold text-muted-foreground">{timeRange}</span>
              </div>

              <div className="h-64 w-full pt-2">
                {!networkChartData.length && <div className="grid h-full place-items-center text-xs text-muted-foreground">No stored posts exist in this date range.</div>}
                {networkChartData.length > 0 &&
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={networkChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
                    <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} />
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
                    <Area type="monotone" dataKey="activeUsers" stroke="#06b6d4" strokeWidth={3} fill="url(#userGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
                }
              </div>
            </div>

            {/* Category Pie Chart */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <PieIcon className="h-5 w-5 text-purple-400" />
                  Live Category Distribution
                </h3>
                <p className="text-xs text-muted-foreground">Extracted from connected creators</p>
              </div>

              <div className="h-44 w-full">
                {!categoryStats.length && <div className="grid h-full place-items-center text-xs text-muted-foreground">No Twitch categories are currently synced.</div>}
                {categoryStats.length > 0 &&
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={40}
                      paddingAngle={4}
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#3f3f46",
                        borderRadius: "0.75rem",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                }
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border text-xs">
                {categoryStats.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-muted-foreground truncate max-w-[140px]">{item.name}</span>
                    </div>
                    <span className="font-black text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORY PERFORMANCE */}
      {tab === "categories" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryStats.map((c) => (
              <div key={c.name} className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-xs font-bold text-muted-foreground">{c.value}% share</span>
                </div>
                <h3 className="font-black text-base">{c.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Active creators: {c.count} in this cluster
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REAL CREATOR ROSTER */}
      {tab === "creators" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Connected Creators ({members.length})</h3>
              <span className="text-xs font-semibold text-muted-foreground">
                Sorted by Live Status & Synced Followers
              </span>
            </div>

            <div className="divide-y divide-border">
              {sortedCreators.map((m, idx) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-muted-foreground w-6">#{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-bold text-foreground">{m.name}</strong>
                        {m.status === "live" && (
                          <span className="rounded bg-rose-500/20 text-rose-400 text-[10px] font-black px-1.5 py-0.5">
                            LIVE
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{m.handle}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {m.role || "Creator"} · {m.platform || "Twitch"} {m.gameName ? `· ${m.gameName}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <p className="font-black text-foreground">{(m.followers || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Followers</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GEOGRAPHY & REACH */}
      {tab === "geography" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan-400" />
            Regional Creator & Audience Distribution
          </h3>

          <div className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
            No geographic percentage is shown because Twitch Helix does not provide viewer-location analytics for these connected public channels. Connect an authorized first-party analytics source before this screen displays regional data.
          </div>
        </div>
      )}

      {/* TAB 5: RETENTION & ENGAGEMENT */}
      {tab === "engagement" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-muted-foreground">Automated Chat Activity</span>
            <p className="text-2xl font-black text-cyan-400">{realAutomatedPosts}</p>
            <p className="text-[11px] text-muted-foreground">24/7 AI chat participation posts</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-muted-foreground">Community Interactions</span>
            <p className="text-2xl font-black text-emerald-400">{realTotalReactions}</p>
            <p className="text-[11px] text-muted-foreground">Emoji reactions and post likes</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-muted-foreground">Shared Clips</span>
            <p className="text-2xl font-black text-purple-400">{realClips}</p>
            <p className="text-[11px] text-muted-foreground">Broadcast clips in network</p>
          </div>
        </div>
      )}

      {/* TAB 6: SAFETY & MODERATION */}
      {tab === "moderation" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Safety & Automated Shield Status
          </h3>
          <p className="text-xs text-muted-foreground">
            Automated spam filter is active. Verified creators and automated broadcasts are shielded.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border bg-accent/30 p-3">
              <p className="text-lg font-black text-foreground">{realTotalPosts}</p>
              <p className="text-[10px] uppercase text-muted-foreground font-bold">Monitored Messages</p>
            </div>
            <div className="rounded-xl border border-border bg-accent/30 p-3">
              <p className="text-lg font-black text-muted-foreground">Not measured</p>
              <p className="text-[10px] uppercase text-muted-foreground font-bold">Moderation effectiveness</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
