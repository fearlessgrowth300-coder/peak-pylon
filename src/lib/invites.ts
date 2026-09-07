import { supabase } from "@/integrations/supabase/client";
import { dispatchResendNotification } from "@/lib/resend.functions";

export interface CommunityInvite {
  id: string;
  code: string;
  inviter_id: string;
  inviter_name: string;
  inviter_handle: string;
  campaign: string;
  status: "pending" | "joined" | "approved" | "expired";
  invited_creator_id?: string | null;
  invited_creator_name?: string | null;
  invited_creator_handle?: string | null;
  invited_creator_channel?: string | null;
  pv_token?: string | null;
  created_at: string;
  joined_at?: string | null;
  approved_at?: string | null;
}

export interface PendingCreatorApproval {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string;
  banner_url: string;
  channel_url: string;
  platform: string;
  approval_status: string;
  channel_authorized: boolean;
  pv_token?: string;
  created_at: string;
  invite_code_used?: string;
  inviter_id?: string;
}

// Generate new unique invite link (e.g. SC-8F42K)
export async function createCommunityInvite(
  inviterId: string,
  inviterName: string,
  inviterHandle: string,
  campaign: string = "direct"
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "SC-";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { data, error } = await supabase
      .from("community_invites")
      .insert({
        code,
        inviter_id: inviterId,
        inviter_name: inviterName,
        inviter_handle: inviterHandle.startsWith("@") ? inviterHandle : `@${inviterHandle}`,
        campaign: campaign || "direct",
        status: "pending",
      })
      .select("code")
      .single();

    if (error) {
      // Fallback direct RPC if available
      const { data: rpcCode, error: rpcError } = await supabase.rpc("create_community_invite", {
        p_inviter_id: inviterId,
        p_inviter_name: inviterName,
        p_inviter_handle: inviterHandle,
        p_campaign: campaign || "direct",
      });
      if (rpcError) throw rpcError;
      return { success: true, code: rpcCode as string };
    }

    return { success: true, code: data?.code || code };
  } catch (err: any) {
    console.error("Create invite error:", err);
    return { success: false, error: err?.message || "Could not generate invite" };
  }
}

// Fetch all community invites for Admin & Inviter CRM
export async function fetchCommunityInvites(): Promise<CommunityInvite[]> {
  try {
    const { data, error } = await supabase
      .from("community_invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as CommunityInvite[]) || [];
  } catch (err) {
    console.error("Fetch invites error:", err);
    return [];
  }
}

// Lookup single invite by code
export async function getInviteByCode(code: string): Promise<CommunityInvite | null> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const { data, error } = await supabase
      .from("community_invites")
      .select("*")
      .eq("code", cleanCode)
      .maybeSingle();

    if (error) throw error;
    return data as CommunityInvite | null;
  } catch (err) {
    console.error("Lookup invite error:", err);
    return null;
  }
}

// Claim invite on creator signup
export async function claimInviteOnSignup(
  code: string,
  creatorId: string,
  creatorName: string,
  creatorHandle: string,
  channelUrl: string = ""
): Promise<boolean> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const { error } = await supabase
      .from("community_invites")
      .update({
        status: "joined",
        invited_creator_id: creatorId,
        invited_creator_name: creatorName,
        invited_creator_handle: creatorHandle.startsWith("@") ? creatorHandle : `@${creatorHandle}`,
        invited_creator_channel: channelUrl,
        joined_at: new Date().toISOString(),
      })
      .eq("code", cleanCode);

    if (error) console.warn("Claim invite update error:", error);

    await supabase
      .from("profiles")
      .update({
        invite_code_used: cleanCode,
      })
      .eq("id", creatorId);

    return true;
  } catch (err) {
    console.error("Claim invite error:", err);
    return false;
  }
}

// Fetch all pending creator approvals for Admin Control Center
export async function fetchPendingApprovals(): Promise<PendingCreatorApproval[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url, banner_url, channel_url, platform, approval_status, channel_authorized, pv_token, created_at, invite_code_used, inviter_id")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as PendingCreatorApproval[]) || [];
  } catch (err) {
    console.error("Fetch pending approvals error:", err);
    return [];
  }
}

// Post official welcoming announcement from StreamCore Bot into #general
export async function postCreatorWelcomeAnnouncement(creator: {
  id: string;
  name: string;
  handle?: string | null;
  channelUrl?: string | null;
  platform?: string | null;
  avatarUrl?: string | null;
}) {
  try {
    const displayName = creator.name || "Creator";
    const rawHandle = creator.handle || `@${displayName.toLowerCase().replace(/\s+/g, "")}`;
    const handle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    const platform = creator.platform || "Twitch";
    const channelLink = creator.channelUrl?.trim() || "";
    const linkText = channelLink ? `\n\n📺 Stream Channel: ${channelLink}` : "";

    const welcomeText = `🎉 Official Welcome: Please welcome ${handle} (${displayName}) to the StreamCore creator community! 🚀\nTheir ${platform} channel has been officially verified and approved by the admin team. Drop them a follow, say hello in chat, and let's show them some community love and raid support! 🔥${linkText}`;

    const welcomePostId = `welcome-${creator.id}`;

    // Check if welcome post was already published
    const { data: existing } = await supabase
      .from("community_posts")
      .select("id")
      .eq("id", welcomePostId)
      .maybeSingle();

    if (existing?.id) {
      return null;
    }

    const welcomePost = {
      id: welcomePostId,
      authorId: "streamcore_bot",
      authorName: "STREAMCORE BOT",
      authorHandle: "@streamcore",
      authorAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=streamcore_bot",
      channel: "general",
      text: welcomeText,
      time: Date.now(),
      reactions: { "🎉": 4, "❤️": 3, "🔥": 3, "🚀": 2 },
      likes: ["streamcore_bot"],
      comments: [],
    };

    const { error } = await supabase.from("community_posts").upsert({
      id: welcomePostId,
      data: welcomePost,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("Could not post welcome announcement:", error);
      return null;
    }

    // Schedule an automated friendly community streamer reply to celebrate the new creator
    setTimeout(async () => {
      try {
        const welcomeReplies = [
          `Welcome to the squad ${handle}! Excited to check out your stream 🔥`,
          `Welcome aboard ${handle}! Dropping you a follow right now, let's get it 🚀`,
          `Huge welcome ${handle}! So glad to have you in the creator network 👑`,
          `Welcome to the community ${handle}! Let's definitely run some raids soon 🔥`,
        ];
        const { data: listed } = await supabase.from("community_listed_members").select("id, data").limit(20);
        const candidates = (listed ?? []).filter((m: any) => m.data?.name && m.id !== creator.id);
        const replier = candidates[Math.floor(Math.random() * (candidates.length || 1))];
        if (replier) {
          const replyId = `welcome-reply-${creator.id}-${Date.now()}`;
          const replyText = welcomeReplies[Math.floor(Math.random() * welcomeReplies.length)]!;
          const replyRecord = {
            id: replyId,
            authorId: replier.id,
            authorName: replier.data?.name || "Creator",
            authorHandle: replier.data?.handle || `@${(replier.data?.name || "creator").toLowerCase().replace(/\s+/g, "")}`,
            authorAvatar: replier.data?.avatar || "",
            channel: "general",
            text: replyText,
            replyToId: welcomePostId,
            time: Date.now(),
            reactions: { "❤️": 2, "🔥": 1 },
            likes: [],
            comments: [],
          };
          await supabase.from("community_posts").upsert({
            id: replyId,
            data: replyRecord,
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn("Welcome reply error:", err);
      }
    }, 3500);

    return welcomePost;
  } catch (err) {
    console.warn("Welcome announcement error:", err);
    return null;
  }
}

// Approve creator channel using PV Token & send celebration email
export async function approveCreatorChannelWithPvToken(
  creatorId: string,
  pvToken: string,
  adminId: string,
  creatorEmail?: string,
  creatorDetails?: {
    name?: string;
    handle?: string | null;
    channelUrl?: string | null;
    platform?: string | null;
    avatarUrl?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanToken = pvToken.trim().toUpperCase();
    if (!cleanToken) {
      return { success: false, error: "Please enter a valid PV Token" };
    }

    // Call database approval RPC
    const { data: approvalData, error: rpcError } = await supabase.rpc("approve_creator_channel", {
      p_creator_id: creatorId,
      p_pv_token: cleanToken,
      p_admin_id: adminId,
    });

    if (rpcError) {
      throw rpcError;
    }

    const result = approvalData as { success?: boolean; error?: string } | null;
    if (!result?.success) {
      return { success: false, error: result?.error || "The channel could not be approved." };
    }

    // Fetch creator profile if needed to guarantee accurate name/handle/channel
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, handle, channel_url, platform, avatar_url")
      .eq("id", creatorId)
      .maybeSingle();

    const name = creatorDetails?.name || profile?.display_name || "Creator";
    const handle = creatorDetails?.handle || profile?.handle;
    const channelUrl = creatorDetails?.channelUrl || profile?.channel_url;
    const platform = creatorDetails?.platform || profile?.platform || "Twitch";
    const avatarUrl = creatorDetails?.avatarUrl || profile?.avatar_url;

    // Immediately post official welcome announcement to #general by StreamCore Bot
    await postCreatorWelcomeAnnouncement({
      id: creatorId,
      name,
      handle,
      channelUrl,
      platform,
      avatarUrl,
    });

    // Send congratulatory email to creator if email is available
    if (creatorEmail) {
      try {
        await dispatchResendNotification({
          data: {
            notificationType: "broadcast",
            recipientEmails: [creatorEmail],
            title: "🎉 Congratulations! Your StreamCore Channel is Approved!",
            body: "Your streaming channel has been officially verified and approved in StreamCore! You now have full access to community chat, creator raid trains, live stream features, and rankings.",
            actionUrl: "https://peak-pylon.vercel.app/#general",
            actionLabel: "Join Community Chat Now ↗",
          },
        });
      } catch (emailErr) {
        console.warn("Approval email dispatch non-blocking notice:", emailErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Approve channel error:", err);
    return { success: false, error: err?.message || "Could not approve channel" };
  }
}

// Admin Partner Showcase for onboarding profile setup screen
export async function fetchPartnerShowcaseStreamers(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("integration_settings")
      .select("setting_value")
      .eq("setting_name", "onboarding_partner_showcase")
      .maybeSingle();

    if (!error && data?.setting_value && Array.isArray(data.setting_value)) {
      return data.setting_value as string[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function savePartnerShowcaseStreamers(streamerIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("integration_settings")
      .upsert(
        {
          setting_name: "onboarding_partner_showcase",
          setting_value: streamerIds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_name" }
      );
    return !error;
  } catch {
    return false;
  }
}
