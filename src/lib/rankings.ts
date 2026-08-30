import type { Member, Post } from "./community";

export type RankingCategory = "overall" | "growing" | "watched" | "engaged" | "rising" | "content" | "active";

export type CreatorScoreBreakdown = {
  audienceReach: number;
  audienceGrowth: number;
  viewerPerformance: number;
  engagement: number;
  consistency: number;
  communityActivity: number;
  contentPerformance: number;
  totalScore: number;
};

export type CreatorRawMetrics = {
  followers: number;
  followerGrowthRate: number;
  hasFollowerHistory: boolean;
  currentViewers: number;
  avgViewers: number;
  peakViewers: number;
  hoursStreamed: number;
  streamFrequencyDays: number;
  clipsCount: number;
  clipViews: number;
  communityPosts: number;
  communityComments: number;
  communityReactions: number;
  communityShares: number;
  activePostDays: number;
  engagementRate: number;
  observedAt?: string;
};

export type CreatorRankedItem = {
  member: Member;
  rank: number;
  previousRank: number;
  rankDelta: number;
  scores: CreatorScoreBreakdown;
  metrics: CreatorRawMetrics;
  badge: { text: string; color: string; icon: string };
  aiAnalysis: {
    headline: string;
    summary: string;
    strongestCategory: string;
    growthTrajectory: "breakout" | "hyper-growth" | "steady" | "titan";
    model?: string;
  };
};

export type TwitchMetricRollup = {
  firstFollowers?: number;
  latestFollowers?: number;
  averageLiveViewers?: number;
  peakLiveViewers?: number;
  liveObservationCount?: number;
  liveDays?: number;
  firstObservedAt?: string;
  lastObservedAt?: string;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const logScore = (value: number, ceiling: number) => clampScore((Math.log10(Math.max(0, value) + 1) / ceiling) * 100);

export function extractClipViews(text: string) {
  const match = text.match(/(?:👁\s*)?([\d,.]+)\s+views/i);
  return match ? Number(match[1]?.replaceAll(",", "") || 0) : 0;
}

export function calculateCreatorMetrics(member: Member, posts: Post[], twitch?: TwitchMetricRollup): CreatorRawMetrics {
  const memberId = member.id?.toLowerCase();
  const memberPosts = posts.filter((post) => post.authorId?.toLowerCase() === memberId);
  const clipPosts = memberPosts.filter((post) => post.channel === "clips" || Boolean(post.video));
  const communityReactions = memberPosts.reduce((sum, post) => sum + Object.values(post.reactions ?? {}).reduce((total, count) => total + count, 0) + (post.likes?.length ?? 0), 0);
  const communityComments = memberPosts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0);
  const communityShares = memberPosts.reduce((sum, post) => sum + (post.shares ?? 0), 0);
  const interactions = communityReactions + communityComments + communityShares;
  const firstFollowers = Number(twitch?.firstFollowers ?? 0);
  const latestFollowers = Number(member.followers ?? twitch?.latestFollowers ?? 0);
  const hasFollowerHistory = Boolean(firstFollowers > 0 && twitch?.firstObservedAt && twitch?.lastObservedAt && twitch.firstObservedAt !== twitch.lastObservedAt);
  const followerGrowthRate = hasFollowerHistory ? Number((((latestFollowers - firstFollowers) / firstFollowers) * 100).toFixed(3)) : 0;
  const activePostDays = new Set(memberPosts.map((post) => new Date(post.time).toISOString().slice(0, 10))).size;

  return {
    followers: latestFollowers,
    followerGrowthRate,
    hasFollowerHistory,
    currentViewers: member.status === "live" ? Number(member.viewerCount ?? 0) : 0,
    avgViewers: Math.round(Number(twitch?.averageLiveViewers ?? (member.status === "live" ? member.viewerCount ?? 0 : 0))),
    peakViewers: Number(twitch?.peakLiveViewers ?? (member.status === "live" ? member.viewerCount ?? 0 : 0)),
    hoursStreamed: Number(((twitch?.liveObservationCount ?? 0) * 0.5).toFixed(1)),
    streamFrequencyDays: Number(twitch?.liveDays ?? 0),
    clipsCount: clipPosts.length,
    clipViews: clipPosts.reduce((sum, post) => sum + extractClipViews(post.text), 0),
    communityPosts: memberPosts.length,
    communityComments,
    communityReactions,
    communityShares,
    activePostDays,
    engagementRate: memberPosts.length ? Number((interactions / memberPosts.length).toFixed(2)) : 0,
    observedAt: twitch?.lastObservedAt,
  };
}

/** Gemini never changes these formula values. Missing follower history removes
 * that weight and the remaining real signals are re-normalized. */
export function calculateCreatorScores(metrics: CreatorRawMetrics): CreatorScoreBreakdown {
  const audienceReach = logScore(metrics.followers, 7);
  const audienceGrowth = metrics.hasFollowerHistory ? clampScore(50 + metrics.followerGrowthRate * 10) : 0;
  const viewerBase = Math.max(metrics.currentViewers, metrics.avgViewers, metrics.peakViewers * 0.7);
  const viewerPerformance = logScore(viewerBase, 6);
  const engagement = clampScore(metrics.engagementRate * 10);
  const consistency = clampScore((metrics.streamFrequencyDays / 30) * 70 + (metrics.activePostDays / 30) * 30);
  const activityUnits = metrics.communityPosts + metrics.communityComments * 2 + metrics.communityReactions + metrics.communityShares * 2;
  const communityActivity = logScore(activityUnits, Math.log10(501));
  const contentPerformance = logScore(metrics.clipViews + metrics.clipsCount * 100, 7);
  const weightedSignals = [
    { value: audienceReach, weight: 0.2, available: true },
    { value: audienceGrowth, weight: 0.15, available: metrics.hasFollowerHistory },
    { value: viewerPerformance, weight: 0.2, available: true },
    { value: engagement, weight: 0.15, available: true },
    { value: consistency, weight: 0.1, available: true },
    { value: communityActivity, weight: 0.1, available: true },
    { value: contentPerformance, weight: 0.1, available: true },
  ];
  const available = weightedSignals.filter((signal) => signal.available);
  const availableWeight = available.reduce((sum, signal) => sum + signal.weight, 0);
  const totalScore = Number((available.reduce((sum, signal) => sum + signal.value * signal.weight, 0) / availableWeight).toFixed(1));
  return { audienceReach, audienceGrowth, viewerPerformance, engagement, consistency, communityActivity, contentPerformance, totalScore };
}

export function generateCreatorAiAnalysis(member: Member, scores: CreatorScoreBreakdown, metrics: CreatorRawMetrics) {
  let badge = { text: "Community Member", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: "●" };
  let trajectory: CreatorRankedItem["aiAnalysis"]["growthTrajectory"] = "steady";
  if (member.status === "live") {
    badge = { text: "Live Now", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: "🔴" };
    trajectory = metrics.currentViewers >= 1000 ? "breakout" : "hyper-growth";
  } else if (member.role === "partner") {
    badge = { text: "Verified Partner", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: "💎" };
    trajectory = "titan";
  } else if (metrics.communityPosts || metrics.clipsCount) {
    badge = { text: "Active Creator", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: "💬" };
  }
  const categories = [
    ["Audience reach", scores.audienceReach], ["Follower growth", scores.audienceGrowth],
    ["Viewer performance", scores.viewerPerformance], ["Community engagement", scores.engagement],
    ["Consistency", scores.consistency], ["Community activity", scores.communityActivity],
    ["Clip performance", scores.contentPerformance],
  ] as const;
  const strongest = [...categories].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "No activity recorded";
  const headline = member.status === "live" ? `Live with ${metrics.currentViewers.toLocaleString()} current viewers` : `${metrics.followers.toLocaleString()} synced followers and ${metrics.communityPosts} stored posts`;
  const history = metrics.hasFollowerHistory ? `${metrics.followerGrowthRate >= 0 ? "+" : ""}${metrics.followerGrowthRate}% follower change across the stored observation window.` : "Follower growth will appear after at least two Twitch observations.";
  const summary = `Formula score ${scores.totalScore.toFixed(1)} from Twitch reach/viewership and Supabase activity: ${metrics.communityReactions} reactions, ${metrics.communityComments} comments, ${metrics.communityShares} shares, and ${metrics.clipViews.toLocaleString()} clip views. ${history}`;
  return { badge, aiAnalysis: { headline, summary, strongestCategory: strongest, growthTrajectory: trajectory } };
}

export function sortRankingItems(items: CreatorRankedItem[], category: RankingCategory) {
  const sorted = [...items].sort((left, right) => {
    switch (category) {
      case "watched": return right.metrics.avgViewers - left.metrics.avgViewers || right.metrics.currentViewers - left.metrics.currentViewers;
      case "engaged": return right.scores.engagement - left.scores.engagement || right.metrics.communityReactions - left.metrics.communityReactions;
      case "content": return right.scores.contentPerformance - left.scores.contentPerformance || right.metrics.clipViews - left.metrics.clipViews;
      case "active": return right.scores.communityActivity - left.scores.communityActivity || right.metrics.communityPosts - left.metrics.communityPosts;
      case "growing":
      case "rising": return right.scores.audienceGrowth - left.scores.audienceGrowth || right.rankDelta - left.rankDelta || right.scores.totalScore - left.scores.totalScore;
      default: return right.scores.totalScore - left.scores.totalScore || right.metrics.followers - left.metrics.followers;
    }
  });
  return sorted.map((item, index) => ({ ...item, rank: category === "overall" ? item.rank : index + 1 }));
}

export function computeRankings(members: Member[], posts: Post[], category: RankingCategory = "overall"): CreatorRankedItem[] {
  const items = members.map((member) => {
    const metrics = calculateCreatorMetrics(member, posts);
    const scores = calculateCreatorScores(metrics);
    const analysis = generateCreatorAiAnalysis(member, scores, metrics);
    return { member, metrics, scores, ...analysis, rank: 0, previousRank: 0, rankDelta: 0 } as CreatorRankedItem;
  });
  const ranked = sortRankingItems(items, "overall").map((item, index) => ({ ...item, rank: index + 1, previousRank: index + 1 }));
  return sortRankingItems(ranked, category);
}
