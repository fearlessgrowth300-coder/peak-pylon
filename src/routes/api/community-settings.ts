import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const communitySchema = z.object({
  name: z.string().trim().min(1).max(200), tagline: z.string().max(2000),
  rules: z.string().max(100000), logo: z.string().max(5000000), banner: z.string().max(5000000),
});
export const Route = createFileRoute("/api/community-settings")({
  server: { handlers: {
    GET: async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { readIntegrationSetting } = await import("@/lib/integrations.server");
      try {
        const community = await readIntegrationSetting(supabaseAdmin, "community_identity", null);
        return Response.json({ community }, { headers: { "Cache-Control": "no-store" } });
      } catch { return Response.json({ error: "Saved community rules could not be loaded." }, { status: 503 }); }
    },
    POST: async ({ request }) => {
      // Bearer-authenticated writes only; cookies never authorize this route.
      const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
      if (!token) return Response.json({ error: "Sign in as admin to save community rules." }, { status: 401 });
      const { requireAdmin, writeIntegrationSetting } = await import("@/lib/integrations.server");
      let admin;
      try { admin = await requireAdmin(token); }
      catch { return Response.json({ error: "Your admin session is invalid. Sign in again." }, { status: 403 }); }
      const parsed = communitySchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return Response.json({ error: "Check the community fields and file sizes before saving." }, { status: 400 });
      try {
        await writeIntegrationSetting(admin.db, "community_identity", parsed.data, admin.user.id);
        return Response.json({ community: parsed.data }, { headers: { "Cache-Control": "no-store" } });
      } catch { return Response.json({ error: "The database could not save your rules. Your edits have been kept; please retry." }, { status: 503 }); }
    },
  } },
});
