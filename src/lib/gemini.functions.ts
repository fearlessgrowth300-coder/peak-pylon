import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const GEMINI_MODEL_OPTIONS = [
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash (Recommended)" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash (Fast & Reliable)" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (High Volume)" },
  { value: "gemini-3.7-flash", label: "Gemini 3.7 Flash (High Capacity)" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview (Deep Reasoning)" },
] as const;

export const AI_AUTOPILOT_INTERVAL_OPTIONS = [
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

const DEFAULT_MODEL: GeminiModel = "gemini-3.5-flash-lite";
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

async function callGemini(apiKeys: string[], model: GeminiModel, prompt: string, startIndex = 0, maxOutputTokens = 12) {
  if (!apiKeys.length) throw new Error("Add at least one Gemini API key first.");
  const errors: string[] = [];
  for (let offset = 0; offset < apiKeys.length; offset += 1) {
    const index = (startIndex + offset) % apiKeys.length;
    const apiKey = apiKeys[index]!;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens },
        }),
      },
    );
    if (response.ok) {
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
      return { index, text };
    }
    errors.push(`key ${index + 1}: HTTP ${response.status}`);
  }
  throw new Error(`Gemini rejected every saved key (${errors.join(", ")}).`);
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
  const creatorGame = chosen.data?.gameName || "Gaming";
  const creatorIsLive = chosen.data?.status === "live";

  const shouldReply = latestPost?.data?.text && Math.random() < 0.75;
  const replyTargetId = shouldReply ? latestPost.id : null;
  const latestAuthor = pool.find((m: any) => m.id === latestPost?.data?.authorId);
  const latestAuthorName = latestAuthor?.data?.name || "Streamer";

  const chatContext = cleanPosts
    .slice(0, 5)
    .reverse()
    .map((p: any) => `${p.data?.authorId || "User"}: "${p.data?.text || ""}"`)
    .join("\n");

  const prompt = `You are ${creatorName} (${creatorHandle}), an authentic gamer and streamer chatting in a Discord community.

YOUR PROFILE:
- Name: ${creatorName}
- Main Game: ${creatorGame}
- Status: ${creatorIsLive ? "Streaming live" : "Offline"}

RECENT CHAT HISTORY:
${chatContext || "Quiet chat."}

${shouldReply ? `TASK: ${latestAuthorName} just posted: "${latestPost.data.text}". Write a direct reply to ${latestAuthorName} (agree, banter, tease, or give your take).` : `TASK: Share a fresh, casual streamer thought or question (gaming grind, stream plans, energy drinks, setup, or clutch matches).`}

CRITICAL LANGUAGE & CONTENT RULES:
1. ALWAYS WRITE IN 100% NATURAL ENGLISH. NEVER USE NON-ENGLISH CHARACTERS UNDER ANY CIRCUMSTANCES.
2. NEVER use template phrases like "With all the action", "Moving over to", or "Shifting gears to".
3. NEVER say "StreamCore AI", "As an AI", or bot terms.
4. NEVER start with "Hey everyone!".
5. Keep it punchy (10 to 22 words max). Sound like a real streamer typing in Discord with natural gamer phrasing (fr, bro, gg, clutch, trolling, hop on, no way).`;

  const { text: rawText, index: usedKeyIndex } = await callGemini(
    keys,
    config.model,
    prompt,
    config.keyCursor ?? 0,
    80
  );

  let cleanText = rawText
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/\[?StreamCore AI[^\]]*\]?[:\s\-]*/gi, "")
    .replace(/As an AI[^:.]*[:.]\s*/gi, "")
    .replace(/^Hey everyone!?\s*/gi, "")
    .trim();

  // Strip any non-ASCII characters that might be foreign scripts
  if (/[\u4e00-\u9fa5]/.test(cleanText) || !cleanText) {
    cleanText = "Anyone grinding ranked games later today? Let me know who is down to queue.";
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
      lastStatus: data.active ? "Scheduled" : "Stopped",
      lastError: null,
    };
    await writeIntegrationSetting(db, AUTOPILOT_SETTING, next, user.id);

    try {
      await db.rpc("configure_streamcore_ai_autopilot_schedule", {
        interval_minutes: data.intervalMinutes,
        is_active: data.active,
      });
    } catch (scheduleError) {
      console.warn("pg_cron schedule configuration skipped or unsupported:", scheduleError);
    }

    return next;
  });

export const generateCommunityAiMessage = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db, user } = await requireAdmin(data.accessToken);

    // Try RPC first if permitted
    try {
      const { data: result, error } = await db.rpc("run_streamcore_ai_autopilot", { force_run: true });
      if (!error && result?.created) {
        return result as { created: true; status: string; postId: string; model: string };
      }
    } catch {
      // Fall through to direct generation
    }

    const config = await loadAutopilotConfig(db);
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
      const { data: result, error } = await db.rpc("run_streamcore_ai_autopilot", { force_run: false });
      if (!error && result?.created) return { ran: true, result };
    } catch {
      // Fall through
    }

    try {
      const directResult = await generateCommunityAiMessageDirectly(db, config);
      return { ran: true, result: directResult };
    } catch (err: any) {
      return { ran: false, error: err.message };
    }
  });

export const purgeSpamCommunityPosts = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);

    const { data: posts, error: fetchErr } = await db
      .from("community_posts")
      .select("id, data")
      .limit(300);

    if (fetchErr) throw new Error(fetchErr.message);

    const spamIds = (posts ?? [])
      .filter((p: any) => /[\u4e00-\u9fa5]/.test(p.data?.text || ""))
      .map((p: any) => p.id);

    if (spamIds.length > 0) {
      for (let i = 0; i < spamIds.length; i += 50) {
        const chunk = spamIds.slice(i, i + 50);
        await db.from("community_posts").delete().in("id", chunk);
      }
    }

    return { purgedCount: spamIds.length };
  });
