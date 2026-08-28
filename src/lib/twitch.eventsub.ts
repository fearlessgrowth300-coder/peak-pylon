import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { notifyRealMembersOfStreamerLive } from "./notifications";

const eventSubWebhookInput = z.object({
  subscription: z.object({
    id: z.string(),
    type: z.string(),
    condition: z.record(z.any()),
  }),
  event: z.record(z.any()).optional(),
  challenge: z.string().optional(),
});

/**
 * Twitch EventSub Webhook Handler for:
 * - stream.online: Streamer goes live -> updates status to 'live' and broadcasts alert
 * - stream.offline: Streamer ends live -> updates status to 'offline'
 * - channel.update: Streamer changes game category or stream title -> updates metadata
 */
export const handleTwitchEventSub = createServerFn({ method: "POST" })
  .validator(eventSubWebhookInput)
  .handler(async ({ data }) => {
    // 1. Handle Twitch Webhook Challenge Verification
    if (data.challenge) {
      return { challenge: data.challenge };
    }

    const { type } = data.subscription;
    const event = data.event ?? {};
    const broadcasterId = event.broadcaster_user_id || event.broadcaster_user_login;
    const broadcasterName = event.broadcaster_user_name || event.broadcaster_user_login;

    if (!broadcasterId) {
      return { success: false, reason: "No broadcaster specified" };
    }

    const db = supabase as any;

    // 2. Handle Stream Online
    if (type === "stream.online") {
      const streamTitle = event.title || "Live Stream";
      const streamCategory = event.category_name || "Just Chatting";

      // Find and update member in Supabase
      const { data: memberRows } = await db
        .from("community_listed_members")
        .select("id, data")
        .limit(100);

      const matched = (memberRows ?? []).find((row: any) => {
        const handle = (row.data?.handle || "").toLowerCase().replace(/^@/, "");
        const name = (row.data?.name || "").toLowerCase();
        const login = (event.broadcaster_user_login || "").toLowerCase();
        return handle === login || name === login || row.data?.link?.toLowerCase()?.includes(login);
      });

      if (matched) {
        const updatedData = {
          ...matched.data,
          status: "live",
          bio: `${streamCategory} · ${streamTitle}`,
        };
        await db
          .from("community_listed_members")
          .update({ data: updatedData })
          .eq("id", matched.id);

        // Broadcast email / realtime notification
        await notifyRealMembersOfStreamerLive({
          streamerName: matched.data.name || broadcasterName,
          streamerHandle: matched.data.handle || `@${event.broadcaster_user_login}`,
          category: streamCategory,
          streamTitle: streamTitle,
          streamUrl: matched.data.link || `https://twitch.tv/${event.broadcaster_user_login}`,
        });
      }

      return { success: true, event: "stream.online", broadcaster: broadcasterName };
    }

    // 3. Handle Stream Offline
    if (type === "stream.offline") {
      const { data: memberRows } = await db
        .from("community_listed_members")
        .select("id, data")
        .limit(100);

      const matched = (memberRows ?? []).find((row: any) => {
        const handle = (row.data?.handle || "").toLowerCase().replace(/^@/, "");
        const login = (event.broadcaster_user_login || "").toLowerCase();
        return handle === login || row.data?.link?.toLowerCase()?.includes(login);
      });

      if (matched) {
        const updatedData = {
          ...matched.data,
          status: "offline",
        };
        await db
          .from("community_listed_members")
          .update({ data: updatedData })
          .eq("id", matched.id);
      }

      return { success: true, event: "stream.offline", broadcaster: broadcasterName };
    }

    // 4. Handle Channel Category & Title Update
    if (type === "channel.update") {
      const newCategory = event.category_name || "Just Chatting";
      const newTitle = event.title || "";

      const { data: memberRows } = await db
        .from("community_listed_members")
        .select("id, data")
        .limit(100);

      const matched = (memberRows ?? []).find((row: any) => {
        const handle = (row.data?.handle || "").toLowerCase().replace(/^@/, "");
        const login = (event.broadcaster_user_login || "").toLowerCase();
        return handle === login || row.data?.link?.toLowerCase()?.includes(login);
      });

      if (matched) {
        const updatedData = {
          ...matched.data,
          bio: `${newCategory}${newTitle ? ` · ${newTitle}` : ""}`,
        };
        await db
          .from("community_listed_members")
          .update({ data: updatedData })
          .eq("id", matched.id);
      }

      return { success: true, event: "channel.update", category: newCategory, title: newTitle };
    }

    return { success: true, message: "Event received" };
  });
