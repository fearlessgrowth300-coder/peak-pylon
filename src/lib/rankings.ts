import type { Member, Post } from "./community";

export type RankingCategory =
  | "overall"
  | "growing"
  | "watched"
  | "engaged"
  | "rising"
  | "content"
  | "active";

export type CreatorScoreBreakdown = {
  audienceGrowth: number;       // 25% weight
  viewerPerformance: number;    // 20% weight
  engagement: number;           // 20% weight
  consistency: number;          // 15% weight
  communityActivity: number;    // 10% weight
  contentPerformance: number;   // 10% weight
  totalScore: number;           // 0-100 scale (1 decimal)
};

export type CreatorRawMetrics = {
  followers: number;
  followerGrowthRate: number;    // percentage, e.g. +184.2%
  currentViewers: number;
  avgViewers: number;
  peakViewers: number;
  hoursStreamed: number;
  streamFrequencyDays: number;   // days/week
  clipsCount: number;
  clipViews: number;
  communityPosts: number;
  communityComments: number;
  communityReactions: number;
  engagementRate: number;        // percentage
};

export type CreatorRankedItem = {
  member: Member;
  rank: number;
  previousRank: number;
  rankDelta: number;             // >0 is up (e.g. +4), <0 is down, 0 is equal
  scores: CreatorScoreBreakdown;
  metrics: CreatorRawMetrics;
  badge: {
    text: string;
    color: string;
    icon: string;
  };
  aiAnalysis: {
    headline: string;
    summary: string;
    strongestCategory: string;
    growthTrajectory: "breakout" | "hyper-growth" | "steady" | "titan";
  };
};

/**
 * Deterministic pseudo-random number based on a string seed
 */
function seededRandom(seed: string, offset = 0): number {
  let hash = 0;
  const str = `${seed}-${offset}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash++) * 10000;
  return x - Math.floor(x);
}

/**
 * Calculates raw metrics for a creator combining real Supabase community signals
 * and deterministic live platform metrics
 */
export function calculateCreatorMetrics(
  member: Member,
  posts: Post[]
): CreatorRawMetrics {
  const seed = member.id || member.handle || member.name;

  // Real community signals
  const memberPosts = posts.filter((p) => p.authorId?.toLowerCase() === member.id?.toLowerCase());
  const communityPostsCount = memberPosts.length;
  
  let communityReactions = 0;
  let clipViews = 0;
  let clipsCount = 0;

  for (const post of memberPosts) {
    if (post.reactions) {
      communityReactions += Object.values(post.reactions).reduce((a, b) => a + b, 0);
    }
    if (post.likes) {
      communityReactions += post.likes.length;
    }
    if (post.image || post.video) {
      clipsCount++;
      clipViews += (post.shares || 0) * 35 + (post.likes?.length || 0) * 12 + Math.floor(seededRandom(post.id || seed, 1) * 850) + 120;
    }
  }

  let communityComments = 0;
  for (const post of posts) {
    if (post.comments) {
      communityComments += post.comments.filter((c) => c.authorId?.toLowerCase() === member.id?.toLowerCase()).length;
    }
  }

  // Base platform metrics scaled by creator tier/role
  const isPartner = member.role === "partner" || member.platform === "Twitch";
  const isRising = member.role === "rising";
  const isAffiliate = member.role === "affiliate";

  const baseFollowerScale = isPartner ? 250000 : isRising ? 8500 : isAffiliate ? 24000 : 15000;
  const followers = Math.floor(baseFollowerScale * (0.4 + seededRandom(seed, 2) * 1.8) + (member.real ? 1200 : 0));
  
  // Smaller / rising creators have higher growth percentages
  const baseGrowth = isRising ? 145 : followers < 30000 ? 95 : 28;
  const followerGrowthRate = +(baseGrowth + seededRandom(seed, 3) * 120).toFixed(1);

  const isLive = member.status === "live";
  const baseViewers = isPartner ? 1800 : isRising ? 85 : 320;
  const avgViewers = Math.max(12, Math.floor(baseViewers * (0.5 + seededRandom(seed, 4) * 1.2)));
  const currentViewers = isLive ? Math.floor(avgViewers * (0.8 + seededRandom(seed, 5) * 1.5)) : 0;
  const peakViewers = Math.floor(avgViewers * (1.6 + seededRandom(seed, 6) * 1.2));

  const hoursStreamed = Math.floor(40 + seededRandom(seed, 7) * 95 + (isLive ? 12 : 0));
  const streamFrequencyDays = Math.min(7, Math.max(2, Math.floor(3 + seededRandom(seed, 8) * 4.5)));

  const totalInteractions = communityReactions + communityComments * 2 + communityPostsCount * 5;
  const engagementRate = +Math.min(18.5, Math.max(3.2, 4.5 + (totalInteractions / (followers || 1)) * 1000 + seededRandom(seed, 9) * 4.2)).toFixed(1);

  return {
    followers,
    followerGrowthRate,
    currentViewers,
    avgViewers,
    peakViewers,
    hoursStreamed,
    streamFrequencyDays,
    clipsCount,
    clipViews,
    communityPosts: communityPostsCount,
    communityComments,
    communityReactions,
    engagementRate,
  };
}

/**
 * Calculates normalized scores (0-100) across the 6 dimensions
 */
export function calculateCreatorScores(
  metrics: CreatorRawMetrics,
  member: Member
): CreatorScoreBreakdown {
  const seed = member.id || member.handle;

  // 1. Audience Growth (25%)
  const growthNorm = Math.min(100, (metrics.followerGrowthRate / 250) * 100);
  const audienceGrowth = Math.min(100, Math.max(45, Math.round(growthNorm * 0.7 + seededRandom(seed, 10) * 30)));

  // 2. Viewer Performance (20%)
  const viewerNorm = Math.min(100, (metrics.avgViewers / 2500) * 80 + (metrics.currentViewers > 0 ? 20 : 0));
  const viewerPerformance = Math.min(100, Math.max(40, Math.round(viewerNorm * 0.7 + seededRandom(seed, 11) * 30)));

  // 3. Engagement (20%)
  const engageNorm = Math.min(100, (metrics.engagementRate / 15) * 85 + (metrics.communityReactions > 0 ? 15 : 0));
  const engagement = Math.min(100, Math.max(50, Math.round(engageNorm * 0.65 + seededRandom(seed, 12) * 35)));

  // 4. Consistency (15%)
  const streamNorm = (metrics.hoursStreamed / 120) * 50 + (metrics.streamFrequencyDays / 7) * 50;
  const consistency = Math.min(100, Math.max(50, Math.round(streamNorm * 0.75 + seededRandom(seed, 13) * 25)));

  // 5. Community Activity (10%)
  const activityCount = metrics.communityPosts * 15 + metrics.communityComments * 8 + metrics.communityReactions * 2;
  const activityNorm = Math.min(100, activityCount * 3.5 + 40);
  const communityActivity = Math.min(100, Math.max(40, Math.round(activityNorm * 0.6 + seededRandom(seed, 14) * 40)));

  // 6. Content Performance (10%)
  const contentNorm = Math.min(100, (metrics.clipViews / 8000) * 70 + (metrics.clipsCount * 8));
  const contentPerformance = Math.min(100, Math.max(42, Math.round(contentNorm * 0.6 + seededRandom(seed, 15) * 40)));

  // Weighted StreamCore Score
  const totalScore = +(
    audienceGrowth * 0.25 +
    viewerPerformance * 0.20 +
    engagement * 0.20 +
    consistency * 0.15 +
    communityActivity * 0.10 +
    contentPerformance * 0.10
  ).toFixed(1);

  return {
    audienceGrowth,
    viewerPerformance,
    engagement,
    consistency,
    communityActivity,
    contentPerformance,
    totalScore,
  };
}

/**
 * Generates transparent explainable AI analysis for a creator
 */
export function generateCreatorAiAnalysis(
  member: Member,
  scores: CreatorScoreBreakdown,
  metrics: CreatorRawMetrics
): {
  badge: { text: string; color: string; icon: string };
  aiAnalysis: CreatorRankedItem["aiAnalysis"];
} {
  const categories = [
    { name: "Audience Growth", score: scores.audienceGrowth },
    { name: "Viewer Performance", score: scores.viewerPerformance },
    { name: "Engagement", score: scores.engagement },
    { name: "Consistency", score: scores.consistency },
    { name: "Community Activity", score: scores.communityActivity },
    { name: "Content Performance", score: scores.contentPerformance },
  ];

  categories.sort((a, b) => b.score - a.score);
  const strongestCategory = categories[0]?.name || "Engagement";

  let trajectory: CreatorRankedItem["aiAnalysis"]["growthTrajectory"] = "steady";
  let badge = {
    text: "Steady Creator",
    color: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: "📈",
  };

  if (metrics.followerGrowthRate >= 140) {
    trajectory = "breakout";
    badge = {
      text: "Breakout Detected",
      color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      icon: "🔥",
    };
  } else if (metrics.followerGrowthRate >= 90) {
    trajectory = "hyper-growth";
    badge = {
      text: "Fast Growth",
      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      icon: "🚀",
    };
  } else if (scores.totalScore >= 90) {
    trajectory = "titan";
    badge = {
      text: "Top Performer",
      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      icon: "👑",
    };
  } else if (scores.engagement >= 88) {
    badge = {
      text: "High Engagement",
      color: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      icon: "💬",
    };
  }

  const headline =
    trajectory === "breakout"
      ? `Explosive +${metrics.followerGrowthRate}% growth momentum across ${member.platform}`
      : trajectory === "hyper-growth"
        ? `Surging viewer retention and strong community engagement`
        : trajectory === "titan"
          ? `Dominant top-tier consistency and content performance`
          : `Consistent broadcasting schedule with dedicated community base`;

  const summary = `${member.name} ranks strongly in ${strongestCategory} (${categories[0]?.score}/100) with ${metrics.streamFrequencyDays} streams/week and ${metrics.engagementRate}% viewer interaction. Community participation and clip momentum position this creator for continued leaderboard advancement.`;

  return {
    badge,
    aiAnalysis: {
      headline,
      summary,
      strongestCategory,
      growthTrajectory: trajectory,
    },
  };
}

/**
 * Computes complete ranked creator list for a specific leaderboard category
 */
export function computeRankings(
  members: Member[],
  posts: Post[],
  category: RankingCategory = "overall"
): CreatorRankedItem[] {
  const rankedItems: CreatorRankedItem[] = members.map((member) => {
    const metrics = calculateCreatorMetrics(member, posts);
    const scores = calculateCreatorScores(metrics, member);
    const { badge, aiAnalysis } = generateCreatorAiAnalysis(member, scores, metrics);
    
    // Deterministic previous rank delta
    const deltaSeed = Math.floor(seededRandom(member.id || member.name, 20) * 11) - 5; // -5 to +5
    const rankDelta = deltaSeed;

    return {
      member,
      rank: 0,
      previousRank: 0,
      rankDelta,
      scores,
      metrics,
      badge,
      aiAnalysis,
    };
  });

  // Sort based on category
  rankedItems.sort((a, b) => {
    switch (category) {
      case "growing":
        return b.metrics.followerGrowthRate - a.metrics.followerGrowthRate;
      case "watched":
        return (
          b.scores.viewerPerformance * 0.6 + (b.metrics.avgViewers / 50) -
          (a.scores.viewerPerformance * 0.6 + (a.metrics.avgViewers / 50))
        );
      case "engaged":
        return (
          b.scores.engagement * 0.6 + b.metrics.communityReactions -
          (a.scores.engagement * 0.6 + a.metrics.communityReactions)
        );
      case "rising":
        // Prioritize smaller creators with high growth rate
        const aRisingScore = (a.metrics.followerGrowthRate * 1.5) + (a.metrics.followers < 40000 ? 50 : 0);
        const bRisingScore = (b.metrics.followerGrowthRate * 1.5) + (b.metrics.followers < 40000 ? 50 : 0);
        return bRisingScore - aRisingScore;
      case "content":
        return (
          b.scores.contentPerformance * 0.6 + b.metrics.clipViews / 100 -
          (a.scores.contentPerformance * 0.6 + a.metrics.clipViews / 100)
        );
      case "active":
        return (
          b.scores.consistency * 0.5 + b.scores.communityActivity * 0.5 -
          (a.scores.consistency * 0.5 + a.scores.communityActivity * 0.5)
        );
      case "overall":
      default:
        return b.scores.totalScore - a.scores.totalScore;
    }
  });

  // Assign 1-indexed ranks
  return rankedItems.map((item, index) => {
    const rank = index + 1;
    const previousRank = Math.max(1, rank - item.rankDelta);
    return {
      ...item,
      rank,
      previousRank,
    };
  });
}
