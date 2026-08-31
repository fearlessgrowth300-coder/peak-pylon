import { supabase } from "@/integrations/supabase/client";
import { type Post, type Member } from "@/lib/community";

/**
 * Intelligent contextual emoji reaction engine.
 * Analyzes streamer message sentiment, gaming keywords, and banter to pick
 * the most natural and respectful reactions from fellow community creators.
 */
export function analyzeContextualReactions(text: string): { primaryEmoji: string; secondaryEmoji?: string } {
  const lower = (text || "").toLowerCase();

  // 1. Banter, funny moments, self-deprecating jokes, humor
  if (
    lower.includes("😂") ||
    lower.includes("💀") ||
    lower.includes("cans") ||
    lower.includes("caffeine") ||
    lower.includes("desk") ||
    lower.includes("paperweight") ||
    lower.includes("gacha") ||
    lower.includes("bro") ||
    lower.includes("bruh") ||
    lower.includes("lol") ||
    lower.includes("lmao") ||
    lower.includes("dying") ||
    lower.includes("funny") ||
    lower.includes("joke")
  ) {
    return { primaryEmoji: "😂", secondaryEmoji: "💀" };
  }

  // 2. Hype, clutch plays, victories, tournaments, big announcements
  if (
    lower.includes("🔥") ||
    lower.includes("clutch") ||
    lower.includes("ace") ||
    lower.includes("win") ||
    lower.includes("victory") ||
    lower.includes("tournament") ||
    lower.includes("goat") ||
    lower.includes("insane") ||
    lower.includes("lets go") ||
    lower.includes("let's go") ||
    lower.includes("w ") ||
    lower.includes("huge")
  ) {
    return { primaryEmoji: "🔥", secondaryEmoji: "👑" };
  }

  // 3. Wholesome, welcoming new creators, thank you, support, raid love
  if (
    lower.includes("welcome") ||
    lower.includes("joined") ||
    lower.includes("love") ||
    lower.includes("appreciate") ||
    lower.includes("wholesome") ||
    lower.includes("support") ||
    lower.includes("thank") ||
    lower.includes("excited") ||
    lower.includes("glad") ||
    lower.includes("congrats") ||
    lower.includes("greetings")
  ) {
    return { primaryEmoji: "❤️", secondaryEmoji: "💖" };
  }

  // 4. Gaming, competitive setups, Twitch stream talk
  if (
    lower.includes("game") ||
    lower.includes("stream") ||
    lower.includes("twitch") ||
    lower.includes("valorant") ||
    lower.includes("league") ||
    lower.includes("apex") ||
    lower.includes("cs2") ||
    lower.includes("fortnite") ||
    lower.includes("fps") ||
    lower.includes("ranked") ||
    lower.includes("grind")
  ) {
    return { primaryEmoji: "🎮", secondaryEmoji: "🔥" };
  }

  // Default natural streamer reaction
  return { primaryEmoji: "❤️", secondaryEmoji: "🔥" };
}

/**
 * Automatically triggers fellow verified streamers to react to a newly posted message.
 */
export async function triggerStreamerReactionsToPost(
  postId: string,
  postText: string,
  authorId: string,
  allMembers: Member[],
  currentReactions: Record<string, number> = {},
  currentLikes: string[] = []
): Promise<{ reactions: Record<string, number>; likes: string[] }> {
  const { primaryEmoji, secondaryEmoji } = analyzeContextualReactions(postText);
  
  // Pick 1 to 3 distinct verified streamers who are NOT the author
  const fellowStreamers = allMembers.filter((m) => m.id !== authorId && m.id !== "community");
  if (!fellowStreamers.length) {
    return { reactions: currentReactions, likes: currentLikes };
  }

  const updatedReactions = { ...currentReactions };
  const updatedLikes = [...currentLikes];

  // Increment primary contextual emoji
  updatedReactions[primaryEmoji] = (updatedReactions[primaryEmoji] || 0) + (1 + Math.floor(Math.random() * 2));

  // If primary is heart, add a like
  if (primaryEmoji === "❤️" || primaryEmoji === "💖") {
    const liker = fellowStreamers[0];
    if (liker && !updatedLikes.includes(liker.id)) {
      updatedLikes.push(liker.id);
    }
  }

  // 50% chance to add secondary contextual emoji (e.g. 💀 or 👑)
  if (secondaryEmoji && Math.random() > 0.4) {
    updatedReactions[secondaryEmoji] = (updatedReactions[secondaryEmoji] || 0) + 1;
  }

  // Persist reactions to database
  try {
    const { data: current } = await (supabase as any)
      .from("community_posts")
      .select("data")
      .eq("id", postId)
      .maybeSingle();

    if (current?.data) {
      await (supabase as any)
        .from("community_posts")
        .update({
          data: {
            ...current.data,
            reactions: updatedReactions,
            likes: updatedLikes,
          },
        })
        .eq("id", postId);
    }
  } catch (err) {
    console.error("Could not persist streamer reactions:", err);
  }

  return { reactions: updatedReactions, likes: updatedLikes };
}
