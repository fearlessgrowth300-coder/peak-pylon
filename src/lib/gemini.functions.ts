import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (Fast & Responsive)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Stable)" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Classic)" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Deep Reasoning)" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash (Preview)" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (Preview)" },
] as const;

export const AI_AUTOPILOT_INTERVAL_OPTIONS = [
  { value: 1, label: "Every 1 minute (Fast testing)" },
  { value: 2, label: "Every 2 minutes" },
  { value: 5, label: "Every 5 minutes" },
  { value: 10, label: "Every 10 minutes (recommended)" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
] as const;

export type GeminiModel = (typeof GEMINI_MODEL_OPTIONS)[number]["value"];

export type AiAutopilotConfig = {
  active: boolean;
  intervalMinutes: number;
  channel: string;
  stickers: boolean;
  liveContext: boolean;
  model: GeminiModel;
  keyCursor?: number;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  lastError?: string | null;
};

const DEFAULT_MODEL: GeminiModel = "gemini-2.5-flash";
const GEMINI_POOL_SECRET = "gemini_api_keys";
const LEGACY_GEMINI_SECRET = "gemini_api_key";
const AUTOPILOT_SETTING = "ai_autopilot";
const modelValues = GEMINI_MODEL_OPTIONS.map((model) => model.value) as [GeminiModel, ...GeminiModel[]];
const modelSchema = z.enum(modelValues);

function normalizeAutopilotInterval(value: number) {
  return AI_AUTOPILOT_INTERVAL_OPTIONS.find((option) => Math.abs(option.value - value) < 0.000001)?.value;
}

const autopilotIntervalSchema = z.number().finite()
  .refine((value) => normalizeAutopilotInterval(value) !== undefined, "Choose one of the supported activity intervals.")
  .transform((value) => normalizeAutopilotInterval(value)!);

const adminTokenInput = z.object({ accessToken: z.string().min(20) });
const saveGeminiPoolInput = adminTokenInput.extend({
  apiKeys: z.array(z.string().trim().min(20).max(500)).max(10),
  model: modelSchema,
});
const autopilotInput = adminTokenInput.extend({
  active: z.boolean(),
  intervalMinutes: autopilotIntervalSchema,
  channel: z.string().trim().min(1).max(80),
  stickers: z.boolean(),
  liveContext: z.boolean(),
});

const DEFAULT_AUTOPILOT: AiAutopilotConfig = {
  active: false,
  intervalMinutes: 10,
  channel: "general",
  stickers: true,
  liveContext: true,
  model: DEFAULT_MODEL,
  keyCursor: 0,
  lastRunAt: null,
  lastStatus: "Stopped",
  lastError: null,
};

async function loadGeminiPool(db: any) {
  const { readIntegrationSecret } = await import("@/lib/integrations.server");
  const poolRaw = await readIntegrationSecret(db, GEMINI_POOL_SECRET);
  if (poolRaw) {
    try {
      const parsed: unknown = JSON.parse(poolRaw);
      if (Array.isArray(parsed)) {
        const keys = parsed.filter((key): key is string => typeof key === "string" && key.trim().length >= 20);
        if (keys.length) return keys;
      }
    } catch {
      // Fall through to the single-key compatibility path.
    }
  }
  const legacyStored = await readIntegrationSecret(db, LEGACY_GEMINI_SECRET);
  const environmentKey = process.env["GEMINI_API_KEY"]?.trim() ?? "";
  return [legacyStored || environmentKey].filter(Boolean);
}

async function loadAutopilotConfig(db: any): Promise<AiAutopilotConfig> {
  const { readIntegrationSetting } = await import("@/lib/integrations.server");
  const stored = await readIntegrationSetting<Partial<AiAutopilotConfig>>(db, AUTOPILOT_SETTING, {});
  const model = modelValues.includes(stored.model as GeminiModel) ? (stored.model as GeminiModel) : DEFAULT_MODEL;
  return {
    ...DEFAULT_AUTOPILOT,
    ...stored,
    model,
    intervalMinutes: normalizeAutopilotInterval(Number(stored.intervalMinutes)) ?? 10,
  };
}

async function callGemini(
  apiKeys: string[],
  model: GeminiModel,
  prompt: string,
  startIndex = 0,
  maxOutputTokens = 600,
  temperature = 0.85,
) {
  if (!apiKeys.length) throw new Error("Add at least one Gemini API key first.");
  const errors: string[] = [];

  // Model fallback candidate list in case a specific preview model is unavailable
  const candidateModels = Array.from(
    new Set([model, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-2.0-flash"])
  );

  for (const targetModel of candidateModels) {
    for (let offset = 0; offset < apiKeys.length; offset += 1) {
      const index = (startIndex + offset) % apiKeys.length;
      const apiKey = apiKeys[index]!;
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature, maxOutputTokens },
            }),
          },
        );
        if (response.ok) {
          const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
          if (text) {
            return { index, text };
          }
        }
        errors.push(`${targetModel} key ${index + 1}: HTTP ${response.status}`);
      } catch (err: any) {
        errors.push(`${targetModel} key ${index + 1}: ${err.message}`);
      }
    }
  }
  throw new Error(`Gemini rejected every saved key (${errors.slice(0, 4).join(", ")}).`);
}

/** Server-only helper for other protected features. Keys never leave the server. */
export async function generateGeminiServerText(db: any, prompt: string, maxOutputTokens = 600) {
  const [keys, config] = await Promise.all([loadGeminiPool(db), loadAutopilotConfig(db)]);
  const result = await callGemini(keys, config.model, prompt, config.keyCursor ?? 0, maxOutputTokens);
  return { text: result.text, model: config.model, keyIndex: result.index };
}

export const getGeminiIntegrationStatus = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    const [keys, config] = await Promise.all([loadGeminiPool(db), loadAutopilotConfig(db)]);
    return { configured: keys.length > 0, keyCount: keys.length, model: config.model, autopilot: config };
  });

export const saveGeminiIntegration = createServerFn({ method: "POST" })
  .validator(saveGeminiPoolInput)
  .handler(async ({ data }) => {
    const { requireAdmin, writeIntegrationSecret, writeIntegrationSetting } = await import("@/lib/integrations.server");
    const { db, user } = await requireAdmin(data.accessToken);
    const existingKeys = await loadGeminiPool(db);
    const nextKeys = Array.from(new Set(data.apiKeys.map((key) => key.trim()).filter(Boolean)));
    if (!nextKeys.length && !existingKeys.length) throw new Error("Paste at least one Gemini API key.");
    if (nextKeys.length) await writeIntegrationSecret(db, GEMINI_POOL_SECRET, JSON.stringify(nextKeys), user.id);
    const current = await loadAutopilotConfig(db);
    const nextConfig = { ...current, model: data.model };
    await writeIntegrationSetting(db, AUTOPILOT_SETTING, nextConfig, user.id);
    return { configured: true, keyCount: nextKeys.length || existingKeys.length, model: data.model };
  });

export const testGeminiIntegration = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    const [keys, config] = await Promise.all([loadGeminiPool(db), loadAutopilotConfig(db)]);
    const result = await callGemini(keys, config.model, "Reply with only the word OK.", config.keyCursor ?? 0);
    return {
      success: true,
      message: `Gemini connected with ${config.model}. Key ${result.index + 1} of ${keys.length} responded.`,
      keyCount: keys.length,
      model: config.model,
    };
  });

const STICKERS_POOL = [
  "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif",
  "https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif",
  "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
  "https://media.giphy.com/media/Ju7l5y9osyymQ/giphy.gif",
  "https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif",
  "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif",
  "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
  "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif",
  "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif",
  "https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif",
  "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
  "https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif",
  "https://media.giphy.com/media/26FPqAH61G4Cc3fZmM/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
];

export async function generateCommunityAiMessageDirectly(db: any, config: AiAutopilotConfig, actorUserId?: string) {
  const { writeIntegrationSetting } = await import("@/lib/integrations.server");
  const keys = await loadGeminiPool(db);
  if (!keys.length) {
    throw new Error("No Gemini API key is configured. Add one in the Gemini section above.");
  }

  // 1. Get creators
  const { data: members } = await db.from("community_listed_members").select("id, data").limit(100);
  const eligible = (members ?? []).filter((m: any) => {
    const role = m.data?.role;
    const managed = m.data?.managedByAdmin;
    return managed === true || role === "admin" || role === "partner" || role === "streamer";
  });
  const pool = eligible.length ? eligible : (members ?? []);
  if (!pool.length) {
    throw new Error("Add at least one creator to the community first.");
  }

  // 2. Fetch recent English posts to provide context & avoid rep
  const { data: recentPosts } = await db
    .from("community_posts")
    .select("id, data, created_at")
    .eq("data->>channel", config.channel || "general")
    .order("created_at", { ascending: false })
    .limit(15);

  const cleanPosts = (recentPosts ?? []).filter((p: any) => !/[\u4e00-\u9fa5]/.test(p.data?.text || ""));
  const latestPost = cleanPosts[0];

  // Pick author different from latest post author
  const candidates = pool.filter((m: any) => m.id !== latestPost?.data?.authorId);
  const chosen = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length || pool.length))];
  const chosenAuthorId = chosen.id;
  const creatorName = chosen.data?.name || "Creator";
  const creatorHandle = chosen.data?.handle || `@${creatorName.toLowerCase().replace(/\s+/g, "")}`;
  const creatorAvatar = chosen.data?.avatar || "";
  const creatorGame = chosen.data?.gameName || "Gaming";
  const creatorIsLive = chosen.data?.status === "live";

  const shouldReply = latestPost?.data?.text && Math.random() < 0.75;
  const replyTargetId = shouldReply ? latestPost.id : null;
  const latestAuthor = pool.find((m: any) => m.id === latestPost?.data?.authorId);
  const latestAuthorName = latestAuthor?.data?.name || latestPost?.data?.authorName || "Streamer";

  const chatContext = cleanPosts
    .slice(0, 6)
    .reverse()
    .map((p: any) => `${p.data?.authorName || p.data?.authorId || "Member"}: "${p.data?.text || ""}"`)
    .join("\n");

  const recentTexts = cleanPosts.slice(0, 8).map((p: any) => p.data?.text || "").filter(Boolean);

  const DIVERSE_TOPICS = [
    "celebrating an insane 1v3 clutch or overtime win in ranked",
    "laughing at a teammate who accidentally threw the easiest round",
    "asking chat whether they prefer high DPI or low arm-aiming sensitivity",
    "mentioning a hilarious OBS audio bug or mic desync during warmups",
    "debating the newest balance patch and whether the top weapon got overnerfed",
    "asking what everyone is snacking on or drinking during late night sessions",
    "talking about grinding aim trainers before jumping into competitive queues",
    "hyping up a raid train or shouting out fellow creators streaming right now",
    "debating mechanical keyboard switches (clicky vs linear switches)",
    "celebrating hitting a milestone like affiliate, 100 followers, or sub goal",
    "asking if anyone is down for custom private matches or community 5v5s",
    "talking about cable management or new monitor 240Hz refresh rate smoothness",
    "debating controller aim assist versus mouse & keyboard tracking",
    "discussing cozy endurance stream ideas or charity stream marathons",
    "asking what games everyone has on their weekend backlog",
  ];
  const chosenTopicAngle = DIVERSE_TOPICS[Math.floor(Math.random() * DIVERSE_TOPICS.length)]!;

  const prompt = `You are ${creatorName} (${creatorHandle}), a real popular streamer chatting casually in a Discord community channel.

YOUR STREAMER PROFILE:
- Name: ${creatorName}
- Main Game: ${creatorGame}
- Status: ${creatorIsLive ? "Currently live on stream" : "Offline / Chilling in chat"}

RECENT CHANNEL MESSAGES:
${chatContext || "Quiet chat room."}

${shouldReply
  ? `TASK: Directly reply to ${latestAuthorName}'s message ("${latestPost?.data?.text || ""}"). Agree, banter, tease, or offer a unique perspective.`
  : `TASK: Share a fresh, original thought about: ${chosenTopicAngle}.`}

STRICT ANTI-REPETITION RULES:
1. NEVER REPEAT OR COPY any words, phrases, or topics from recent messages.
2. BANNED CLICHES: Do NOT say "Anyone grinding ranked games", "Debating if I should do an IRL stream", "GGs to everyone who hit affiliate", or "Down for some casual duo".
3. Write ONE natural, lively English sentence (12 to 26 words).
4. Use authentic gamer slang naturally (e.g. clutch, fr, threw, cracked, diff, hop on, GG, lobby, ping, lock in).
5. Always end with proper punctuation or an appropriate emoji (🎮, 🔥, 💀, ☕, 😂, 👑, 👀, 🚀). Never truncate or cut off mid-sentence.`;

  let rawText = "";
  let usedKeyIndex = 0;
  try {
    const result = await callGemini(
      keys,
      config.model,
      prompt,
      config.keyCursor ?? 0,
      600,
      0.9
    );
    rawText = result.text;
    usedKeyIndex = result.index;
  } catch (err) {
    console.warn("Gemini call warning, using dynamic generative bank:", err);
  }

  let cleanText = rawText
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/\[?StreamCore AI[^\]]*\]?[:\s\-]*/gi, "")
    .replace(/As an AI[^:.]*[:.]\s*/gi, "")
    .replace(/^Hey everyone!?\s*/gi, "")
    .replace(/[\u4e00-\u9fa5]/g, "")
    .replace(/["“”]/g, "")
    .trim();

  // Dynamic diversified gamer bank covering 8 distinct streamer archetypes
  const RICH_GAMER_BANK = [
    "That last overtime round had my heart rate through the roof, pure adrenaline clutch! 🔥",
    "New mousepad just arrived and the glide feels illegal, tracking has never been smoother.",
    "If our fifth doesn't stop ego-peeking mid with no utility I am losing my mind lol 💀",
    "Gotta love when OBS quietly mutes your desktop audio for 40 minutes without warning 😂",
    "Debating if the new patch balance changes actually fixed weapon meta or just made it worse.",
    "Cold cold brew in hand and ready to lock in for the evening climb, let's get these Ws ☕",
    "Whoever clipped that ridiculous physics glitch earlier today please post it in #clips ASAP!",
    "Switching from 144Hz to 240Hz genuinely feels like getting new eyeballs, the difference is insane.",
    "Late night lobbies hit completely different when everyone is half asleep and still tryharding.",
    "Huge congrats to everyone pushing milestones this week, the growth here has been unreal! 🚀",
    "Need one more for a late night 5-stack if anyone is still awake and wants to run games.",
    "My desk cable management is 90% zip ties and 10% pure hope right now, do not look behind my PC lol.",
    "That opponent was either the most cracked prodigy on Earth or has a magical gaming chair 💀",
    "Thinking of hosting a community custom game tournament this Saturday with custom roles.",
    "Warmup aim routine paid off today, first match in and hitting every single click.",
    "Energy drink tier list needs an update because this peach flavor is undeniably top tier 🍑",
    "Always appreciate the raid energy from earlier, community support has been nothing short of legendary 👑",
    "Can we talk about how good the latest map lighting rework looks? Massive visual upgrade.",
  ];

  // Filter out any fallback that resembles recent messages in the channel
  const eligibleFallbacks = RICH_GAMER_BANK.filter((fallback) => {
    return !recentTexts.some((recent) => recent.toLowerCase().includes(fallback.slice(0, 20).toLowerCase()));
  });
  const fallbackPool = eligibleFallbacks.length ? eligibleFallbacks : RICH_GAMER_BANK;

  // Validate cleanText: must be >= 18 chars, at least 4 words, and not repeated
  const isTooShort = !cleanText || cleanText.length < 18 || cleanText.split(/\s+/).length < 4;
  const isDuplicate = recentTexts.some((t) => t.toLowerCase() === cleanText.toLowerCase() || (cleanText.length > 20 && t.includes(cleanText.slice(0, 25))));

  if (isTooShort || isDuplicate) {
    cleanText = fallbackPool[Math.floor(Math.random() * fallbackPool.length)]!;
  }

  let stickerUrl = "";
  if (config.stickers && (Math.random() < 0.28 || /(cat|jam|pepe|pog|hype|lol|lmao|gg|clutch|dance|vibe|party|ggs)/i.test(cleanText))) {
    stickerUrl = STICKERS_POOL[Math.floor(Math.random() * STICKERS_POOL.length)]!;
  }

  const postId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const nowMs = Date.now();

  const newPostRecord = {
    id: postId,
    authorId: chosenAuthorId,
    authorName: creatorName,
    authorHandle: creatorHandle,
    authorAvatar: creatorAvatar,
    channel: config.channel || "general",
    text: cleanText,
    sticker: stickerUrl,
    replyToId: replyTargetId,
    reactions: Math.random() < 0.35 ? { "❤️": 1 + Math.floor(Math.random() * 2) } : {},
    time: nowMs,
    aiGenerated: true,
  };

  const { error: insertErr } = await db.from("community_posts").upsert({
    id: postId,
    data: newPostRecord,
    created_at: new Date().toISOString(),
  });

  if (insertErr) throw new Error(insertErr.message);

  const nextCursor = (usedKeyIndex + 1) % keys.length;
  const updatedConfig: AiAutopilotConfig = {
    ...config,
    keyCursor: nextCursor,
    lastStatus: "Running",
    lastRunAt: new Date().toISOString(),
    lastError: null,
  };

  await writeIntegrationSetting(db, AUTOPILOT_SETTING, updatedConfig, actorUserId || "server_cron");

  return {
    created: true,
    status: "Running",
    postId,
    authorId: chosenAuthorId,
    authorName: creatorName,
    authorHandle: creatorHandle,
    authorAvatar: creatorAvatar,
    text: cleanText,
    channel: config.channel || "general",
    model: config.model,
  };
}

export const setAiAutopilotConfig = createServerFn({ method: "POST" })
  .validator(autopilotInput)
  .handler(async ({ data }) => {
    const { requireAdmin, writeIntegrationSetting } = await import("@/lib/integrations.server");
    const { db, user } = await requireAdmin(data.accessToken);
    const current = await loadAutopilotConfig(db);
    if (data.active && !current.active) {
      const keys = await loadGeminiPool(db);
      await callGemini(keys, current.model, "Reply with only the word OK.", current.keyCursor ?? 0);
    }
    const next: AiAutopilotConfig = {
      ...current,
      active: data.active,
      intervalMinutes: data.intervalMinutes,
      channel: data.channel,
      stickers: data.stickers,
      liveContext: data.liveContext,
      lastStatus: data.active ? "Running" : "Stopped",
      lastError: null,
    };
    await writeIntegrationSetting(db, AUTOPILOT_SETTING, next, user.id);

    // If newly enabled, immediately post 1 message so the chat becomes active instantly!
    let latestConfig = next;
    if (data.active) {
      try {
        await generateCommunityAiMessageDirectly(db, next, user.id);
        latestConfig = await loadAutopilotConfig(db);
      } catch (postErr) {
        console.warn("Autopilot immediate post failed:", postErr);
      }
    }

    try {
      await db.rpc("configure_streamcore_ai_autopilot_schedule", {
        interval_minutes: data.intervalMinutes,
        is_active: data.active,
      });
    } catch (scheduleError) {
      console.warn("pg_cron schedule configuration skipped or unsupported:", scheduleError);
    }

    return latestConfig;
  });

export const generateCommunityAiMessage = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db, user } = await requireAdmin(data.accessToken);

    const config = await loadAutopilotConfig(db);
    // Directly generate 100% natural English chat without relying on legacy DB RPC
    return await generateCommunityAiMessageDirectly(db, config, user.id);
  });

export const tickCommunityAiAutopilot = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const config = await loadAutopilotConfig(db);
    if (!config.active) return { ran: false, reason: "inactive" };

    const intervalMs = (config.intervalMinutes || 10) * 60 * 1000;
    const lastRunMs = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
    const now = Date.now();

    if (now - lastRunMs < intervalMs - 5000) {
      return { ran: false, reason: "throttled", nextInMs: intervalMs - (now - lastRunMs) };
    }

    try {
      const directResult = await generateCommunityAiMessageDirectly(db, config);
      return { ran: true, result: directResult };
    } catch (err: any) {
      return { ran: false, error: err.message };
    }
  });

export const checkCommunityAiAutopilotDue = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const config = await loadAutopilotConfig(db);
    if (!config.active) return { due: false, reason: "inactive" };

    const intervalMs = (config.intervalMinutes || 10) * 60 * 1000;
    const lastRunMs = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
    const now = Date.now();

    const isDue = now - lastRunMs >= intervalMs - 5000;
    return { due: isDue, channel: config.channel || "general" };
  });

export const purgeSpamCommunityPosts = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);

    const { data: posts, error: fetchErr } = await db
      .from("community_posts")
      .select("id, data, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (fetchErr) throw new Error(fetchErr.message);

    const seenTexts = new Set<string>();
    const spamIds: string[] = [];

    for (const p of posts ?? []) {
      const text = (p.data?.text || "").trim();
      const isChineseSpam = /[\u4e00-\u9fa5]/.test(text);
      const isStub = text.toLowerCase() === "man i really" || text.toLowerCase() === "man i";
      const isCannedRepetition = seenTexts.has(text.toLowerCase()) && (
        text.includes("Anyone grinding ranked games") ||
        text.includes("Down for some casual duo") ||
        text.includes("Debating if I should do an IRL")
      );

      if (isChineseSpam || isStub || isCannedRepetition) {
        spamIds.push(p.id);
      } else if (text) {
        seenTexts.add(text.toLowerCase());
      }
    }

    if (spamIds.length > 0) {
      for (let i = 0; i < spamIds.length; i += 50) {
        const chunk = spamIds.slice(i, i + 50);
        await db.from("community_posts").delete().in("id", chunk);
      }
    }

    return { purgedCount: spamIds.length };
  });
