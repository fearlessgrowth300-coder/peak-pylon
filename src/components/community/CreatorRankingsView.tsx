import { useEffect, useMemo, useState } from "react";
import { Eye, Film, MessageSquare, Radio, Trophy, Users, X } from "lucide-react";
import { computeRankings, type CreatorRankedItem, type RankingCategory } from "@/lib/rankings";
import type { Member, Post } from "@/lib/community";
import { Avatar } from "./Bits";

export function CreatorRankingsView({
  members,
  posts,
  onPick,
  initialCategory = "overall",
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  initialCategory?: RankingCategory;
}) {
  const [category, setCategory] = useState<RankingCategory>(initialCategory);
  const [selected, setSelected] = useState<CreatorRankedItem | null>(null);

  useEffect(() => setCategory(initialCategory), [initialCategory]);
  const rankings = useMemo(() => computeRankings(members, posts, category), [category, members, posts]);

  const tabs: Array<{ id: RankingCategory; label: string }> = [
    { id: "overall", label: "Overall activity" },
    { id: "watched", label: "Current viewers" },
    { id: "engaged", label: "Engagement" },
    { id: "content", label: "Clip views" },
    { id: "active", label: "Posts" },
  ];

  return (
    <div className="space-y-6 px-4 py-6">
      <header>
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400"><Trophy className="h-4 w-4" />Real-data leaderboard</p>
        <h1 className="mt-1 text-3xl font-black">{initialCategory === "rising" ? "Creator Activity" : "Creator Rankings"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ranks use only synced followers/current viewers and real Supabase posts, reactions, comments and Twitch clip views. Historical growth is not estimated.</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => <button key={tab.id} onClick={() => setCategory(tab.id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${category === tab.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}>{tab.label}</button>)}
      </div>

      <div className="space-y-2">
        {rankings.map((item) => (
          <article key={item.member.id} onClick={() => onPick(item.member)} className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 sm:flex-row sm:items-center">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${item.rank === 1 ? "bg-amber-500/20 text-amber-400" : "bg-background"}`}>#{item.rank}</span>
            <Avatar member={item.member} size={46} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><h2 className="truncate font-black">{item.member.name}</h2>{item.member.status === "live" && <span className="rounded bg-live px-1.5 py-0.5 text-[9px] font-black text-white">LIVE</span>}</div>
              <p className="truncate text-xs text-muted-foreground">{item.member.handle} · {item.member.platform} · {item.member.gameName || "No category synced"}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
              <Data value={item.metrics.followers.toLocaleString()} label="Followers" />
              <Data value={item.metrics.currentViewers.toLocaleString()} label="Viewers now" />
              <Data value={item.scores.totalScore.toFixed(1)} label="Activity score" />
            </div>
            <button onClick={(event) => { event.stopPropagation(); setSelected(item); }} className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-accent">Details</button>
          </article>
        ))}
        {!rankings.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No real creator data is available.</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg space-y-5 rounded-2xl border border-border bg-popover p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3"><Avatar member={selected.member} size={54} /><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black">{selected.member.name}</h2><p className="text-xs text-muted-foreground">Rank #{selected.rank} · calculated from current stored fields</p></div><button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button></div>
            <p className="rounded-xl bg-background p-3 text-xs text-muted-foreground">{selected.aiAnalysis.summary}</p>
            <div className="grid grid-cols-2 gap-3">
              <Detail icon={<Users className="h-4 w-4" />} label="Synced followers" value={selected.metrics.followers.toLocaleString()} />
              <Detail icon={<Eye className="h-4 w-4" />} label="Current viewers" value={selected.metrics.currentViewers.toLocaleString()} />
              <Detail icon={<Radio className="h-4 w-4" />} label="Community posts" value={selected.metrics.communityPosts.toLocaleString()} />
              <Detail icon={<MessageSquare className="h-4 w-4" />} label="Comments received" value={selected.metrics.communityComments.toLocaleString()} />
              <Detail icon={<Film className="h-4 w-4" />} label="Real clips" value={selected.metrics.clipsCount.toLocaleString()} />
              <Detail label="Recorded clip views" value={selected.metrics.clipViews.toLocaleString()} />
            </div>
            <p className="text-[11px] text-amber-300">Follower growth, average viewers, peak viewers, hours streamed and schedule frequency are unavailable until historical Twitch snapshots are stored.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Data({ value, label }: { value: string; label: string }) {
  return <div className="rounded-lg bg-background p-2"><p className="text-xs font-black">{value}</p><p className="text-[9px] uppercase text-muted-foreground">{label}</p></div>;
}

function Detail({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-background p-3"><p className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground">{icon}{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}
