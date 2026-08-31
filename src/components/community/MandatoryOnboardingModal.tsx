import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Member } from "@/lib/community";
import { triggerCreatorWelcomeBurst, fetchPartnerShowcaseStreamers } from "@/lib/invites";
import { inputClass, buttonClass, Avatar } from "@/components/community/Bits";

export function MandatoryOnboardingModal({
  userId,
  initialName,
  initialHandle,
  communityRules,
  allMembers,
  onCompleted,
}: {
  userId: string;
  initialName: string;
  initialHandle: string;
  communityRules: string;
  allMembers: Member[];
  onCompleted: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [agreedRules, setAgreedRules] = useState(false);
  const [displayName, setDisplayName] = useState(initialName || "");
  const [handle, setHandle] = useState(initialHandle || "");
  const [twitchChannel, setTwitchChannel] = useState("");
  const [bio, setBio] = useState("Live streamer & content creator. Excited to be part of StreamCore!");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchPartnerShowcaseStreamers().then((ids) => {
      if (ids.length > 0) {
        setPartnerIds(ids);
      } else {
        // Default top 4 partner streamers
        setPartnerIds(allMembers.slice(0, 5).map((m) => m.id));
      }
    });
  }, [allMembers]);

  const partnerStreamers = allMembers.filter((m) => partnerIds.includes(m.id));

  async function handleCompleteSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!twitchChannel.trim()) {
      setErrorMsg("Please provide your Twitch channel username or link to authorize your channel.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const cleanTwitch = twitchChannel.trim().replace(/^https?:\/\/(?:www\.)?twitch\.tv\//i, "").replace(/^@/, "");
      const fullChannelUrl = `https://www.twitch.tv/${cleanTwitch}`;
      const cleanHandle = handle.startsWith("@") ? handle : handle ? `@${handle}` : `@${cleanTwitch}`;
      const finalAvatar = avatarUrl.trim() || `https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&q=80`;

      // 1. Update Profile in Supabase
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || cleanTwitch,
          handle: cleanHandle,
          bio: bio.trim(),
          avatar_url: finalAvatar,
          platform: "Twitch",
          channel_url: fullChannelUrl,
          channel_authorized: true,
          rules_acknowledged: true,
          notifications_enabled: notificationsEnabled,
          approval_status: "pending",
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // 2. Trigger Instant Welcome Announcement in #general + AI Streamer Replies
      await triggerCreatorWelcomeBurst(
        userId,
        displayName.trim() || cleanTwitch,
        cleanHandle,
        fullChannelUrl
      );

      // 3. Complete onboarding
      onCompleted();
    } catch (err: any) {
      console.error("Onboarding completion error:", err);
      setErrorMsg(err?.message || "Could not complete authorization. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/40 bg-popover p-6 shadow-2xl">
        {/* Progress header */}
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground">
              {step}
            </span>
            <h2 className="text-base font-black text-foreground">
              {step === 1 ? "Step 1 of 2: Community Rules & Code of Conduct" : "Step 2 of 2: Authorize Streamer Profile"}
            </h2>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {step === 1 ? "50% Completed" : "Almost Done"}
          </span>
        </div>

        {step === 1 ? (
          /* STEP 1: Community Rules */
          <div className="space-y-4">
            <div className="rounded-xl border border-border/80 bg-background/60 p-4 text-xs leading-relaxed max-h-64 overflow-y-auto space-y-2.5 text-muted-foreground">
              <p className="font-bold text-foreground">Welcome to StreamCore! Before connecting your channel, please read our rules:</p>
              <div className="whitespace-pre-line">
                {communityRules || "1. Respect all streamers, creators, and community members.\n2. No toxicity, harassment, or hate speech.\n3. Keep posts and live notifications relevant.\n4. Participate in community raids and support fellow streamers."}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-border p-3 bg-accent/30 hover:bg-accent cursor-pointer transition">
              <input
                type="checkbox"
                checked={agreedRules}
                onChange={(e) => setAgreedRules(e.target.checked)}
                className="h-4 w-4 rounded text-primary focus:ring-primary"
              />
              <span className="text-xs font-bold text-foreground">
                I have read, understood, and agree to the StreamCore rules
              </span>
            </label>

            <button
              type="button"
              disabled={!agreedRules}
              onClick={() => setStep(2)}
              className={`${buttonClass} w-full py-3 text-sm font-black disabled:opacity-40`}
            >
              Continue to Channel Authorization →
            </button>
          </div>
        ) : (
          /* STEP 2: Profile & Channel Authorization */
          <form onSubmit={handleCompleteSetup} className="space-y-4">
            {errorMsg && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/15 p-2.5 text-xs text-destructive font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Verified Partner Showcase Showcase */}
            {partnerStreamers.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">
                  ⭐ Verified Partners in our Network:
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {partnerStreamers.map((partner) => (
                    <div
                      key={partner.id}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1"
                      title={`${partner.name} (${partner.handle})`}
                    >
                      <Avatar member={partner} size={20} showStatus={false} />
                      <span className="text-[11px] font-bold text-foreground">{partner.name}</span>
                      <span className="text-[9px] text-online">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Streamer Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your stream name"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Twitch Username / Link *</label>
                <input
                  type="text"
                  required
                  value={twitchChannel}
                  onChange={(e) => setTwitchChannel(e.target.value)}
                  placeholder="e.g. your_twitch_name"
                  className={`${inputClass} border-primary/50 focus:border-primary`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Short Creator Bio</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What games do you stream?"
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Avatar / Profile Picture URL (Optional)</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 bg-accent/20 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded text-primary"
              />
              <span className="text-xs font-bold text-foreground">
                🔔 Enable live community raid alerts and approval notifications
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className={`${buttonClass} w-full py-3.5 text-sm font-black shadow-lg shadow-primary/25`}
            >
              {submitting ? "Authorizing Channel..." : "Authorize Channel & Enter Community →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
