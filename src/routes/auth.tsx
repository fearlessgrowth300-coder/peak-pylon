import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { buttonClass, ghostButtonClass, inputClass, Field } from "@/components/community/Bits";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Join StreamCore — Creator Community Accounts" },
      {
        name: "description",
        content:
          "Create your StreamCore creator account or sign in to manage your profile, channel links and community activity.",
      },
      { property: "og:title", content: "Join StreamCore" },
      {
        property: "og:description",
        content: "Sign in or create your creator account in the StreamCore community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: displayName || email.split("@")[0],
            handle: handle.startsWith("@") ? handle : handle ? `@${handle}` : null,
          },
        },
      });
      setBusy(false);
      setMsg(error ? error.message : "Check your email to confirm your account.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    void navigate({ to: "/" });
  }

  async function google() {
    setMsg("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return setMsg("Google sign-in failed. Try again.");
    if (result.redirected) return;
    void navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-2xl bg-popover p-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">StreamCore</p>
        <h1 className="mt-1 text-2xl font-extrabold">
          {mode === "signup" ? "Create your creator account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real accounts join the community as streamers with their own profile and permissions.
        </p>

        <button onClick={google} className={`${ghostButtonClass} mt-5 w-full`}>
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <Field label="Display name">
                <input
                  className={inputClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="NovaRush"
                />
              </Field>
              <Field label="Handle">
                <input
                  className={inputClass}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@novarush"
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <input
              required
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              required
              type="password"
              minLength={6}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button disabled={busy} type="submit" className={`${buttonClass} w-full`}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}

        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        <Link to="/" className="mt-3 block text-center text-xs text-muted-foreground hover:underline">
          Back to community
        </Link>
      </div>
    </main>
  );
}
