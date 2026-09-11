import { supabaseAdmin } from "@/integrations/supabase/client.server";

type NotificationKind = "announcement" | "clip" | "live" | "reply" | "mention" | "twitch_connected";

type ResendEvent = {
  kind: NotificationKind;
  dedupeKey: string;
  subject: string;
  html: string;
  text: string;
  recipientUserIds?: string[];
};

const ENABLED_FIELD: Partial<Record<NotificationKind, string>> = {
  announcement: "notifyNewAnnouncement",
  clip: "notifyNewClips",
  live: "notifyStreamerLive",
  reply: "notifyRepliesAndMentions",
  mention: "notifyRepliesAndMentions",
};

// Keep the shared Resend allowance available for Supabase Auth verification.
// High-volume community activity stays visible inside StreamCore instead of
// sending one email per member. Direct, member-specific notifications are
// additionally capped so a busy chat cannot exhaust the provider quota.
const IN_APP_ONLY_KINDS = new Set<NotificationKind>(["announcement", "clip", "live"]);
const MAX_DIRECT_EMAILS_PER_UTC_DAY = 20;

function startOfUtcDay() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

export async function dispatchConfiguredResendEvent(event: ResendEvent) {
  const db = supabaseAdmin as any;
  const [{ data: keyRow }, { data: configRow }] = await Promise.all([
    db.from("integration_secrets").select("secret_value").eq("secret_name", "resend_api_key").maybeSingle(),
    db.from("integration_settings").select("setting_value").eq("setting_name", "resend_notifications").maybeSingle(),
  ]);
  const apiKey = (keyRow?.secret_value as string | undefined)?.trim() || process.env["RESEND_API_KEY"]?.trim() || "";
  const config = {
    fromEmail: "StreamCore Alerts <noreply@authenticcommunity.fun>",
    notifyNewAnnouncement: false,
    notifyRepliesAndMentions: true,
    notifyNewClips: false,
    notifyStreamerLive: false,
    ...(configRow?.setting_value ?? {}),
  } as Record<string, unknown>;
  const enabledField = ENABLED_FIELD[event.kind];
  if (!apiKey || (enabledField && config[enabledField] !== true)) {
    return { sent: 0, status: apiKey ? "disabled" : "not_configured" };
  }

  if (IN_APP_ONLY_KINDS.has(event.kind) && !event.recipientUserIds?.length) {
    return { sent: 0, status: "in_app_only" };
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

    await db.from("integration_settings").update({
      setting_value: {
        status: "reserved",
        reserved: recipients.length,
        createdAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq("setting_name", markerName);

    const { data: dailyRows, error: dailyRowsError } = await db
      .from("integration_settings")
      .select("setting_value")
      .like("setting_name", "resend_event:%")
      .gte("updated_at", startOfUtcDay());
    if (dailyRowsError) throw dailyRowsError;

    const reservedOrSent = (dailyRows ?? []).reduce((total: number, row: any) => {
      const value = row?.setting_value ?? {};
      if (value.status === "sent") return total + Math.max(0, Number(value.sent) || 0);
      if (value.status === "reserved") return total + Math.max(0, Number(value.reserved) || 0);
      return total;
    }, 0);
    if (reservedOrSent > MAX_DIRECT_EMAILS_PER_UTC_DAY) {
      await db.from("integration_settings").update({
        setting_value: {
          status: "daily_safety_limit",
          sent: 0,
          reserved: 0,
          limit: MAX_DIRECT_EMAILS_PER_UTC_DAY,
          completedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq("setting_name", markerName);
      return { sent: 0, status: "daily_safety_limit" };
    }

    let sent = 0;
    for (let offset = 0; offset < recipients.length; offset += 100) {
      const batch = recipients.slice(offset, offset + 100).map((email) => ({
        from: String(config["fromEmail"]),
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
      if (!response.ok) {
        console.warn(`Resend email batch rejected (${response.status}):`, payload?.message || "Rate limit or quota reached");
        await db.from("integration_settings").update({
          setting_value: { status: "quota_exceeded", error: payload?.message || `HTTP ${response.status}`, attempted: recipients.length, reserved: 0 },
          updated_at: new Date().toISOString(),
        }).eq("setting_name", markerName);
        return { sent, status: "quota_exceeded" };
      }
      sent += batch.length;
    }

    await db.from("integration_settings").update({
      setting_value: { status: "sent", sent, reserved: 0, completedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq("setting_name", markerName);
    return { sent, status: "sent" };
  } catch (error) {
    await db.from("integration_settings").delete().eq("setting_name", markerName);
    throw error;
  }
}
