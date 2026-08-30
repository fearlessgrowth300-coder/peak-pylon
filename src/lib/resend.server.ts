import { supabaseAdmin } from "@/integrations/supabase/client.server";

type NotificationKind = "announcement" | "clip" | "live" | "reply";

type ResendEvent = {
  kind: NotificationKind;
  dedupeKey: string;
  subject: string;
  html: string;
  text: string;
  recipientUserIds?: string[];
};

const ENABLED_FIELD: Record<NotificationKind, string> = {
  announcement: "notifyNewAnnouncement",
  clip: "notifyNewClips",
  live: "notifyStreamerLive",
  reply: "notifyRepliesAndMentions",
};

export async function dispatchConfiguredResendEvent(event: ResendEvent) {
  const db = supabaseAdmin as any;
  const [{ data: keyRow }, { data: configRow }] = await Promise.all([
    db.from("integration_secrets").select("secret_value").eq("secret_name", "resend_api_key").maybeSingle(),
    db.from("integration_settings").select("setting_value").eq("setting_name", "resend_notifications").maybeSingle(),
  ]);
  const apiKey = (keyRow?.secret_value as string | undefined)?.trim() || process.env["RESEND_API_KEY"]?.trim() || "";
  const config = {
    fromEmail: "StreamCore Alerts <noreply@authenticcommunity.fun>",
    notifyNewAnnouncement: true,
    notifyRepliesAndMentions: true,
    notifyNewClips: true,
    notifyStreamerLive: true,
    ...(configRow?.setting_value ?? {}),
  } as Record<string, unknown>;
  if (!apiKey || config[ENABLED_FIELD[event.kind]] !== true) {
    return { sent: 0, status: apiKey ? "disabled" : "not_configured" };
  }

  const markerName = `resend_event:${event.kind}:${event.dedupeKey.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 160)}`;
  const { error: markerError } = await db.from("integration_settings").insert({
    setting_name: markerName,
    setting_value: { status: "sending", createdAt: new Date().toISOString() },
    updated_by: null,
    updated_at: new Date().toISOString(),
  });
  if (markerError?.code === "23505") return { sent: 0, status: "duplicate" };
  if (markerError) throw markerError;

  try {
    const recipients: string[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const targetIds = event.recipientUserIds?.length ? new Set(event.recipientUserIds) : null;
      const emails = data.users
        .filter((user) => !targetIds || targetIds.has(user.id))
        .filter((user) => Boolean(user.email && user.email_confirmed_at && !user.is_anonymous))
        .map((user) => user.email!)
        .filter((email) => !recipients.includes(email));
      recipients.push(...emails);
      if (targetIds && recipients.length >= targetIds.size) break;
      if (data.users.length < 1000) break;
    }
    if (!recipients.length) {
      await db.from("integration_settings").update({
        setting_value: { status: "no_recipients", sent: 0, completedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("setting_name", markerName);
      return { sent: 0, status: "no_recipients" };
    }

    let sent = 0;
    for (let offset = 0; offset < recipients.length; offset += 100) {
      const batch = recipients.slice(offset, offset + 100).map((email) => ({
        from: String(config.fromEmail),
        to: [email],
        subject: event.subject,
        html: event.html,
        text: event.text,
      }));
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${markerName}:${offset}`.slice(0, 256),
        },
        body: JSON.stringify(batch),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || `Resend HTTP ${response.status}`);
      sent += batch.length;
    }

    await db.from("integration_settings").update({
      setting_value: { status: "sent", sent, completedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq("setting_name", markerName);
    return { sent, status: "sent" };
  } catch (error) {
    await db.from("integration_settings").delete().eq("setting_name", markerName);
    throw error;
  }
}
