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

const NETWORK_CHART_DATA = [
  { day: "Mon", activeUsers: 64200, streams: 2840, posts: 142000, newMembers: 8400 },
  { day: "Tue", activeUsers: 71400, streams: 3120, posts: 158000, newMembers: 9100 },
  { day: "Wed", activeUsers: 78900, streams: 3450, posts: 172000, newMembers: 10400 },
  { day: "Thu", activeUsers: 74500, streams: 3280, posts: 164000, newMembers: 9800 },
  { day: "Fri", activeUsers: 84200, streams: 3821, posts: 184421, newMembers: 12100 },
  { day: "Sat", activeUsers: 92800, streams: 4210, posts: 210000, newMembers: 14600 },
  { day: "Sun", activeUsers: 88400, streams: 3980, posts: 195000, newMembers: 13200 },
];

const CATEGORY_DISTRIBUTION = [
  { name: "Gaming", value: 38, color: "#8b5cf6" },
  { name: "Just Chatting", value: 24, color: "#06b6d4" },
  { name: "Music", value: 12, color: "#ec4899" },
  { name: "IRL", value: 9, color: "#10b981" },
  { name: "Other / Creative", value: 17, color: "#f59e0b" },
];

const FASTEST_GROWING_CATEGORIES = [
  { name: "Music & Live Freestyle", growth: "+31%", volume: "42.8K hrs", badge: "🔥 Surging" },
  { name: "FPS Gaming (Valorant/Apex)", growth: "+18%", volume: "128.4K hrs", badge: "⭐ Dominant" },
  { name: "IRL & Travel Vlogs", growth: "+14%", volume: "31.2K hrs", badge: "🌍 Global" },
  { name: "Esports & Tournaments", growth: "+22%", volume: "84.1K hrs", badge: "🏆 High Hype" },
];

const GEOGRAPHY_DATA = [
  { region: "North America (US / CA)", share: "42%", creators: "5,390", growth: "+14%" },
  { region: "Europe (UK / DE / FR)", share: "28%", creators: "3,595", growth: "+18%" },
  { region: "Africa (Nigeria / SA / KE)", share: "16%", creators: "2,054", growth: "+34%" },
  { region: "Latin America (BR / MX)", share: "9%", creators: "1,155", growth: "+22%" },
  { region: "Asia-Pacific", share: "5%", creators: "648", growth: "+26%" },
];

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

  const totalMembersCount = 42381492;
  const onlineCount = 86421;
  const verifiedCreatorsCount = 12842;
  const liveStreamsCount = 3821;
  const dailyPostsCount = 184421;

  const drilldownCreators = useMemo(() => {
    return members.slice(0, 10);
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
            Holistic view of the entire StreamCore ecosystem, network growth, and category health.
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

      {/* STREAMCORE OVERVIEW METRIC CARDS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            STREAMCORE OVERVIEW
          </p>
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" />
            Network Health: 99.98% uptime
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Total Members */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Total Members</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black text-foreground">{totalMembersCount.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <ChevronUp className="h-3 w-3" /> +142K this week
            </p>
          </div>

          {/* Online Members */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Online Now</span>
              <span className="h-2.5 w-2.5 rounded-full bg-online animate-ping" />
            </div>
            <p className="text-2xl font-black text-online">{onlineCount.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">
              Across 142 countries
            </p>
          </div>

          {/* Verified Creators */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Verified Creators</span>
              <CheckCircle className="h-4 w-4 text-sky-400" />
            </div>
            <p className="text-2xl font-black text-foreground">{verifiedCreatorsCount.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-sky-400">
              128 Official Partners
            </p>
          </div>

          {/* Live Streams */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Streams Live</span>
              <Radio className="h-4 w-4 text-live animate-pulse" />
            </div>
            <p className="text-2xl font-black text-live">{liveStreamsCount.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-live">
              ● Broadcasting right now
            </p>
          </div>

          {/* Posts Today */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-bold uppercase">Posts Today</span>
              <MessageSquare className="h-4 w-4 text-pink-400" />
            </div>
            <p className="text-2xl font-black text-foreground">{dailyPostsCount.toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <ChevronUp className="h-3 w-3" /> +18.4% chat activity
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
            { id: "creators", label: "Creator Roster Drilldown", icon: Users },
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
                    Network Engagement Volume
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Active users, broadcast concurrency, and chat throughput.
                  </p>
                </div>
                <span className="text-xs font-bold text-muted-foreground">{timeRange}</span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={NETWORK_CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              </div>
            </div>

            {/* Category Pie Chart */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <PieIcon className="h-5 w-5 text-purple-400" />
                  Top Categories Share
                </h3>
                <p className="text-xs text-muted-foreground">Broadcast hours distribution</p>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CATEGORY_DISTRIBUTION}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={40}
                      paddingAngle={4}
                    >
                      {CATEGORY_DISTRIBUTION.map((entry, index) => (
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
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border text-xs">
                {CATEGORY_DISTRIBUTION.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-black text-foreground">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FASTEST GROWING CATEGORIES */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              Fastest Growing Categories
            </h3>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FASTEST_GROWING_CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  className="rounded-xl border border-border/80 bg-accent/30 p-4 space-y-2 transition hover:bg-accent/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">{cat.badge}</span>
                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      {cat.growth}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-foreground">{cat.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{cat.volume} streamed this month</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORY PERFORMANCE */}
      {tab === "categories" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORY_DISTRIBUTION.map((c) => (
              <div key={c.name} className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-xs font-bold text-muted-foreground">{c.value}% share</span>
                </div>
                <h3 className="font-black text-base">{c.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Active streamers: {Math.round((c.value / 100) * 12842).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CREATOR ROSTER DRILLDOWN */}
      {tab === "creators" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Top Active Network Creators</h3>
              <span className="text-xs font-semibold text-muted-foreground">
                Showing top 10 verified creators
              </span>
            </div>

            <div className="divide-y divide-border">
              {drilldownCreators.map((m, idx) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-muted-foreground w-6">#{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-bold text-foreground">{m.name}</strong>
                        <CheckCircle className="h-3.5 w-3.5 text-sky-400" />
                        <span className="text-xs text-muted-foreground">{m.handle}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{m.role || "Creator"} · {m.platform}</p>
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <p className="font-black text-foreground">{(m.followers || 1200000).toLocaleString()}</p>
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

          <div className="divide-y divide-border">
            {GEOGRAPHY_DATA.map((geo) => (
              <div key={geo.region} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-foreground text-sm">{geo.region}</p>
                  <p className="text-muted-foreground">{geo.creators} verified creators</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-cyan-300 text-sm">{geo.share}</p>
                  <p className="text-emerald-400 font-bold">{geo.growth} growth</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: RETENTION & ENGAGEMENT */}
      {tab === "engagement" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-muted-foreground">Day 1 Retention</span>
            <p className="text-2xl font-black text-emerald-400">68.4%</p>
            <p className="text-[11px] text-muted-foreground">New member return rate</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-muted-foreground">Day 7 Retention</span>
            <p className="text-2xl font-black text-cyan-300">48.2%</p>
            <p className="text-[11px] text-muted-foreground">Weekly active cohort</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-muted-foreground">Day 30 Retention</span>
            <p className="text-2xl font-black text-purple-400">34.1%</p>
            <p className="text-[11px] text-muted-foreground">Long term community sticky rate</p>
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
            Automated spam filter is active. 0 malicious raids detected in the last 24 hours.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border bg-accent/30 p-3">
              <p className="text-lg font-black text-foreground">1,842</p>
              <p className="text-[10px] uppercase text-muted-foreground font-bold">Filtered Spam Messages</p>
            </div>
            <div className="rounded-xl border border-border bg-accent/30 p-3">
              <p className="text-lg font-black text-emerald-400">100%</p>
              <p className="text-[10px] uppercase text-muted-foreground font-bold">Shield Health</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
