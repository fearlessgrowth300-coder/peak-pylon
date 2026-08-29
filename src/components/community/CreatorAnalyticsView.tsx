import { useMemo, useState } from "react";
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
            Current Twitch snapshot and activity recorded in StreamCore. No estimated or generated metrics.
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Users className="h-4 w-4" />} label="Twitch followers" value={myMember.followers?.toLocaleString() ?? "Not synced"} />
        <Metric icon={<Eye className="h-4 w-4" />} label="Current viewers" value={myMember.status === "live" ? (myMember.viewerCount ?? 0).toLocaleString() : "Offline"} />
        <Metric icon={<MessageSquare className="h-4 w-4" />} label="Community posts" value={analytics.ownPosts.length.toLocaleString()} />
        <Metric icon={<Activity className="h-4 w-4" />} label="Real engagements" value={analytics.engagements.toLocaleString()} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-black">StreamCore activity</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Engagement includes actual likes, comments, shares and reactions saved on your posts.
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
        Historical Twitch follower growth, stream hours and retention are not shown because StreamCore does not yet store Twitch history snapshots.
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

function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return <div className={`${compact ? "mt-4" : "py-16"} rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground`}>{message}</div>;
}
