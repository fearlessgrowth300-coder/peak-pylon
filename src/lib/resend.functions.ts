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
  kind: z.enum(["announcement", "clip", "live", "reply"]),
  dedupeKey: z.string().min(1).max(240),
  subject: z.string().min(1).max(180),
  html: z.string().min(1).max(40_000),
  text: z.string().min(1).max(10_000),
});
const replyNotificationInput = adminTokenInput.extend({
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

    const [{ data: parent }, { data: replyRows }] = await Promise.all([
      db.from("community_posts").select("id, data").eq("id", data.parentPostId).maybeSingle(),
      db.from("community_posts")
        .select("id, data, created_at")
        .eq("data->>replyToId", data.parentPostId)
        .eq("data->>authorId", data.replyAuthorId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const reply = replyRows?.[0];
    const recipientUserId = parent?.data?.authorId as string | undefined;
    if (!reply || !recipientUserId || recipientUserId === data.replyAuthorId) return { sent: 0, status: "not_applicable" };

    const safeName = data.replyAuthorName.replace(/[<>&\"']/g, "");
    const safeText = data.replyText.replace(/[<>&\"']/g, "");
    const { dispatchConfiguredResendEvent } = await import("@/lib/resend.server");
    return dispatchConfiguredResendEvent({
      kind: "reply",
      dedupeKey: `reply:${reply.id}`,
      recipientUserIds: [recipientUserId],
      subject: `💬 ${data.replyAuthorName} replied to you on StreamCore`,
      text: `${data.replyAuthorName}: ${data.replyText}`,
      html: `<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#8b5cf6">New reply from ${safeName}</h2><p>${safeText}</p><a href="https://peak-pylon.vercel.app" style="color:#a78bfa">Open the conversation →</a></div>`,
    });
  });
