export const GEMINI_STORAGE_KEY = "streamcore:gemini-api-key";
export const GEMINI_KEYS_STORAGE_KEY = "streamcore:gemini-api-keys";
export const GEMINI_MODEL_KEY = "streamcore:gemini-model";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const ACTIVE_CHAT_CONFIG_KEY = "streamcore:active-chat-config";

export const AVAILABLE_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Recommended, Fast & Stable)" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Next Gen)" },
  { id: "gemini-1.5-flash-latest", label: "Gemini 1.5 Flash Latest" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Deep Reasoning)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-pro", label: "Gemini Pro (Legacy)" },
];

export interface ActiveChatConfig {
  enabled: boolean;
  intervalSeconds: number;
  sendStickers: boolean;
  replyFrequency: number;
  includeLiveContext: boolean;
  channel: string;
}

export const DEFAULT_ACTIVE_CHAT_CONFIG: ActiveChatConfig = {
  enabled: true,
  intervalSeconds: 60,
  sendStickers: true,
  replyFrequency: 0.5,
  includeLiveContext: true,
  channel: "general",
};

export function getActiveChatConfig(): ActiveChatConfig {
  if (typeof window === "undefined") return DEFAULT_ACTIVE_CHAT_CONFIG;
  try {
    const raw = localStorage.getItem(ACTIVE_CHAT_CONFIG_KEY);
    if (!raw) return DEFAULT_ACTIVE_CHAT_CONFIG;
    return { ...DEFAULT_ACTIVE_CHAT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ACTIVE_CHAT_CONFIG;
  }
}

export function setActiveChatConfig(config: Partial<ActiveChatConfig>) {
  if (typeof window === "undefined") return;
  const current = getActiveChatConfig();
  const next = { ...current, ...config };
  localStorage.setItem(ACTIVE_CHAT_CONFIG_KEY, JSON.stringify(next));
}

export function getGeminiApiKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const multiRaw = localStorage.getItem(GEMINI_KEYS_STORAGE_KEY);
    if (multiRaw) {
      const parsed = JSON.parse(multiRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((k) => String(k).trim()).filter(Boolean);
      }
    }
  } catch {
    // fallback
  }

  const single = localStorage.getItem(GEMINI_STORAGE_KEY);
  if (single && single.trim()) {
    return [single.trim()];
  }
  return [];
}

export function setGeminiApiKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  const cleaned = keys.map((k) => k.trim()).filter(Boolean);
  localStorage.setItem(GEMINI_KEYS_STORAGE_KEY, JSON.stringify(cleaned));
  if (cleaned.length > 0) {
    localStorage.setItem(GEMINI_STORAGE_KEY, cleaned[0]);
  } else {
    localStorage.removeItem(GEMINI_STORAGE_KEY);
  }
}

export function getGeminiApiKey(): string {
  const keys = getGeminiApiKeys();
  return keys[0] || "";
}

export function setGeminiApiKey(key: string) {
  if (!key.trim()) return;
  const keys = getGeminiApiKeys();
  if (!keys.includes(key.trim())) {
    setGeminiApiKeys([key.trim(), ...keys]);
  } else {
    setGeminiApiKeys(keys);
  }
}

export function getGeminiModel(): string {
  if (typeof window === "undefined") return DEFAULT_GEMINI_MODEL;
  return localStorage.getItem(GEMINI_MODEL_KEY) || DEFAULT_GEMINI_MODEL;
}

export function setGeminiModel(model: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEMINI_MODEL_KEY, model.trim());
}

export async function fetchSupportedModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.models || !Array.isArray(data.models)) return [];
    return data.models
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => m.name.replace(/^models\//, ""));
  } catch {
    return [];
  }
}

export async function testGeminiConnection(apiKey?: string, model?: string): Promise<{ success: boolean; message: string; workingModel?: string }> {
  const keys = apiKey ? [apiKey] : getGeminiApiKeys();
  if (!keys.length) return { success: false, message: "Please provide at least one Gemini API key." };

  let selectedModel = model || getGeminiModel();
  const candidateModels = [
    selectedModel,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  const uniqueCandidates = Array.from(new Set(candidateModels.filter(Boolean)));
  let lastErrorMessage = "";

  for (const key of keys) {
    for (const candidate of uniqueCandidates) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Respond with the single word: Connected" }] }]
          })
        });

        const data = await res.json();
        if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          setGeminiModel(candidate);
          return {
            success: true,
            workingModel: candidate,
            message: `Gemini AI connected successfully (${candidate})! (Pool of ${keys.length} API key${keys.length > 1 ? "s" : ""})`,
          };
        } else if (data?.error) {
          const reason = data.error.details?.[0]?.reason || "";
          if (reason === "API_KEY_SERVICE_BLOCKED") {
            lastErrorMessage = "API Key Service Blocked: Generative Language API is not enabled for this Google Cloud project. Please click 'Create API key' -> 'Create in new project' in Google AI Studio.";
          } else {
            lastErrorMessage = data.error.message || lastErrorMessage;
          }
        }
      } catch (err: any) {
        lastErrorMessage = err?.message || lastErrorMessage;
      }
    }
  }

  return {
    success: false,
    message: lastErrorMessage
      ? `Google AI returned: "${lastErrorMessage}"`
      : "Could not connect to Gemini AI with the provided key(s). Please verify your key in Google AI Studio.",
  };
}

export interface MemberProfile {
  id: string;
  name: string;
  handle?: string;
  platform?: string;
  bio?: string;
  status?: string;
}

export interface GeneratedComment {
  authorId: string;
  text: string;
}

async function callGeminiGenerate(prompt: string, specificKey?: string, specificModel?: string): Promise<string | null> {
  const keys = specificKey ? [specificKey] : getGeminiApiKeys();
  if (!keys.length) return null;

  const selectedModel = specificModel || getGeminiModel();
  const candidateModels = [
    selectedModel,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  const uniqueCandidates = Array.from(new Set(candidateModels.filter(Boolean)));

  for (const key of keys) {
    for (const candidate of uniqueCandidates) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9 },
          }),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) return rawText;
      } catch {
        // try next candidate/key
      }
    }
  }

  return null;
}

export async function generateAiCommentsForPost({
  postText,
  members,
  apiKey,
  model,
}: {
  postText: string;
  members: MemberProfile[];
  apiKey?: string;
  model?: string;
}): Promise<GeneratedComment[]> {
  if (!members.length) return [];

  const prompt = `You are an AI community engine for a live-streaming platform called StreamCore.
A community post was published:
---
${postText}
---

Generate realistic, engaging, unique, authentic short comments (1 to 2 sentences, max 25 words each) from each of the following creators.
Each comment must:
1. Reference the topic/news mentioned in the post.
2. Match natural streamer energy (hype, congratulations, emojis).
3. Be completely unique for each creator.

List of creators:
${members.map((m, i) => `${i + 1}. ID: "${m.id}", Name: "${m.name}", Platform: "${m.platform || "Twitch"}"`).join("\n")}

Respond ONLY with a valid JSON array in this exact format with no additional text or Markdown wrapping:
[
  { "authorId": "id_here", "text": "comment text here" }
]`;

  try {
    const rawText = await callGeminiGenerate(prompt, apiKey, model);
    if (!rawText) return [];

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item.authorId && item.text);
    }
    return [];
  } catch (err) {
    console.error("Gemini AI comments generation failed:", err);
    return [];
  }
}

export async function generateAiClipComments({
  clipTitle,
  streamerName,
  members,
  apiKey,
  model,
}: {
  clipTitle: string;
  streamerName: string;
  members: MemberProfile[];
  apiKey?: string;
  model?: string;
}): Promise<GeneratedComment[]> {
  if (!members.length) return [];

  const prompt = `You are an AI streamer chat & community reaction generator for Twitch & Kick livestreams on StreamCore.
A new clip was generated from streamer "${streamerName}" titled: "${clipTitle}".

Generate authentic, hype Twitch/Kick stream chat reactions (1-15 words each, authentic Twitch chat style, capslock, slang, emojis, humor, W/L reactions) from each of the following community creators who were watching the clip:

Creators:
${members.map((m, i) => `${i + 1}. ID: "${m.id}", Name: "${m.name}"`).join("\n")}

Respond ONLY with a valid JSON array in this exact format:
[
  { "authorId": "id_here", "text": "chat reaction here" }
]`;

  try {
    const rawText = await callGeminiGenerate(prompt, apiKey, model);
    if (!rawText) return [];

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item.authorId && item.text);
    }
    return [];
  } catch {
    return [];
  }
}

export interface ActiveChatMessageResult {
  authorId: string;
  text?: string;
  sticker?: string;
  replyToId?: string;
  reactions?: { emoji: string; postId: string };
}

export async function generateActiveChatMessage({
  members,
  recentMessages,
  availableStickers,
  apiKey,
  model,
}: {
  members: MemberProfile[];
  recentMessages: { id: string; authorId: string; authorName: string; text?: string; sticker?: string }[];
  availableStickers?: { id: string; label: string; url: string }[];
  apiKey?: string;
  model?: string;
}): Promise<ActiveChatMessageResult | null> {
  if (!members || members.length < 2) return null;

  const stickersList = availableStickers?.slice(0, 15) || [];
  const recentHistory = recentMessages.slice(-6).map((msg) => {
    return `${msg.authorName} (${msg.id}): ${msg.text || `[sticker: ${msg.sticker}]`}`;
  }).join("\n");

  const prompt = `You are the 24/7 AI Community Chat Engine for StreamCore streamer community (#general chat).
Your job is to simulate authentic, vibrant streamer discussions between verified creators in the community.

Community Streamers available to chat:
${members.map((m) => `- ID: "${m.id}", Name: "${m.name}", Status: "${m.status || "online"}", Bio/Game: "${m.bio || "streaming and gaming"}"`).join("\n")}

Recent chat context in #general:
${recentHistory || "No previous messages yet. Kick off a lively discussion about gaming, streams, rank grinds, or tournament clips."}

Available sticker URLs:
${stickersList.map((s) => `- ${s.label}: "${s.url}"`).join("\n")}

Rules:
1. Pick ONE creator who would realistically talk next.
2. They can reply to a previous message (set replyToId) or start a new comment.
3. Use natural Twitch/Discord/streamer language (humor, game strategies, congratulating someone streaming live, GG, W, LMAO, etc.).
4. Sometimes send a sticker from the list.
5. Optionally react to a recent post ID with an emoji (🔥, 😂, 👑, ❤️, 🎮).

Respond ONLY with a valid JSON object:
{
  "authorId": "id_of_selected_creator",
  "text": "message text",
  "sticker": "optional_sticker_url",
  "replyToId": "optional_reply_to_post_id",
  "reactions": { "emoji": "🔥", "postId": "post_id_to_react_to" }
}`;

  try {
    const rawText = await callGeminiGenerate(prompt, apiKey, model);
    if (!rawText) return null;

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (parsed?.authorId && (parsed?.text || parsed?.sticker)) {
      return {
        authorId: parsed.authorId,
        text: parsed.text || undefined,
        sticker: parsed.sticker || undefined,
        replyToId: parsed.replyToId || undefined,
        reactions: parsed.reactions?.postId && parsed.reactions?.emoji ? parsed.reactions : undefined,
      };
    }
  } catch (err) {
    console.error("Active chat generation error:", err);
  }

  return null;
}
