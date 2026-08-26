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
        const profile = await completeTwitchAuthorization({ data: { code: params.get("code")! } });
        const { error } = await supabase.from("profiles").update({ ...profile, twitch_verified: true }).eq("id", session.user.id);
        if (error) throw error;
        localStorage.removeItem("streamcore:twitch-oauth-state");
        setMessage("Twitch account verified. Returning to your profile…");
        setTimeout(() => void navigate({ to: "/" }), 800);
      } catch { setMessage("Twitch verification could not be completed. Please try again."); }
    };
    void run();
  }, [navigate]);
  return <main className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground"><p className="rounded-xl bg-popover px-5 py-4 text-sm">{message}</p></main>;
}
