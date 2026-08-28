export const GEMINI_STORAGE_KEY = "streamcore:gemini-api-key";
export const GEMINI_MODEL_KEY = "streamcore:gemini-model";
export const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

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

export async function testGeminiConnection(apiKey?: string, model?: string): Promise<{ success: boolean; message: string }> {
  const key = apiKey || getGeminiApiKey();
  const selectedModel = model || getGeminiModel();
  if (!key) return { success: false, message: "Please provide a Gemini API key." };

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Respond with the single word: Connected" }
            ]
          }
        ]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.error?.message || "Failed to connect to Gemini API." };
    }

    return { success: true, message: "Gemini AI connection successful! Ready for AI features." };
  } catch (err: any) {
    return { success: false, message: err.message || "Network error reaching Gemini API." };
  }
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
  const key = apiKey || getGeminiApiKey();
  const selectedModel = model || getGeminiModel();

  if (!key || !members.length) return [];

  const prompt = `You are an AI community engine for a modern gaming and live-streaming community platform called StreamCore.
The admin has published a new trending post or announcement:
---
${postText}
---

Generate realistic, engaging, unique, authentic short comments (1 to 2 sentences, maximum 25 words each) from each of the following creators.
Each comment must:
1. Deeply understand and directly reference the specific topic, announcement, achievements, games, or news mentioned in the post.
2. Match natural streamer/creator energy (hype, congratulations, excitement, thoughtful perspective, or gaming banter) and include appropriate emojis.
3. Be completely unique for each creator.

List of creators:
${members.map((m, i) => `${i + 1}. ID: "${m.id}", Name: "${m.name}", Platform: "${m.platform || "Twitch"}"`).join("\n")}

Respond ONLY with a valid JSON array in this exact format with no additional text or Markdown wrapping:
[
  { "authorId": "id_here", "text": "comment text here" }
]`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
        }
      })
    });

    if (!res.ok) {
      console.warn("Gemini API error status:", res.status);
      return [];
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
