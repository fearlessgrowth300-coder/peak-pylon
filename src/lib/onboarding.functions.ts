import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const authenticatedInput = z.object({ accessToken: z.string().min(20) });
const profileInput = authenticatedInput.extend({
  profile: z.object({
    display_name: z.string().trim().min(1).max(80),
    bio: z.string().max(1000),
    avatar_url: z.string().max(2048),
    banner_url: z.string().max(2048),
    social_links: z.array(z.object({
      platform: z.string().min(1).max(40),
      label: z.string().max(80),
      url: z.string().url().max(2048),
      verified: z.boolean().optional(),
      provider: z.string().max(40).optional(),
      providerIdentityId: z.string().max(200).optional(),
    })).max(6),
  }),
});

async function authenticatedUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Your session has expired. Please sign in again.");
  return { db: supabaseAdmin as any, user: data.user };
}

export const acknowledgeCommunityRules = createServerFn({ method: "POST" })
  .validator(authenticatedInput)
  .handler(async ({ data }) => {
    const { db, user } = await authenticatedUser(data.accessToken);
    const { error } = await db
      .from("profiles")
      .update({ rules_acknowledged: true, rules_acknowledged_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) throw error;
    return { acknowledged: true };
  });

type MilestoneKey = "youtube" | "discord" | "twitter" | "kick" | "tiktok" | "instagram";

export type CreatorMilestoneStatus = {
  metrics: {
    generalMessages: number;
    receivedReactions: number;
    hostedRaids: number;
    rankingPosition: number | null;
    streamerLevel: number;
    activityPoints: number;
    verifiedPartner: boolean;
  };
  unlocks: Record<MilestoneKey, boolean>;
};

async function calculateMilestones(db: any, userId: string): Promise<CreatorMilestoneStatus> {
    const [{ count: generalMessages }, { data: roleRows }, { data: rankRow }, { count: hostedRaids }] = await Promise.all([
      db.from("community_posts").select("id", { count: "exact", head: true }).eq("data->>authorId", userId).eq("data->>channel", "general"),
      db.from("user_roles").select("role").eq("user_id", userId),
      db.from("creator_metric_snapshots").select("rank, captured_at").eq("creator_id", userId).order("captured_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("creator_raid_events").select("id", { count: "exact", head: true }).eq("creator_id", userId),
    ]);

    let receivedReactions = 0;
    for (let offset = 0; offset < 5000; offset += 500) {
      const { data: rows, error } = await db
        .from("community_posts")
        .select("data")
        .eq("data->>authorId", userId)
        .range(offset, offset + 499);
      if (error) throw error;
      for (const row of rows ?? []) {
        const post = row.data ?? {};
        const reactions = post.reactions && typeof post.reactions === "object" ? Object.values(post.reactions) : [];
        receivedReactions += reactions.reduce((sum: number, value: unknown) => sum + (Number(value) || 0), 0);
        if (Array.isArray(post.likes)) receivedReactions += post.likes.length;
      }
      if ((rows ?? []).length < 500) break;
    }

    const messageCount = Number(generalMessages ?? 0);
    const raidCount = Number(hostedRaids ?? 0);
    const rankingPosition = rankRow?.rank ? Number(rankRow.rank) : null;
    const verifiedPartner = (roleRows ?? []).some((row: { role?: string }) => row.role === "partner");
    // Transparent level formula: messages + half of received reactions + ten points per confirmed raid.
    const activityPoints = messageCount + Math.floor(receivedReactions / 2) + raidCount * 10;
    const streamerLevel = 1 + Math.floor(activityPoints / 50);

    return {
      metrics: {
        generalMessages: messageCount,
        receivedReactions,
        hostedRaids: raidCount,
        rankingPosition,
        streamerLevel,
        activityPoints,
        verifiedPartner,
      },
      unlocks: {
        youtube: messageCount >= 50,
        discord: streamerLevel >= 2,
        twitter: receivedReactions >= 100,
        kick: raidCount >= 5,
        tiktok: rankingPosition !== null && rankingPosition <= 50,
        instagram: verifiedPartner,
      },
    };
}

export const getCreatorMilestoneStatus = createServerFn({ method: "POST" })
  .validator(authenticatedInput)
  .handler(async ({ data }): Promise<CreatorMilestoneStatus> => {
    const { db, user } = await authenticatedUser(data.accessToken);
    return calculateMilestones(db, user.id);
  });

export const saveCreatorProfile = createServerFn({ method: "POST" })
  .validator(profileInput)
  .handler(async ({ data }) => {
    const { db, user } = await authenticatedUser(data.accessToken);
    const status = await calculateMilestones(db, user.id);
    const { data: currentProfile, error: currentError } = await db
      .from("profiles")
      .select("social_links")
      .eq("id", user.id)
      .maybeSingle();
    if (currentError) throw currentError;
    const currentLinks = new Map<string, string>(
      (Array.isArray(currentProfile?.social_links) ? currentProfile.social_links : [])
        .map((link: { platform?: string; url?: string }) => [String(link.platform || ""), String(link.url || "")]),
    );
    const platformKeys: Record<string, keyof CreatorMilestoneStatus["unlocks"]> = {
      YouTube: "youtube",
      Discord: "discord",
      "X (Twitter)": "twitter",
      X: "twitter",
      Kick: "kick",
      TikTok: "tiktok",
      Instagram: "instagram",
    };
    for (const link of data.profile.social_links) {
      const key = platformKeys[link.platform];
      const unchangedExistingLink = currentLinks.get(link.platform) === link.url;
      if (!unchangedExistingLink && (!key || !status.unlocks[key])) {
        throw new Error(`${link.platform} has not been unlocked by your real community milestones.`);
      }
      if (!unchangedExistingLink && !link.verified) {
        throw new Error(`${link.platform} must be connected through secure authorization, not pasted as a URL.`);
      }
    }
    const { error } = await db.from("profiles").update(data.profile).eq("id", user.id);
    if (error) throw error;
    return { saved: true, milestones: status };
  });
