import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completeTwitchAuthorization } from "@/lib/twitch.functions";

export const Route = createFileRoute("/twitch/callback")({ component: TwitchCallback });

function TwitchCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your Twitch account…");
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("code") || params.get("state") !== localStorage.getItem("streamcore:twitch-oauth-state")) { setMessage("The Twitch verification request could not be confirmed."); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMessage("Please sign in to Peak Pylon before connecting Twitch."); return; }
      try {
        const result = await completeTwitchAuthorization({ data: {
          code: params.get("code")!,
          accessToken: session.access_token,
          expectedLogin: localStorage.getItem("streamcore:twitch-expected-login") || undefined,
        } });
        localStorage.removeItem("streamcore:twitch-oauth-state");
        localStorage.removeItem("streamcore:twitch-expected-login");
        localStorage.setItem("streamcore:last-view", "general");
        setMessage(result.emailStatus === "error"
          ? "Twitch verified. Opening #general (the celebration email could not be delivered)."
          : "Twitch verified. Opening #general…");
        setTimeout(() => void navigate({ to: "/", search: { invite: undefined, code: undefined } }), 800);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Twitch verification could not be completed. Please try again.");
      }
    };
    void run();
  }, [navigate]);
  return <main className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground"><p className="rounded-xl bg-popover px-5 py-4 text-sm">{message}</p></main>;
}
