import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getMyTwitchAnalytics } from "@/lib/twitch.functions";
import { Activity, BarChart3, Eye, Film, MessageSquare, Radio, Share2, Users } from "lucide-react";
import { timeAgo, type Member, type Post } from "@/lib/community";

type TimeRange = "7D" | "30D" | "90D" | "1Y";

const RANGE_DAYS: Record<TimeRange, number> = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365 };

function postEngagement(post: Post) {
  const reactions = Object.values(post.reactions ?? {}).reduce((sum, count) => sum + count, 0);
  return reactions + (post.likes?.length ?? 0) + (post.comments?.length ?? 0) + (post.shares ?? 0);
}

export function CreatorAnalyticsView({
  myMember,
  posts,
}: {
  myMember?: Member | null | undefined;
  posts: Post[];
  setToast?: (message: string) => void;
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30D");
  const days = RANGE_DAYS[timeRange];
  const cutoff = Date.now() - days * 86_400_000;
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [connectError, setConnectError] = useState("");
  const [playerHost, setPlayerHost] = useState("");
  useEffect(() => { setPlayerHost(window.location.hostname); }, []);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) setSessionToken(data.session?.access_token ?? null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSessionToken(session?.access_token ?? null));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  const twitch = useQuery({
    queryKey: ["private-twitch-analytics", myMember?.id, sessionToken, days],
    queryFn: () => getMyTwitchAnalytics({ data: { accessToken: sessionToken!, days: days as 7 | 30 | 90 | 365 } }),
    enabled: !!sessionToken && !!myMember,
    staleTime: 60000, retry: false, refetchOnWindowFocus: false,
  });
  const reconnectTwitch = async () => {
    setConnectError("");
    try {
      const state = crypto.randomUUID();
      localStorage.setItem("streamcore:twitch-oauth-state", state);
      localStorage.setItem("streamcore:twitch-expected-login", twitch.data?.login ?? "");
      localStorage.setItem("streamcore:twitch-return-view", "analytics");
      window.location.assign(`/twitch/authorize?state=${encodeURIComponent(state)}`);
    } catch (error) { setConnectError(error instanceof Error ? error.message : "Twitch connection failed."); }
  };

  const analytics = useMemo(() => {
    if (!myMember) return null;
    const ownPosts = posts.filter((post) => post.authorId === myMember.id && post.time >= cutoff);
    const engagements = ownPosts.reduce((sum, post) => sum + postEngagement(post), 0);
    const comments = ownPosts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0);
    const clips = ownPosts.filter((post) => post.channel === "clips");

    const bucketCount = Math.min(days, 12);
    const bucketMs = (days * 86_400_000) / bucketCount;
    const activity = Array.from({ length: bucketCount }, (_, index) => {
      const start = cutoff + index * bucketMs;
      const end = start + bucketMs;
      const bucketPosts = ownPosts.filter((post) => post.time >= start && post.time < end);
      return {
        label: new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        posts: bucketPosts.length,
        engagement: bucketPosts.reduce((sum, post) => sum + postEngagement(post), 0),
      };
    });

    const topPosts = [...ownPosts]
      .sort((left, right) => postEngagement(right) - postEngagement(left))
      .slice(0, 5);

    return { ownPosts, engagements, comments, clips, activity, topPosts };
  }, [cutoff, days, myMember, posts]);

  if (!myMember) {
    return <EmptyState message="Sign in to view analytics from your real StreamCore and Twitch data." />;
  }

  if (!analytics) return null;
  const maxActivity = Math.max(1, ...analytics.activity.map((item) => item.engagement));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-emerald-400">Real creator data</p>
          <h1 className="mt-1 text-3xl font-black">Creator Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your authorized Twitch broadcasts, recorded viewer samples and StreamCore activity.
          </p>
        </div>
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(Object.keys(RANGE_DAYS) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${timeRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {range}
            </button>
          ))}
        </div>
      </header>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Twitch stream analytics</h2>
          <button disabled={twitch.isFetching || !sessionToken} onClick={() => void twitch.refetch()} className="rounded-md border border-border px-4 py-2 disabled:opacity-50">{twitch.isFetching ? "Loading Twitch data…" : "Refresh Twitch data"}</button>
        </div>
        {twitch.error && <p role="alert" className="text-sm text-red-400">{twitch.error.message}</p>}
        {twitch.isPending && <p className="text-sm text-muted-foreground">{sessionToken ? "Loading authorized channel data…" : "Sign in to load private Twitch analytics."}</p>}
        <div className="space-y-2">
          <button onClick={() => void reconnectTwitch()} className="rounded-md border border-border px-4 py-2 font-semibold">Reconnect Twitch for analytics</button>
          <p className="text-xs text-muted-foreground">Already connected? Renew the Twitch permissions needed for analytics. Your community profile stays connected.</p>
        </div>
        {connectError && <p role="alert" className="text-red-400">{connectError}</p>}
        {twitch.data && <>
          <p className="text-sm text-muted-foreground">@{twitch.data.login} · Updated {new Date(twitch.data.fetchedAt).toLocaleString()}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric icon={<Users className="h-4 w-4" />} label="Twitch followers" value={twitch.data.followers?.toLocaleString() ?? "Permission required"} />
            <Metric icon={<Eye className="h-4 w-4" />} label="Live concurrent viewers" value={twitch.data.currentViewers?.toLocaleString() ?? "Offline"} />
            <Metric icon={<MessageSquare className="h-4 w-4" />} label="Connected chatters now" value={twitch.data.chatters?.toLocaleString() ?? "Permission required"} />
          </div>
          <p className="text-sm text-muted-foreground">{twitch.data.permissionMessage}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChannelHistoryChart title="Follower growth" points={twitch.data.followerHistory} metric="followers" />
            <ChannelHistoryChart title="Live viewer history" points={twitch.data.viewerHistory} metric="concurrent viewers" />
          </div>
          <p className="text-xs text-muted-foreground">Points belong to @{twitch.data.login}. Missing dates are not zero. Follower growth uses verified Twitch measurements captured when analytics refreshes; older cached follower totals are excluded. Live viewer samples also include the existing live-sync history. This is not continuous stream coverage.</p>
          {twitch.data.captureWarning && <p role="alert" className="text-sm text-amber-300">{twitch.data.captureWarning}</p>}
          <section className="rounded-md border border-border p-4">
            <h3 className="font-semibold">Video views by broadcast</h3>
            <p className="mt-1 text-xs text-muted-foreground">Current Twitch video-view totals, grouped by broadcast date. These are not live concurrent viewers or historical daily view counts.</p>
            {twitch.data.broadcasts.length ? <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...twitch.data.broadcasts].reverse()} margin={{ top: 10, right: 15, bottom: 15, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="createdAt" tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} stroke="#94a3b8" />
                  <Tooltip labelFormatter={value => new Date(String(value)).toLocaleString()} contentStyle={{ background: "#0b1522", borderColor: "#334155", color: "#fff" }} />
                  <Bar dataKey="videoViews" name="Video views" fill="#0891b2" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <p className="mt-4 text-sm text-muted-foreground">No saved broadcasts are available for this date range.</p>}
          </section>
          <h3 className="font-semibold">Recent broadcasts</h3>
          {!twitch.data.broadcasts.length && <p className="text-sm text-muted-foreground">No saved Twitch broadcasts available in this period. Twitch may not retain older broadcasts.</p>}
          {twitch.data.broadcasts.map((broadcast) => {
            const recorded = twitch.data.streams.find((stream) => stream.id === broadcast.streamId);
            return <article key={broadcast.id} className="rounded-md border border-border p-4">
              <a href={broadcast.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{broadcast.title}</a>
              {playerHost && <div className="mt-3">
                <iframe
                  title={`Watch ${broadcast.title}`}
                  src={`https://player.twitch.tv/?video=v${encodeURIComponent(broadcast.id)}&parent=${encodeURIComponent(playerHost)}&autoplay=false`}
                  className="aspect-video min-h-[300px] w-full rounded-md border-0"
                  allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
                  loading="lazy"
                />
              </div>}
              <p className="mt-2 text-sm text-muted-foreground">{new Date(broadcast.createdAt).toLocaleString()} · Duration {broadcast.duration} · {broadcast.videoViews.toLocaleString()} video views</p>
              <p className="mt-2 text-sm">{recorded ? `Sampled average: ${recorded.average.toLocaleString()} viewers · Sampled peak: ${recorded.peak.toLocaleString()} · ${recorded.samples} observations` : "Live viewer history was not recorded for this broadcast."}</p>
            </article>;
          })}
          <h3 className="font-semibold">Recorded live sessions</h3>
          {!twitch.data.streams.length && <p className="text-sm text-muted-foreground">No stored live viewer samples for this period.</p>}
          {twitch.data.streams.slice(0, 30).map((stream) => <p key={stream.id} className="border-b border-border py-2 text-sm">{new Date(stream.firstSeen).toLocaleDateString()} · Sampled average {stream.average.toLocaleString()} · Sampled peak {stream.peak.toLocaleString()} viewers · {stream.samples} samples</p>)}
          <p className="text-xs text-muted-foreground">Latest 100 available broadcasts and up to 1,000 stored observations. Sampled averages and peaks cover recorded observations only, not the entire broadcast. Video views are not live viewers. Historical unique chatters, message totals and retention are unavailable unless collected during the stream.{twitch.data.historyTruncated ? " This range reached the observation limit. Select a shorter range." : ""}</p>
        </>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Film className="h-4 w-4" />} label="Loaded clips" value={analytics.clips.length.toLocaleString()} />
        <Metric icon={<MessageSquare className="h-4 w-4" />} label="Loaded comments" value={analytics.comments.toLocaleString()} />
        <Metric icon={<MessageSquare className="h-4 w-4" />} label="Community posts" value={analytics.ownPosts.length.toLocaleString()} />
        <Metric icon={<Activity className="h-4 w-4" />} label="Real engagements" value={analytics.engagements.toLocaleString()} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-black">StreamCore activity</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          These counts cover your posts in the currently loaded community feed, not your complete account history. Engagement includes saved likes, comments, shares and reactions.
        </p>
        {analytics.ownPosts.length ? (
          <div className="mt-5 flex h-52 items-end gap-2">
            {analytics.activity.map((item) => (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground">{item.engagement}</span>
                <div
                  className="w-full rounded-t-md bg-primary/80"
                  style={{ height: `${Math.max(4, (item.engagement / maxActivity) * 150)}px` }}
                  title={`${item.posts} posts · ${item.engagement} engagements`}
                />
                <span className="w-full truncate text-center text-[9px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message={`No posts from this creator in the last ${days} days.`} compact />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Metric icon={<Film className="h-4 w-4" />} label="Clips posted" value={analytics.clips.length.toLocaleString()} />
        <Metric icon={<MessageSquare className="h-4 w-4" />} label="Comments received" value={analytics.comments.toLocaleString()} />
        <Metric icon={<Radio className="h-4 w-4" />} label="Twitch status" value={myMember.status === "live" ? "Live now" : myMember.status} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-black">Top real posts</h2>
        {analytics.topPosts.length ? (
          <div className="mt-4 space-y-2">
            {analytics.topPosts.map((post) => (
              <article key={post.id} className="rounded-xl border border-border bg-background/60 p-4">
                <p className="line-clamp-2 text-sm font-semibold">{post.text || (post.sticker ? "Sticker post" : "Media post")}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{timeAgo(post.time)}</span>
                  <span>{postEngagement(post)} engagements</span>
                  <span>{post.comments?.length ?? 0} comments</span>
                  <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{post.shares ?? 0}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No creator posts are available for this period." compact />
        )}
      </section>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Twitch authorization does not grant access to all statistics in Twitch Creator Dashboard. Missing historical data is shown as unavailable, never estimated.
      </p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">{icon}{label}</div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function ChannelHistoryChart({ title, points, metric }: { title: string; points: Array<{ time: number; value: number }>; metric: string }) {
  const change = points.length > 1 ? points[points.length - 1]!.value - points[0]!.value : null;
  return <section className="rounded-md border border-border p-4">
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-1 text-xs text-muted-foreground">{points.length} recorded measurements{metric === "followers" && change !== null ? ` · Net change ${change > 0 ? "+" : ""}${change.toLocaleString()} followers` : ""}</p>
    {points.length ? <div className="mt-4 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 15, bottom: 15, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" type="number" name="Recorded" domain={["dataMin", "dataMax"]} tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })} stroke="#94a3b8" />
          <YAxis dataKey="value" type="number" name={metric} allowDecimals={false} stroke="#94a3b8" />
          <Tooltip formatter={(value, name) => name === "Recorded" ? [new Date(Number(value)).toLocaleString(), name] : [Number(value).toLocaleString(), name]} contentStyle={{ background: "#0b1522", borderColor: "#334155", color: "#fff" }} />
          <Scatter data={points} fill="#0891b2" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div> : <p className="mt-4 text-sm text-muted-foreground">No {metric} measurements were recorded in this period.</p>}
    {points.length === 1 && <p className="mt-2 text-xs text-muted-foreground">One measurement is available. A growth comparison needs at least two observations at different times.</p>}
  </section>;
}

function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return <div className={`${compact ? "mt-4" : "py-16"} rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground`}>{message}</div>;
}
