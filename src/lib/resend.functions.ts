import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ServerResendConfig = {
  fromEmail: string;
  notifyNewAnnouncement: boolean;
  notifyRepliesAndMentions: boolean;
  notifyNewClips: boolean;
  notifyStreamerLive: boolean;
};

const RESEND_SECRET = "resend_api_key";
const RESEND_SETTING = "resend_notifications";
const DEFAULT_RESEND_CONFIG: ServerResendConfig = {
  fromEmail: "StreamCore Alerts <noreply@authenticcommunity.fun>",
  notifyNewAnnouncement: true,
  notifyRepliesAndMentions: true,
  notifyNewClips: true,
  notifyStreamerLive: true,
};

const adminTokenInput = z.object({ accessToken: z.string().min(20) });
const saveResendInput = adminTokenInput.extend({
  apiKey: z.string().trim().max(500),
  config: z.object({
    fromEmail: z.string().trim().min(3).max(240),
    notifyNewAnnouncement: z.boolean(),
    notifyRepliesAndMentions: z.boolean(),
    notifyNewClips: z.boolean(),
    notifyStreamerLive: z.boolean(),
  }),
});
const resendEmailInput = adminTokenInput.extend({
  from: z.string().min(1),
  to: z.array(z.string().email()).min(1).max(50),
  subject: z.string().min(1).max(180),
  html: z.string().min(1).max(40_000),
  text: z.string().max(10_000).optional(),
});
const resendTestInput = adminTokenInput.extend({ to: z.string().email() });
const notificationInput = adminTokenInput.extend({
  kind: z.enum(["announcement", "clip", "live", "reply", "mention"]),
  dedupeKey: z.string().min(1).max(240),
  subject: z.string().min(1).max(180),
  html: z.string().min(1).max(40_000),
  text: z.string().min(1).max(10_000),
});
const replyNotificationInput = adminTokenInput.extend({
  postId: z.string().min(1).max(240),
  channel: z.string().min(1).max(120).default("general"),
  parentPostId: z.string().min(1).max(240),
  replyAuthorId: z.string().min(1).max(240),
  replyAuthorName: z.string().min(1).max(120),
  replyText: z.string().min(1).max(4000),
});

async function loadResendKey(db: any) {
  const { readIntegrationSecret } = await import("@/lib/integrations.server");
  return (await readIntegrationSecret(db, RESEND_SECRET)) || process.env["RESEND_API_KEY"]?.trim() || "";
}

async function loadResendConfig(db: any) {
  const { readIntegrationSetting } = await import("@/lib/integrations.server");
  const stored = await readIntegrationSetting<Partial<ServerResendConfig>>(db, RESEND_SETTING, {});
  return { ...DEFAULT_RESEND_CONFIG, ...stored };
}

async function deliverResendEmail(
  apiKey: string,
  data: { from: string; to: string[]; subject: string; html: string; text?: string },
) {
  if (!apiKey) throw new Error("Add a Resend API key first.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: data.from,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text || data.subject,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Resend HTTP ${response.status}`);
  return { success: true, id: payload?.id as string | undefined };
}

export const getResendIntegrationStatus = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    const [apiKey, config] = await Promise.all([loadResendKey(db), loadResendConfig(db)]);
    return { configured: Boolean(apiKey), config };
  });

export const saveResendIntegration = createServerFn({ method: "POST" })
  .validator(saveResendInput)
  .handler(async ({ data }) => {
    const { requireAdmin, writeIntegrationSecret, writeIntegrationSetting } = await import("@/lib/integrations.server");
    const { db, user } = await requireAdmin(data.accessToken);
    const currentKey = await loadResendKey(db);
    if (!data.apiKey && !currentKey) throw new Error("Paste a Resend API key first.");
    if (data.apiKey) {
      if (!data.apiKey.startsWith("re_")) throw new Error("This does not look like a Resend API key.");
      await writeIntegrationSecret(db, RESEND_SECRET, data.apiKey, user.id);
    }
    await writeIntegrationSetting(db, RESEND_SETTING, data.config, user.id);
    return { configured: true, config: data.config };
  });

export const sendResendEmailServer = createServerFn({ method: "POST" })
  .validator(resendEmailInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    const apiKey = await loadResendKey(db);
    try {
      return await deliverResendEmail(apiKey, data);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Resend request failed" };
    }
  });

export const sendResendTestEmail = createServerFn({ method: "POST" })
  .validator(resendTestInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    const [apiKey, config] = await Promise.all([loadResendKey(db), loadResendConfig(db)]);
    return deliverResendEmail(apiKey, {
      from: config.fromEmail,
      to: [data.to],
      subject: "StreamCore integration test",
      html: '<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#8b5cf6">StreamCore Resend test</h2><p>The secure Resend connection is working.</p></div>',
      text: "The secure StreamCore Resend connection is working.",
    });
  });

export const dispatchResendNotification = createServerFn({ method: "POST" })
  .validator(notificationInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    await requireAdmin(data.accessToken);
    const { dispatchConfiguredResendEvent } = await import("@/lib/resend.server");
    return dispatchConfiguredResendEvent(data);
  });

export const dispatchReplyNotification = createServerFn({ method: "POST" })
  .validator(replyNotificationInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Sign in again before sending a reply notification.");
    if (authData.user.id !== data.replyAuthorId) {
      const { data: adminRole } = await db.from("user_roles").select("role").eq("user_id", authData.user.id).eq("role", "admin").maybeSingle();
      if (!adminRole) throw new Error("You cannot send notifications as another member.");
    }

    const [{ data: parent }, { data: post }, { data: profiles }] = await Promise.all([
      data.parentPostId ? db.from("community_posts").select("id, data").eq("id", data.parentPostId).maybeSingle() : Promise.resolve({ data: null }),
      db.from("community_posts").select("id, data").eq("id", data.postId).maybeSingle(),
      db.from("profiles").select("id, handle"),
    ]);
    if (!post || post.data?.authorId !== data.replyAuthorId) return { sent: 0, status: "not_applicable" };
    const recipientIds = new Set<string>();
    const parentAuthorId = parent?.data?.authorId as string | undefined;
    if (parentAuthorId && parentAuthorId !== data.replyAuthorId) recipientIds.add(parentAuthorId);
    const mentions = new Set(Array.from(data.replyText.matchAll(/@([a-zA-Z0-9_]{2,40})/g), (match) => match[1]!.toLowerCase()));
    for (const profile of profiles ?? []) {
      const handle = String(profile.handle || "").replace(/^@/, "").toLowerCase();
      if (handle && mentions.has(handle) && profile.id !== data.replyAuthorId) recipientIds.add(profile.id);
    }
    if (!recipientIds.size) return { sent: 0, status: "not_applicable" };

    const safeName = data.replyAuthorName.replace(/[<>&\"']/g, "");
    const safeText = data.replyText.replace(/[<>&\"']/g, "");
    const { dispatchConfiguredResendEvent } = await import("@/lib/resend.server");
    return dispatchConfiguredResendEvent({
      kind: parentAuthorId ? "reply" : "mention",
      dedupeKey: `post-alert:${post.id}`,
      recipientUserIds: [...recipientIds],
      subject: parentAuthorId ? `💬 ${data.replyAuthorName} replied to you on StreamCore` : `🔔 ${data.replyAuthorName} mentioned you on StreamCore`,
      text: `${data.replyAuthorName}: ${data.replyText}`,
      html: `<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#8b5cf6">Message from ${safeName}</h2><p>${safeText}</p><a href="https://peak-pylon.vercel.app/?view=${encodeURIComponent(data.channel)}&post=${encodeURIComponent(post.id)}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px">Open the exact message →</a></div>`,
    });
  });

const twitchConnectedInput = z.object({
  accessToken: z.string().min(20),
  channelName: z.string().min(1),
  channelUrl: z.string().optional(),
});

export const sendTwitchConnectedEmail = createServerFn({ method: "POST" })
  .validator(twitchConnectedInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user || !authData.user.email) return { sent: 0, status: "no_email" };

    const db = supabaseAdmin as any;
    const [apiKey, config] = await Promise.all([loadResendKey(db), loadResendConfig(db)]);
    if (!apiKey) return { sent: 0, status: "no_api_key" };

    const email = authData.user.email;
    const cleanName = data.channelName.replace(/[<>&\"']/g, "");

    try {
      await deliverResendEmail(apiKey, {
        from: config.fromEmail || "StreamCore <noreply@authenticcommunity.fun>",
        to: [email],
        subject: `🎉 Congratulations! Your Twitch channel is connected on StreamCore`,
        text: `Congratulations! You just connected your Twitch channel (${cleanName}) on StreamCore, where people discover you and make you grow together. Welcome to the creator network!`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d0e12;color:#ffffff;padding:32px;border-radius:16px;max-width:560px;margin:0 auto;border:1px solid rgba(139,92,246,0.3)">
            <div style="text-align:center;margin-bottom:24px">
              <span style="font-size:36px">🟣</span>
              <h1 style="color:#a78bfa;margin:12px 0 6px 0;font-size:24px;font-weight:800">Twitch Channel Connected!</h1>
              <p style="color:#94a3b8;font-size:14px;margin:0">Official StreamCore Creator Network</p>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:20px 0">
              <p style="font-size:15px;line-height:1.6;color:#e2e8f0;margin:0">
                <strong>Congratulations!</strong> You just connected your Twitch channel (<strong style="color:#c084fc">@${cleanName}</strong>) on StreamCore, where people discover you and make you grow together!
              </p>
            </div>
            <div style="text-align:center;margin-top:28px">
              <a href="https://peak-pylon.vercel.app" style="background:#9333ea;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block">
                Enter Community #general →
              </a>
            </div>
          </div>
        `,
      });
      return { sent: 1, status: "delivered" };
    } catch (err) {
      console.error("Failed to deliver Twitch connected email:", err);
      return { sent: 0, status: "error" };
    }
  });
