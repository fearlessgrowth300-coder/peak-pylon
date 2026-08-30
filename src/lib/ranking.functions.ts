import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  calculateCreatorMetrics,
  calculateCreatorScores,
  generateCreatorAiAnalysis,
  type CreatorRawMetrics,
  type CreatorScoreBreakdown,
  type TwitchMetricRollup,
} from "@/lib/rankings";
import type { Member, Post } from "@/lib/community";

export type StoredCreatorRanking = {
  creatorId: string;
  capturedAt: string;
  rank: number;
  previousRank: number;
  rankDelta: number;
  formulaVersion: string;
  metrics: CreatorRawMetrics;
  scores: CreatorScoreBreakdown;
  aiHeadline: string;
  aiSummary: string;
  aiStrongestCategory: string;
  aiModel?: string;
};

const adminInput = z.object({ accessToken: z.string().min(20) });
const insightInput = adminInput.extend({ creatorId: z.string().min(1).max(100) });

function rowToStored(row: any): StoredCreatorRanking {
  return {
    creatorId: row.creator_id,
    capturedAt: row.captured_at,
    rank: Number(row.rank),
    previousRank: Number(row.previous_rank),
    rankDelta: Number(row.rank_delta),
    formulaVersion: row.formula_version,
    metrics: row.metrics,
    scores: row.scores,
    aiHeadline: row.ai_headline ?? "",
    aiSummary: row.ai_summary ?? "",
    aiStrongestCategory: row.ai_strongest_category ?? "",
    aiModel: row.ai_model ?? undefined,
  };
}

async function loadEveryPost(db: any) {
  const posts: Post[] = [];
  for (let from = 0; from < 10_000; from += 500) {
    const { data, error } = await db
      .from("community_posts")
      .select("id, data, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + 499);
    if (error) throw error;
    const rows = data ?? [];
    posts.push(...rows.map((row: any) => ({ ...row.data, id: row.id }) as Post));
    if (rows.length < 500) break;
  }
  return posts;
}

async function loadLatestBatch(db: any) {
  const { data: latest, error } = await db
    .from("creator_metric_snapshots")
    .select("batch_id, captured_at")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!latest?.batch_id) return { capturedAt: null as string | null, rows: [] as any[] };
  const { data: rows, error: rowsError } = await db
    .from("creator_metric_snapshots")
    .select("*")
    .eq("batch_id", latest.batch_id)
    .order("rank", { ascending: true });
  if (rowsError) throw rowsError;
  return { capturedAt: latest.captured_at as string, rows: rows ?? [] };
}

async function calculateAndStore(db: any, force = false) {
  const latest = await loadLatestBatch(db);
  if (!force && latest.capturedAt && Date.parse(latest.capturedAt) > Date.now() - 30 * 60_000) {
    return latest.rows.map(rowToStored);
  }

  const [{ data: memberRows, error: memberError }, posts, { data: rollupRows, error: rollupError }, { data: cacheRow }] = await Promise.all([
    db.from("community_listed_members").select("id, data").limit(500),
    loadEveryPost(db),
    db.rpc("get_creator_twitch_rollups", { since_at: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
    db.from("integration_settings").select("setting_value").eq("setting_name", "twitch_status_snapshot").maybeSingle(),
  ]);
  if (memberError) throw memberError;
  if (rollupError) throw rollupError;

  const cachedSnapshots = Array.isArray(cacheRow?.setting_value?.snapshots) ? cacheRow.setting_value.snapshots : [];
  const cachedById = new Map(cachedSnapshots.map((snapshot: any) => [String(snapshot.id), snapshot]));
  const rollupById = new Map<string, TwitchMetricRollup>((rollupRows ?? []).map((row: any) => [String(row.creator_id), {
    firstFollowers: Number(row.first_followers ?? 0), latestFollowers: Number(row.latest_followers ?? 0),
    averageLiveViewers: Number(row.average_live_viewers ?? 0), peakLiveViewers: Number(row.peak_live_viewers ?? 0),
    liveObservationCount: Number(row.live_observation_count ?? 0), liveDays: Number(row.live_days ?? 0),
    firstObservedAt: row.first_observed_at, lastObservedAt: row.last_observed_at,
  }]));
  const previousRankById = new Map(latest.rows.map((row: any) => [String(row.creator_id), Number(row.rank)]));

  const calculated = (memberRows ?? []).map((row: any) => {
    const cached = cachedById.get(String(row.id)) as any;
    const member = { ...row.data, id: row.id, ...(cached ? {
      name: cached.name || row.data.name, handle: cached.handle || row.data.handle,
      status: cached.status, viewerCount: cached.viewerCount, gameName: cached.gameName,
      gameImage: cached.gameImage, streamTitle: cached.title, avatar: cached.avatar || row.data.avatar,
    } : {}) } as Member;
    const metrics = calculateCreatorMetrics(member, posts, rollupById.get(String(row.id)));
    const scores = calculateCreatorScores(metrics);
    const analysis = generateCreatorAiAnalysis(member, scores, metrics);
    return { creatorId: String(row.id), metrics, scores, analysis };
  }).sort((left: any, right: any) => right.scores.totalScore - left.scores.totalScore || right.metrics.followers - left.metrics.followers);

  const batchId = crypto.randomUUID();
  const capturedAt = new Date().toISOString();
  const insertRows = calculated.map((item: any, index: number) => {
    const rank = index + 1;
    const previousRank = previousRankById.get(item.creatorId) ?? rank;
    return {
      batch_id: batchId, creator_id: item.creatorId, captured_at: capturedAt,
      metrics: item.metrics, scores: item.scores, rank, previous_rank: previousRank,
      rank_delta: previousRank - rank, formula_version: "streamcore-real-v1",
      ai_headline: item.analysis.aiAnalysis.headline,
      ai_summary: item.analysis.aiAnalysis.summary,
      ai_strongest_category: item.analysis.aiAnalysis.strongestCategory,
      ai_model: "deterministic-formula-explanation",
    };
  });
  if (insertRows.length) {
    const { error } = await db.from("creator_metric_snapshots").insert(insertRows);
    if (error) throw error;
  }
  return insertRows.map((row: any) => rowToStored({ ...row, captured_at: capturedAt }));
}

export const getCreatorRankings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return calculateAndStore(supabaseAdmin as any, false);
});

export const refreshCreatorRankings = createServerFn({ method: "POST" })
  .validator(adminInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    return calculateAndStore(db, true);
  });

export const generateCreatorRankingInsight = createServerFn({ method: "POST" })
  .validator(insightInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    const latest = await loadLatestBatch(db);
    const row = latest.rows.find((item: any) => String(item.creator_id) === data.creatorId);
    if (!row) throw new Error("Refresh the real-data ranking snapshot first.");
    const { data: memberRow } = await db.from("community_listed_members").select("data").eq("id", data.creatorId).maybeSingle();
    const name = memberRow?.data?.name ?? "Creator";
    const prompt = `You explain a deterministic creator leaderboard. You must not change, estimate, recommend, or reorder the rank or score. Explain only the supplied facts. Return strict JSON with keys headline, summary, strongestCategory. Summary must be 2 concise sentences and explicitly say the score is formula-calculated. Creator: ${name}. Rank: ${row.rank}. Metrics: ${JSON.stringify(row.metrics)}. Score components: ${JSON.stringify(row.scores)}.`;
    const { generateGeminiServerText } = await import("@/lib/gemini.functions");
    const generated = await generateGeminiServerText(db, prompt, 320);
    const cleaned = generated.text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    let parsed: { headline?: string; summary?: string; strongestCategory?: string } = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { summary: generated.text }; }
    const patch = {
      ai_headline: String(parsed.headline || row.ai_headline || `${name} data analysis`).slice(0, 180),
      ai_summary: String(parsed.summary || row.ai_summary).slice(0, 900),
      ai_strongest_category: String(parsed.strongestCategory || row.ai_strongest_category || "Real-data score").slice(0, 120),
      ai_model: generated.model,
    };
    const { error } = await db.from("creator_metric_snapshots").update(patch).eq("id", row.id);
    if (error) throw error;
    return rowToStored({ ...row, ...patch });
  });

