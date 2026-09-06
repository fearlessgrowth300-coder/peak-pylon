import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buttonClass, ghostButtonClass, inputClass, Field } from "@/components/community/Bits";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    reset: search.reset === true || search.reset === "true",
  }),
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
  const { reset: isPasswordRecovery } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isPasswordRecovery) void navigate({ to: "/" });
    });
  }, [isPasswordRecovery, navigate]);

  async function updatePassword(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (newPassword.length < 8) {
      setMsg("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg("The passwords do not match.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) {
      setMsg(error.message.includes("session")
        ? "This password-reset link has expired. Request a new link from My Profile."
        : error.message);
      return;
    }

    localStorage.setItem("streamcore:last-view", "me");
    setMsg("Password updated successfully. Opening your profile…");
    window.setTimeout(() => window.location.assign("/"), 900);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split("@")[0],
            handle: handle.startsWith("@") ? handle : handle ? `@${handle}` : null,
          },
        },
      });
      setBusy(false);
      if (error) return setMsg(error.message);
      setAwaitingVerification(true);
      setMsg("We sent an 8-digit verification code to your email.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    localStorage.setItem("streamcore:open-rules", "1");
    window.location.assign("/");
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: verificationCode.replace(/\s/g, ""),
      type: "signup",
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    window.location.assign("/");
  }

  async function google() {
    setMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Google did not return an authorization URL.");
      window.location.assign(data.url);
    } catch (error) {
      setMsg(error instanceof Error ? `Google sign-in failed: ${error.message}` : "Google sign-in failed. Try again.");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-2xl bg-popover p-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">StreamCore</p>
        <h1 className="mt-1 text-2xl font-extrabold">
          {isPasswordRecovery ? "Choose a new password" : mode === "signup" ? "Create your creator account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPasswordRecovery
            ? "Enter a secure new password for your StreamCore account."
            : "Real accounts join the community as streamers with their own profile and permissions."}
        </p>

        {isPasswordRecovery ? (
          <form onSubmit={updatePassword} className="mt-5 space-y-3">
            <Field label="New password">
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            <button disabled={busy} type="submit" className={`${buttonClass} w-full`}>
              {busy ? "Updating password…" : "Update password"}
            </button>
          </form>
        ) : <>
          <button onClick={google} className={`${ghostButtonClass} mt-5 w-full`}>
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          {awaitingVerification ? (
          <form onSubmit={verifyCode} className="mt-5 space-y-3">
            <Field label="Email verification code">
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                className={`${inputClass} text-center text-xl font-bold tracking-[0.35em]`}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                placeholder="12345678"
              />
            </Field>
            <p className="text-xs text-muted-foreground">Enter the code from the email we sent to {email}.</p>
            <button disabled={busy} type="submit" className={`${buttonClass} w-full`}>
              {busy ? "Verifying…" : "Verify account"}
            </button>
            <button type="button" onClick={() => setAwaitingVerification(false)} className="w-full text-xs text-muted-foreground hover:underline">Use a different email</button>
          </form>
          ) : <form onSubmit={submit} className="space-y-3">
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
          </form>}
        </>}

        {msg && <p className="mt-3 text-sm text-primary">{msg}</p>}

        {!isPasswordRecovery && (
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        )}
        <Link to="/" className="mt-3 block text-center text-xs text-muted-foreground hover:underline">
          Back to community
        </Link>
      </div>
    </main>
  );
}
