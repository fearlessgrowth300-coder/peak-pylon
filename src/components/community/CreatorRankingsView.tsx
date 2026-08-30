import { useEffect, useMemo, useState } from "react";
import { Bot, Eye, Film, Loader2, MessageSquare, Radio, RefreshCw, Trophy, Users, X } from "lucide-react";
import { generateCreatorAiAnalysis, sortRankingItems, type CreatorRankedItem, type RankingCategory } from "@/lib/rankings";
import { generateCreatorRankingInsight, getCreatorRankings, refreshCreatorRankings, type StoredCreatorRanking } from "@/lib/ranking.functions";
import type { Member, Post } from "@/lib/community";
import { Avatar } from "./Bits";

export function CreatorRankingsView({
  members,
  posts: _posts,
  onPick,
  initialCategory = "overall",
  isAdmin = false,
  accessToken,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  initialCategory?: RankingCategory;
  isAdmin?: boolean;
  accessToken?: string;
}) {
  const [category, setCategory] = useState<RankingCategory>(initialCategory);
  const [stored, setStored] = useState<StoredCreatorRanking[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRankings(force = false) {
    setBusy(force);
    setMessage(force ? "Refreshing all stored Twitch and Supabase metrics…" : "");
    try {
      const rows = force && accessToken
        ? await refreshCreatorRankings({ data: { accessToken } })
        : await getCreatorRankings();
      setStored(rows);
      if (force) setMessage(`Stored a real-data snapshot for ${rows.length} creators.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ranking data could not be loaded.");
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  useEffect(() => { setCategory(initialCategory); }, [initialCategory]);
  useEffect(() => { void loadRankings(); }, []);

  const rankings = useMemo(() => {
    const memberById = new Map(members.map((member) => [member.id, member]));
    const items = stored.flatMap((row) => {
      const member = memberById.get(row.creatorId);
      if (!member) return [];
      const base = generateCreatorAiAnalysis(member, row.scores, row.metrics);
      return [{
        member, metrics: row.metrics, scores: row.scores,
        rank: row.rank, previousRank: row.previousRank, rankDelta: row.rankDelta,
        badge: base.badge,
        aiAnalysis: {
          ...base.aiAnalysis,
          headline: row.aiHeadline || base.aiAnalysis.headline,
          summary: row.aiSummary || base.aiAnalysis.summary,
          strongestCategory: row.aiStrongestCategory || base.aiAnalysis.strongestCategory,
          model: row.aiModel,
        },
      } as CreatorRankedItem];
    });
    return sortRankingItems(items, category);
  }, [category, members, stored]);
  const selected = rankings.find((item) => item.member.id === selectedId) ?? null;

  async function explainWithGemini() {
    if (!selected || !accessToken) return;
    setBusy(true);
    setMessage(`Gemini is explaining ${selected.member.name}'s fixed formula score…`);
    try {
      const updated = await generateCreatorRankingInsight({ data: { accessToken, creatorId: selected.member.id } });
      setStored((current) => current.map((row) => row.creatorId === updated.creatorId ? updated : row));
      setMessage(`Gemini explanation saved. Rank #${updated.rank} and score ${updated.scores.totalScore} were not changed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gemini could not explain this score.");
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: RankingCategory; label: string }> = [
    { id: "overall", label: "Overall score" }, { id: "growing", label: "Follower growth" },
    { id: "watched", label: "Average viewers" }, { id: "engaged", label: "Engagement" },
    { id: "content", label: "Clip performance" }, { id: "active", label: "Community activity" },
  ];

  return (
    <div className="space-y-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400"><Trophy className="h-4 w-4" />Stored real-data leaderboard</p>
          <h1 className="mt-1 text-3xl font-black">{initialCategory === "rising" ? "Creator Growth" : "Creator Rankings"}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">The formula ranks creators from stored Twitch followers, live-view observations, stream frequency and real Supabase posts, comments, reactions, shares and clip views. Gemini explains the result but cannot alter it.</p>
        </div>
        {isAdmin && accessToken && <button type="button" disabled={busy} onClick={() => void loadRankings(true)} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh real data</button>}
      </header>

      {message && <p className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">{message}</p>}
      <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab.id} onClick={() => setCategory(tab.id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${category === tab.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}>{tab.label}</button>)}</div>

      <div className="space-y-2">
        {rankings.map((item) => (
          <article key={item.member.id} onClick={() => onPick(item.member)} className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 sm:flex-row sm:items-center">
            <div className="shrink-0 text-center"><span className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${item.rank === 1 ? "bg-amber-500/20 text-amber-400" : "bg-background"}`}>#{item.rank}</span>{item.rankDelta !== 0 && <span className={`text-[9px] font-black ${item.rankDelta > 0 ? "text-emerald-400" : "text-rose-400"}`}>{item.rankDelta > 0 ? `▲${item.rankDelta}` : `▼${Math.abs(item.rankDelta)}`}</span>}</div>
            <Avatar member={item.member} size={46} />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate font-black">{item.member.name}</h2>{item.member.status === "live" && <span className="rounded bg-live px-1.5 py-0.5 text-[9px] font-black text-white">LIVE</span>}</div><p className="truncate text-xs text-muted-foreground">{item.member.handle} · {item.member.gameName || "No Twitch category currently synced"}</p></div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]"><Data value={item.metrics.followers.toLocaleString()} label="Followers" /><Data value={item.metrics.avgViewers.toLocaleString()} label="Avg viewers" /><Data value={item.scores.totalScore.toFixed(1)} label="Formula score" /></div>
            <button onClick={(event) => { event.stopPropagation(); setSelectedId(item.member.id); }} className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-accent">Score details</button>
          </article>
        ))}
        {loading && <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calculating from stored data…</div>}
        {!loading && !rankings.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No stored creator data is available.</div>}
      </div>

      {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onClick={() => setSelectedId(null)}><div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-border bg-popover p-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3"><Avatar member={selected.member} size={54} /><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black">{selected.member.name}</h2><p className="text-xs text-muted-foreground">Rank #{selected.rank} · formula v1 · previous #{selected.previousRank}</p></div><button onClick={() => setSelectedId(null)}><X className="h-5 w-5" /></button></div>
        <div className="rounded-xl bg-background p-4"><p className="font-bold">{selected.aiAnalysis.headline}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{selected.aiAnalysis.summary}</p><p className="mt-2 text-[10px] uppercase text-primary">Explanation: {selected.aiAnalysis.model || "deterministic formula"}</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Detail icon={<Users className="h-4 w-4" />} label="Followers" value={selected.metrics.followers.toLocaleString()} /><Detail icon={<Eye className="h-4 w-4" />} label="Current / avg / peak" value={`${selected.metrics.currentViewers.toLocaleString()} / ${selected.metrics.avgViewers.toLocaleString()} / ${selected.metrics.peakViewers.toLocaleString()}`} /><Detail icon={<Radio className="h-4 w-4" />} label="Observed live hours" value={selected.metrics.hoursStreamed.toFixed(1)} /><Detail icon={<MessageSquare className="h-4 w-4" />} label="Posts / comments" value={`${selected.metrics.communityPosts} / ${selected.metrics.communityComments}`} /><Detail icon={<Film className="h-4 w-4" />} label="Clips / views" value={`${selected.metrics.clipsCount} / ${selected.metrics.clipViews.toLocaleString()}`} /><Detail label="Follower change" value={selected.metrics.hasFollowerHistory ? `${selected.metrics.followerGrowthRate >= 0 ? "+" : ""}${selected.metrics.followerGrowthRate}%` : "Collecting history"} /></div>
        <div className="rounded-xl border border-border p-4"><p className="text-xs font-black uppercase text-muted-foreground">Score components</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Score label="Audience reach · 20%" value={selected.scores.audienceReach} /><Score label="Follower growth · 15%*" value={selected.scores.audienceGrowth} /><Score label="Viewers · 20%" value={selected.scores.viewerPerformance} /><Score label="Engagement · 15%" value={selected.scores.engagement} /><Score label="Consistency · 10%" value={selected.scores.consistency} /><Score label="Community · 10%" value={selected.scores.communityActivity} /><Score label="Clips · 10%" value={selected.scores.contentPerformance} /></div><p className="mt-3 text-[10px] text-muted-foreground">* Growth weight is excluded and all other weights are re-normalized until two follower observations exist.</p></div>
        {isAdmin && accessToken && <button type="button" disabled={busy} onClick={() => void explainWithGemini()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-sm font-black text-primary disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}Generate Gemini explanation from these fixed facts</button>}
      </div></div>}
    </div>
  );
}

function Data({ value, label }: { value: string; label: string }) { return <div className="rounded-lg bg-background p-2"><p className="text-xs font-black">{value}</p><p className="text-[9px] uppercase text-muted-foreground">{label}</p></div>; }
function Detail({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl border border-border bg-background p-3"><p className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground">{icon}{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>; }
function Score({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-background p-2"><div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><strong>{value.toFixed(1)}</strong></div><div className="mt-1 h-1.5 rounded-full bg-accent"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>; }
