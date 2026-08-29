import type { Member, Post } from "./community";

export type RankingCategory = "overall" | "growing" | "watched" | "engaged" | "rising" | "content" | "active";

export type CreatorScoreBreakdown = {
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
  engagementRate: number;
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
  };
};

function extractClipViews(text: string) {
  const match = text.match(/(?:👁\s*)?([\d,.]+)\s+views/i);
  return match ? Number(match[1]?.replaceAll(",", "") || 0) : 0;
}

export function calculateCreatorMetrics(member: Member, posts: Post[]): CreatorRawMetrics {
  const memberPosts = posts.filter((post) => post.authorId?.toLowerCase() === member.id?.toLowerCase());
  const clipPosts = memberPosts.filter((post) => post.channel === "clips");
  const communityReactions = memberPosts.reduce((sum, post) => (
    sum +
    Object.values(post.reactions ?? {}).reduce((total, count) => total + count, 0) +
    (post.likes?.length ?? 0)
  ), 0);
  const communityComments = memberPosts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0);
  const interactions = communityReactions + communityComments + memberPosts.reduce((sum, post) => sum + (post.shares ?? 0), 0);

  return {
    followers: member.followers ?? 0,
    followerGrowthRate: 0,
    currentViewers: member.status === "live" ? member.viewerCount ?? 0 : 0,
    avgViewers: member.status === "live" ? member.viewerCount ?? 0 : 0,
    peakViewers: member.status === "live" ? member.viewerCount ?? 0 : 0,
    hoursStreamed: 0,
    streamFrequencyDays: 0,
    clipsCount: clipPosts.length,
    clipViews: clipPosts.reduce((sum, post) => sum + extractClipViews(post.text), 0),
    communityPosts: memberPosts.length,
    communityComments,
    communityReactions,
    engagementRate: memberPosts.length ? Number((interactions / memberPosts.length).toFixed(1)) : 0,
  };
}

export function calculateCreatorScores(metrics: CreatorRawMetrics): CreatorScoreBreakdown {
  const audienceGrowth = 0;
  const viewerPerformance = Math.min(100, Math.round(Math.log10(metrics.currentViewers + 1) * 25));
  const engagement = Math.min(100, Math.round(metrics.engagementRate * 5));
  const consistency = Math.min(100, metrics.communityPosts * 5);
  const communityActivity = Math.min(100, metrics.communityPosts * 4 + metrics.communityComments * 3 + metrics.communityReactions);
  const contentPerformance = Math.min(100, metrics.clipsCount * 8 + Math.round(Math.log10(metrics.clipViews + 1) * 15));
  const totalScore = Number((
    viewerPerformance * 0.3 +
    engagement * 0.25 +
    consistency * 0.15 +
    communityActivity * 0.15 +
    contentPerformance * 0.15
  ).toFixed(1));
  return { audienceGrowth, viewerPerformance, engagement, consistency, communityActivity, contentPerformance, totalScore };
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
    ["Current viewers", scores.viewerPerformance],
    ["Community engagement", scores.engagement],
    ["Community activity", scores.communityActivity],
    ["Clip performance", scores.contentPerformance],
  ] as const;
  const strongest = [...categories].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "No activity recorded";
  const headline = member.status === "live"
    ? `Live with ${metrics.currentViewers.toLocaleString()} current viewers`
    : `${metrics.followers.toLocaleString()} synced followers and ${metrics.communityPosts} community posts`;
  const summary = `Based on current Twitch fields and ${metrics.communityPosts} Supabase posts: ${metrics.communityReactions} reactions, ${metrics.communityComments} comments, and ${metrics.clipViews.toLocaleString()} recorded clip views. Historical follower growth is not available.`;

  return { badge, aiAnalysis: { headline, summary, strongestCategory: strongest, growthTrajectory: trajectory } };
}

export function computeRankings(members: Member[], posts: Post[], category: RankingCategory = "overall"): CreatorRankedItem[] {
  const items = members.map((member) => {
    const metrics = calculateCreatorMetrics(member, posts);
    const scores = calculateCreatorScores(metrics);
    const analysis = generateCreatorAiAnalysis(member, scores, metrics);
    return { member, metrics, scores, ...analysis };
  });

  items.sort((left, right) => {
    switch (category) {
      case "watched":
        return right.metrics.currentViewers - left.metrics.currentViewers;
      case "engaged":
        return right.metrics.communityReactions + right.metrics.communityComments - left.metrics.communityReactions - left.metrics.communityComments;
      case "content":
        return right.metrics.clipViews - left.metrics.clipViews || right.metrics.clipsCount - left.metrics.clipsCount;
      case "active":
        return right.metrics.communityPosts - left.metrics.communityPosts;
      case "growing":
      case "rising":
        return right.metrics.communityPosts + right.metrics.communityReactions - left.metrics.communityPosts - left.metrics.communityReactions;
      default:
        return right.scores.totalScore - left.scores.totalScore || right.metrics.followers - left.metrics.followers;
    }
  });

  return items.map((item, index) => ({ ...item, rank: index + 1, previousRank: index + 1, rankDelta: 0 }));
}
