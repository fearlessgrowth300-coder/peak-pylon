import { sendResendEmailServer } from "@/lib/resend.functions";

export interface ResendNotificationConfig {
  apiKey: string;
  fromEmail: string;
  notifyNewAnnouncement: boolean;
  notifyRepliesAndMentions: boolean;
  notifyNewClips: boolean;
  notifyStreamerLive: boolean;
}

const STORAGE_KEY = "streamcore:resend-notification-config";

export function getResendNotificationConfig(): ResendNotificationConfig {
  if (typeof window === "undefined") {
    return {
      apiKey: "",
      fromEmail: "StreamCore Alerts <noreply@authenticcommunity.fun>",
      notifyNewAnnouncement: true,
      notifyRepliesAndMentions: true,
      notifyNewClips: true,
      notifyStreamerLive: true,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiKey: parsed.apiKey || "",
        fromEmail: parsed.fromEmail || "StreamCore Alerts <noreply@authenticcommunity.fun>",
        notifyNewAnnouncement: parsed.notifyNewAnnouncement ?? true,
        notifyRepliesAndMentions: parsed.notifyRepliesAndMentions ?? true,
        notifyNewClips: parsed.notifyNewClips ?? true,
        notifyStreamerLive: parsed.notifyStreamerLive ?? true,
      };
    }
  } catch {
    // fallback
  }

  return {
    apiKey: "",
    fromEmail: "StreamCore Alerts <noreply@authenticcommunity.fun>",
    notifyNewAnnouncement: true,
    notifyRepliesAndMentions: true,
    notifyNewClips: true,
    notifyStreamerLive: true,
  };
}

export function saveResendNotificationConfig(config: ResendNotificationConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

export async function sendResendEmail({
  to,
  subject,
  html,
  text,
  apiKey,
  from,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  apiKey?: string;
  from?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const config = getResendNotificationConfig();
  const key = apiKey?.trim() || config.apiKey.trim();
  const sender = from?.trim() || config.fromEmail.trim() || "StreamCore Alerts <noreply@authenticcommunity.fun>";
  const recipients = Array.isArray(to) ? to : [to];
  const validRecipients = recipients.filter((e) => Boolean(e && e.includes("@")));

  if (!validRecipients.length) {
    return { success: false, error: "No valid recipient email address provided." };
  }

  try {
    const result = await sendResendEmailServer({
      data: {
        apiKey: key || undefined,
        from: sender,
        to: validRecipients,
        subject,
        html,
        text: text || subject,
      },
    });

    return result;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to execute server email function" };
  }
}

export async function notifyRealMemberOfReply({
  recipientEmail,
  parentAuthorName,
  replyAuthorName,
  replyText,
  communityName = "StreamCore",
}: {
  recipientEmail: string;
  parentAuthorName: string;
  replyAuthorName: string;
  replyText: string;
  communityName?: string;
}) {
  const config = getResendNotificationConfig();
  if (!config.notifyRepliesAndMentions || !recipientEmail) return;

  const subject = `💬 ${replyAuthorName} replied to your message on ${communityName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0e12; color: #f3f4f6; padding: 24px; border-radius: 12px; max-width: 540px; margin: 0 auto; border: 1px solid #27272a;">
      <div style="font-size: 11px; font-weight: 800; color: #8b5cf6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">${communityName} Community Notification</div>
      <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 800; color: #ffffff;">New reply from ${replyAuthorName}</h2>
      <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 16px 0;">Hey ${parentAuthorName}, you have a new reply in #general:</p>
      <div style="background-color: #18191e; border-left: 4px solid #8b5cf6; padding: 14px 18px; border-radius: 8px; font-size: 15px; line-height: 1.5; color: #f4f4f5; margin-bottom: 20px;">
        <strong>${replyAuthorName}:</strong> ${replyText}
      </div>
      <a href="https://peak-pylon.vercel.app" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px 20px; border-radius: 8px;">Jump to Conversation →</a>
    </div>
  `;

  await sendResendEmail({ to: recipientEmail, subject, html });
}

export async function notifyRealMembersOfAnnouncement({
  recipientEmails,
  title,
  content,
  communityName = "StreamCore",
}: {
  recipientEmails: string[];
  title: string;
  content: string;
  communityName?: string;
}) {
  const config = getResendNotificationConfig();
  if (!config.notifyNewAnnouncement || !recipientEmails.length) return;

  const subject = `📢 Announcement: ${title} (${communityName})`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0e12; color: #f3f4f6; padding: 24px; border-radius: 12px; max-width: 540px; margin: 0 auto; border: 1px solid #27272a;">
      <div style="font-size: 11px; font-weight: 800; color: #eab308; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">👑 Official Community Announcement</div>
      <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 800; color: #ffffff;">${title}</h2>
      <div style="background-color: #18191e; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #e4e4e7; margin-bottom: 20px; white-space: pre-wrap;">
        ${content}
      </div>
      <a href="https://peak-pylon.vercel.app" style="display: inline-block; background-color: #eab308; color: #000000; text-decoration: none; font-weight: 800; font-size: 14px; padding: 10px 20px; border-radius: 8px;">View Announcement on StreamCore →</a>
    </div>
  `;

  await sendResendEmail({ to: recipientEmails, subject, html });
}

export async function notifyRealMembersOfStreamerLive({
  recipientEmails,
  streamerName,
  game,
  channelUrl,
  communityName = "StreamCore",
}: {
  recipientEmails: string[];
  streamerName: string;
  game?: string;
  channelUrl: string;
  communityName?: string;
}) {
  const config = getResendNotificationConfig();
  if (!config.notifyStreamerLive || !recipientEmails.length) return;

  const subject = `🔴 ${streamerName} is LIVE now${game ? ` playing ${game}` : ""}!`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0e12; color: #f3f4f6; padding: 24px; border-radius: 12px; max-width: 540px; margin: 0 auto; border: 1px solid #27272a;">
      <div style="font-size: 11px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">● Streamer Live Alert</div>
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #ffffff;">${streamerName} just went live!</h2>
      <p style="font-size: 14px; color: #a1a1aa; margin: 0 0 16px 0;">Catch the stream live with fellow ${communityName} members.</p>
      ${game ? `<div style="margin-bottom: 18px; font-size: 14px; color: #f43f5e; font-weight: 700;">🎮 Category: ${game}</div>` : ""}
      <a href="${channelUrl || "https://peak-pylon.vercel.app"}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 10px 20px; border-radius: 8px;">Watch Stream Live →</a>
    </div>
  `;

  await sendResendEmail({ to: recipientEmails, subject, html });
}
