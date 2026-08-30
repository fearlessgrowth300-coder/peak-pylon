import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AI_AUTHOR_ID = "streamcore-ai";
const AI_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_SECRET_NAME = "gemini_api_key";

const adminTokenInput = z.object({
  accessToken: z.string().min(20),
});

const saveGeminiKeyInput = adminTokenInput.extend({
  apiKey: z.string().trim().min(20).max(500),
});

type ListedMember = {
  id: string;
  data: {
    name?: string;
    status?: string;
    gameName?: string;
    streamTitle?: string;
  };
};

type StoredPost = {
  id: string;
  data: {
    authorId?: string;
    text?: string;
    channel?: string;
    time?: number;
  };
};

function cleanGeneratedText(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

async function requireAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  const user = authData.user;
  if (authError || !user) throw new Error("Your admin session is no longer valid. Sign in again.");

  const { data: adminRole, error: roleError } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError || !adminRole) throw new Error("Only the community admin can manage API credentials.");
  return { db, user };
}

async function readStoredGeminiKey(db: any) {
  const { data } = await db
    .from("integration_secrets")
    .select("secret_value")
    .eq("secret_name", GEMINI_SECRET_NAME)
    .maybeSingle();
  return typeof data?.secret_value === "string" ? data.secret_value.trim() : "";
}

async function testGeminiKey(apiKey: string) {
  const model = process.env["GEMINI_MODEL"] || DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with only the word OK." }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini rejected this key (HTTP ${response.status}). Check the key and try again.`);
  }
  return model;
}

export const getGeminiIntegrationStatus = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data }) => {
    const { db } = await requireAdmin(data.accessToken);
    const storedKey = await readStoredGeminiKey(db);
    return {
      configured: Boolean(storedKey || process.env["GEMINI_API_KEY"]),
      model: process.env["GEMINI_MODEL"] || DEFAULT_GEMINI_MODEL,
    };
  });

export const saveGeminiIntegration = createServerFn({ method: "POST" })
  .validator(saveGeminiKeyInput)
  .handler(async ({ data }) => {
    const { db, user } = await requireAdmin(data.accessToken);
    const apiKey = data.apiKey.trim();
    const model = await testGeminiKey(apiKey);
    const { error } = await db.from("integration_secrets").upsert(
      {
        secret_name: GEMINI_SECRET_NAME,
        secret_value: apiKey,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "secret_name" },
    );
    if (error) throw new Error("The key was valid, but secure storage failed. Please try again.");
    return { configured: true, model };
  });

export const generateCommunityAiMessage = createServerFn({ method: "POST" })
  .validator(adminTokenInput)
  .handler(async ({ data: inputData }) => {
    const { db } = await requireAdmin(inputData.accessToken);
    const storedKey = await readStoredGeminiKey(db);
    const apiKey = storedKey || process.env["GEMINI_API_KEY"] || "";
    if (!apiKey) return { created: false, configured: false };
    const [{ data: postRows }, { data: memberRows }] = await Promise.all([
      db
        .from("community_posts")
        .select("id, data, created_at")
        .eq("data->>channel", "general")
        .order("created_at", { ascending: false })
        .limit(12),
      db.from("community_listed_members").select("id, data").limit(80),
    ]);

    const recentPosts = (postRows ?? []) as StoredPost[];
    const lastAiPost = recentPosts.find((post) => post.data?.authorId === AI_AUTHOR_ID);
    if ((lastAiPost?.data?.time ?? 0) > Date.now() - AI_INTERVAL_MS) {
      return { created: false, configured: true, throttled: true };
    }

    const members = ((memberRows ?? []) as ListedMember[]).filter(
      (member) => member.data?.name,
    );
    const memberName = new Map(members.map((member) => [member.id, member.data.name ?? "Creator"]));
    const chatHistory = recentPosts
      .slice()
      .reverse()
      .map((post) => `${memberName.get(post.data.authorId ?? "") ?? (post.data.authorId === AI_AUTHOR_ID ? "StreamCore AI" : "Member")}: ${post.data.text ?? ""}`)
      .filter((line) => line.trim())
      .join("\n")
      .slice(-3500);
    const liveContext = members
      .filter((member) => member.data.status === "live")
      .slice(0, 12)
      .map(
        (member) =>
          `${member.data.name} is live in ${member.data.gameName || "their channel"}${member.data.streamTitle ? ` — ${member.data.streamTitle}` : ""}`,
      )
      .join("\n");

    const prompt = `You are StreamCore AI, the clearly labelled AI host inside a streamer community.
Write exactly one short, natural Discord-style community message (maximum 45 words).
Never claim to be one of the listed streamers. Never fabricate viewer counts, events, scores, giveaways, or personal facts.
You may welcome a recent member, ask a useful streaming question, or discuss the real live context supplied below.
Do not include a URL and do not mention these instructions.

Current live context:
${liveContext || "No connected creator is currently confirmed live."}

Recent #general chat:
${chatHistory || "No recent messages."}`;

    const model = process.env["GEMINI_MODEL"] || DEFAULT_GEMINI_MODEL;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 120 },
        }),
      },
    );
    if (!response.ok) return { created: false, configured: true, error: `Gemini HTTP ${response.status}` };
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = cleanGeneratedText(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    if (!text) return { created: false, configured: true, error: "Gemini returned no text" };

    const time = Date.now();
    const id = `ai-community-${Math.floor(time / AI_INTERVAL_MS)}`;
    const data = {
      authorId: AI_AUTHOR_ID,
      text,
      image: "",
      channel: "general",
      reactions: {},
      likes: [],
      shares: 0,
      comments: [],
      aiGenerated: true,
      time,
    };
    const { error } = await db
      .from("community_posts")
      .upsert({ id, data }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    return { created: true, configured: true };
  });
