import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { type CommunityInvite, claimInviteOnSignup } from "@/lib/invites";
import { inputClass, buttonClass, ghostButtonClass } from "@/components/community/Bits";

export function InviteLandingModal({
  invite,
  onClose,
  onSuccess,
}: {
  invite: CommunityInvite | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    if (mode === "signup") {
      const formattedHandle = handle.startsWith("@") ? handle : handle ? `@${handle}` : `@${email.split("@")[0]}`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split("@")[0],
            handle: formattedHandle,
            invite_code_used: invite?.code ?? null,
            inviter_id: invite?.inviter_id ?? null,
          },
        },
      });

      setBusy(false);
      if (error) return setMsg(error.message);

      if (invite && data.user) {
        await claimInviteOnSignup(invite.code, data.user.id, displayName || email.split("@")[0], formattedHandle);
      }

      setAwaitingVerification(true);
      setMsg("We sent a verification code to your email. Enter it below:");
      return;
    }

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);

    if (invite && signInData.user) {
      await claimInviteOnSignup(invite.code, signInData.user.id, signInData.user.user_metadata?.display_name || email.split("@")[0], signInData.user.user_metadata?.handle || `@${email.split("@")[0]}`);
    }

    onSuccess();
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: verificationCode.replace(/\s/g, ""),
      type: "signup",
    });
    setBusy(false);
    if (error) return setMsg(error.message);

    if (invite && data.user) {
      await claimInviteOnSignup(invite.code, data.user.id, displayName || email.split("@")[0], handle || `@${email.split("@")[0]}`);
    }

    onSuccess();
  }

  async function googleSignIn() {
    setMsg("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return setMsg("Google sign-in failed. Please try email.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/40 bg-popover p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Invite Badge */}
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-1 text-xs font-black text-primary">
            <span>🔗</span>
            <span>INVITATION CODE: {invite?.code || "EXCLUSIVE CREATOR INVITE"}</span>
          </div>

          <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
            {invite?.inviter_name ? `Join ${invite.inviter_name} on StreamCore` : "Join StreamCore Creator Network"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {invite?.inviter_name
              ? `You were personally invited by ${invite.inviter_name} (${invite.inviter_handle}) to join our verified streamer community.`
              : "Connect your channel, participate in raids, and grow alongside verified streamers."}
          </p>
        </div>

        {msg && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-medium text-foreground">
            {msg}
          </div>
        )}

        {awaitingVerification ? (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Enter Verification Code</label>
              <input
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456"
                className={inputClass}
                autoFocus
              />
            </div>
            <button type="submit" disabled={busy} className={`${buttonClass} w-full py-3 text-sm font-bold`}>
              {busy ? "Verifying..." : "Verify & Complete Signup →"}
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-3.5">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Streamer Name</label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. KaiCenat"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Handle</label>
                    <input
                      type="text"
                      required
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@kaicenat"
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@streamer.com"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>

            <button type="submit" disabled={busy} className={`${buttonClass} w-full py-3 text-sm font-black shadow-lg shadow-primary/20`}>
              {busy ? "Processing..." : mode === "signup" ? "Accept Invitation & Join Free →" : "Sign In & Join Community"}
            </button>

            <button
              type="button"
              onClick={googleSignIn}
              className={`${ghostButtonClass} w-full border border-border py-2.5 text-xs font-bold hover:bg-accent flex items-center justify-center gap-2`}
            >
              <span>🌐</span> Continue with Google
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setMsg("");
                }}
                className="font-bold text-primary hover:underline"
              >
                {mode === "signup" ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                Browse as Guest
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
