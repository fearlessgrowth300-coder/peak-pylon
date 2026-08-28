export const GEMINI_STORAGE_KEY = "streamcore:gemini-api-key";
export const GEMINI_MODEL_KEY = "streamcore:gemini-model";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export const AVAILABLE_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Recommended, Fast & Stable)" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Next Gen)" },
  { id: "gemini-1.5-flash-latest", label: "Gemini 1.5 Flash Latest" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Deep Reasoning)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-pro", label: "Gemini Pro (Legacy)" },
];

export function getGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GEMINI_STORAGE_KEY) || "";
}

export function setGeminiApiKey(key: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
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
  const key = apiKey || getGeminiApiKey();
  let selectedModel = model || getGeminiModel();
  if (!key) return { success: false, message: "Please provide a Gemini API key." };

  const candidateModels = [
    selectedModel,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.5-pro",
    "gemini-pro",
  ];
  const uniqueCandidates = Array.from(new Set(candidateModels.filter(Boolean)));

  for (const candidate of uniqueCandidates) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          message: candidate === selectedModel
            ? `Gemini AI connected successfully (${candidate})!`
            : `Connected! Auto-switched to active model: ${candidate}`,
        };
      }
    } catch {
      // try next candidate
    }
  }

  // If candidate loop failed, try querying model list
  try {
    const list = await fetchSupportedModels(key);
    if (list.length > 0) {
      const firstModel = list[0];
      setGeminiModel(firstModel);
      return {
        success: true,
        workingModel: firstModel,
        message: `Connected! Using available model: ${firstModel}`,
      };
    }
  } catch {
    // ignore
  }

  return {
    success: false,
    message: "Invalid API key or no supported Gemini models found for this key.",
  };
}

export interface MemberProfile {
  id: string;
  name: string;
  handle?: string;
  platform?: string;
}

export interface GeneratedComment {
  authorId: string;
  text: string;
}

async function callGeminiGenerate(prompt: string, apiKey?: string, model?: string): Promise<string | null> {
  const key = apiKey || getGeminiApiKey();
  const selectedModel = model || getGeminiModel();
  if (!key) return null;

  const candidateModels = [
    selectedModel,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  const uniqueCandidates = Array.from(new Set(candidateModels.filter(Boolean)));

  for (const candidate of uniqueCandidates) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85 },
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) return rawText;
    } catch {
      // try next model
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
