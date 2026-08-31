import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { type CommunityInvite, claimInviteOnSignup } from "@/lib/invites";
import { type Member } from "@/lib/community";
import { inputClass, buttonClass, ghostButtonClass, Avatar } from "@/components/community/Bits";

export function InviteLandingModal({
  invite,
  allMembers,
  onClose,
  onSuccess,
  onNavigateView,
  isAuthenticated = false,
}: {
  invite: CommunityInvite | null;
  allMembers?: Member[];
  onClose: () => void;
  onSuccess: () => void;
  onNavigateView?: (view: string) => void;
  isAuthenticated?: boolean;
}) {
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // 5-second countdown to automatically open signup prompt if user hasn't clicked yet
  useEffect(() => {
    if (showSignupForm || isAuthenticated) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowSignupForm(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAuthenticated, showSignupForm]);

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
    if (invite?.code) {
      localStorage.setItem("streamcore:pending-invite-code", invite.code);
    }
    const inviteSearch = invite?.code
      ? `/?invite=${encodeURIComponent(invite.code)}`
      : "/";
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${inviteSearch}`,
    });
    if (result.error) {
      localStorage.removeItem("streamcore:pending-invite-code");
      return setMsg("Google sign-in failed. Please try email.");
    }
  }

  // Only confirmed current Twitch live states belong in the live roster.
  const members = allMembers ?? [];
  const previewCreators = members.filter((member) => member.status === "live").slice(0, 6);
  const memberCount = members.length;
  const onlineCount = members.filter((member) => member.status !== "offline").length;
  const liveCount = members.filter((member) => member.status === "live").length;

  const returnToPreview = () => {
    setSecondsRemaining(5);
    setShowSignupForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      {!showSignupForm ? (
        /* ========================================================================= */
        /* PHASE 1: BEAUTIFUL COMMUNITY PREVIEW SCREEN                               */
        /* ========================================================================= */
        <div
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-primary/50 bg-gradient-to-b from-popover via-background to-popover p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Inviter top tag */}
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-1 text-xs font-black text-primary">
              <span>✨</span>
              <span>INVITATION: {invite?.code || "EXCLUSIVE CREATOR PASS"}</span>
            </div>
            {invite?.inviter_name && (
              <span className="text-xs font-bold text-muted-foreground">
                Invited by <strong className="text-foreground">{invite.inviter_name}</strong> ({invite.inviter_handle})
              </span>
            )}
          </div>

          {/* Hero Branding */}
          <div className="mt-6 text-center space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
              STREAMCORE
            </h1>
            <p className="text-sm font-bold uppercase tracking-widest text-primary">
              The creator network.
            </p>
          </div>

          {/* Core Network Metrics */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-border/70 bg-popover/80 p-3.5 shadow-sm">
              <p className="text-xl sm:text-2xl font-black text-foreground">{memberCount.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                Community members
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-popover/80 p-3.5 shadow-sm">
              <p className="text-xl sm:text-2xl font-black text-online">{onlineCount.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                Creators online
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-popover/80 p-3.5 shadow-sm">
              <p className="text-xl sm:text-2xl font-black text-destructive flex items-center justify-center gap-1">
                <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
                {liveCount.toLocaleString()}
              </p>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                Creators live
              </p>
            </div>
          </div>

          {/* Community Navigation Pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateView?.("trending")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-accent/40 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent hover:border-primary/40 transition"
            >
              <span>🔥</span> Trending
            </button>
            <button
              type="button"
              onClick={() => onNavigateView?.("live-now")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-accent/40 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent hover:border-primary/40 transition"
            >
              <span className="text-destructive font-black">●</span> Live Now
            </button>
            <button
              type="button"
              onClick={() => onNavigateView?.("general")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-accent/40 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent hover:border-primary/40 transition"
            >
              <span>💬</span> General Chat
            </button>
            <button
              type="button"
              onClick={() => onNavigateView?.("rankings")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-accent/40 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent hover:border-primary/40 transition"
            >
              <span>🏆</span> Creator Rankings
            </button>
          </div>

          {/* Live Creators Strip */}
          {previewCreators.length > 0 && (
            <div className="mt-5 rounded-2xl border border-border/60 bg-background/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 text-center">
                🔴 Active Verified Streamers in Community:
              </p>
              <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-1">
                {previewCreators.map((creator) => (
                  <div
                    key={creator.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-popover px-2.5 py-1"
                  >
                    <span className="relative rounded-full ring-2 ring-destructive ring-offset-1 ring-offset-popover">
                      <Avatar member={creator} size={22} showStatus={false} />
                      <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-destructive" />
                      <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 animate-ping rounded-full bg-destructive" />
                    </span>
                    <span className="text-xs font-bold text-foreground">{creator.name}</span>
                    <span className="text-[10px] text-online font-bold">✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Button & Auto-Join Countdown */}
          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={() => isAuthenticated ? onClose() : setShowSignupForm(true)}
              className={`${buttonClass} w-full py-4 text-base font-black tracking-wide shadow-xl shadow-primary/30 hover:scale-[1.02] transition-transform`}
            >
              {isAuthenticated ? "[ Enter StreamCore → ]" : "[ Join StreamCore Free → ]"}
            </button>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{isAuthenticated ? "You are already signed in." : <>Opening signup in <strong>{secondsRemaining}s</strong>...</>}</span>
              <button
                type="button"
                onClick={onClose}
                className="hover:text-foreground font-semibold"
              >
                Explore preview mode
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* PHASE 2: SIGNUP / SIGNIN FORM (OPENS INSTANTLY OR AFTER 5 SECONDS)        */
        /* ========================================================================= */
        <div
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/50 bg-popover p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Invite Badge */}
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-1 text-xs font-black text-primary">
              <span>🔗</span>
              <span>INVITATION CODE: {invite?.code || "EXCLUSIVE PASS"}</span>
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
              {invite?.inviter_name ? `Join ${invite.inviter_name} on StreamCore` : "Create Your Creator Account"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect your Twitch channel, participate in raids, and grow alongside verified streamers.
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
                <label className="text-xs font-bold text-muted-foreground">Enter 6-digit Verification Code</label>
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
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Streamer Name</label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. NovaStreams"
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
                      placeholder="@novastreams"
                      className={inputClass}
                    />
                  </div>
                </div>
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

              <button type="submit" disabled={busy} className={`${buttonClass} w-full py-3.5 text-sm font-black shadow-lg shadow-primary/20`}>
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
                  onClick={returnToPreview}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ← Back to Preview
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
