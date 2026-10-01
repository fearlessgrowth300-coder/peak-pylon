import { createFileRoute } from "@tanstack/react-router";

// A document redirect does not pass through the browser's session RPC middleware.
// No private data is read here. Ownership and OAuth state are checked on callback.
export const Route = createFileRoute("/twitch/authorize")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const state = new URL(request.url).searchParams.get("state") ?? "";
        if (!/^[a-f0-9-]{36}$/i.test(state)) return new Response("Invalid Twitch connection request. Return to My Profile and try again.", { status: 400 });
        const clientId = process.env["TWITCH_CLIENT_ID"];
        if (!clientId) return new Response("Twitch connection is not configured. Please contact the community administrator.", { status: 503 });
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: process.env["TWITCH_REDIRECT_URI"] || "https://peak-pylon.vercel.app/twitch/callback",
          response_type: "code",
          scope: "user:read:email moderator:read:chatters moderator:read:followers",
          force_verify: "true",
          state,
        });
        return new Response(null, { status: 302, headers: {
          Location: `https://id.twitch.tv/oauth2/authorize?${params}`,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        } });
      },
    },
  },
});
