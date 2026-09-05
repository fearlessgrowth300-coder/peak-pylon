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
    const { error: scheduleError } = await db.rpc("configure_streamcore_ai_autopilot_schedule", {
      interval_minutes: data.intervalMinutes,
      is_active: data.active,
    });
    if (scheduleError) {
      await writeIntegrationSetting(db, AUTOPILOT_SETTING, current, user.id);
      await db.rpc("configure_streamcore_ai_autopilot_schedule", {
        interval_minutes: current.intervalMinutes,
        is_active: current.active,
      });
      throw new Error(`The activity schedule could not be updated: ${scheduleError.message}`);
    }
    return next;
  });

export const generateCommunityAiMessage = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/integrations.server");
    const { db } = await requireAdmin(data.accessToken);
    const { data: result, error } = await db.rpc("run_streamcore_ai_autopilot", { force_run: true });
    if (error) throw new Error(error.message || "The AI worker could not run.");
    if (!result?.created) throw new Error(result?.error || `AI message was not posted (${result?.status || "unknown error"}).`);
    return result as { created: true; status: string; postId: string; model: string };
  });
