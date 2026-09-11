import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completeKickAuthorization } from "@/lib/kick.functions";

export const Route = createFileRoute("/kick/callback")({ component: KickCallback });

function KickCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your Kick account");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const expectedState = localStorage.getItem("streamcore:kick-oauth-state");
      const verifier = localStorage.getItem("streamcore:kick-code-verifier");
      if (!params.get("code") || !verifier || params.get("state") !== expectedState) {
        setMessage("The Kick verification request could not be confirmed.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage("Please sign in to StreamCore before connecting Kick.");
        return;
      }
      try {
        await completeKickAuthorization({ data: {
          code: params.get("code")!,
          codeVerifier: verifier,
          accessToken: session.access_token,
          expectedSlug: localStorage.getItem("streamcore:kick-expected-slug") || undefined,
        } });
        localStorage.removeItem("streamcore:kick-oauth-state");
        localStorage.removeItem("streamcore:kick-code-verifier");
        localStorage.removeItem("streamcore:kick-expected-slug");
        localStorage.setItem("streamcore:last-view", "me");
        setMessage("Kick verified. Opening your profile.");
        setTimeout(() => void navigate({ to: "/", search: { invite: undefined, code: undefined } }), 800);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Kick verification could not be completed. Please try again.");
      }
    };
    void run();
  }, [navigate]);

  return <main className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground"><p className="rounded-md border border-border bg-popover px-5 py-4 text-sm">{message}</p></main>;
}
