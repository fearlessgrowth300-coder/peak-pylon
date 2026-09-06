import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_META, isRestricted, topRole, type Account, type SocialLink } from "@/lib/account";
import { formatDate } from "@/lib/community";
import { Field, buttonClass, ghostButtonClass, inputClass } from "./Bits";
import { beginTwitchAuthorization } from "@/lib/twitch.functions";
import { getCreatorMilestoneStatus, saveCreatorProfile, type CreatorMilestoneStatus } from "@/lib/onboarding.functions";

const LOCKED_MILESTONES = [
  { key: "youtube", platform: "YouTube", milestone: "Unlocks at 50 Community Chat Messages", icon: "▶" },
  { key: "discord", platform: "Discord", milestone: "Unlocks at Level 2 Streamer Milestone", icon: "💬" },
  { key: "twitter", platform: "X (Twitter)", milestone: "Unlocks at 100 Post Reactions", icon: "✖" },
  { key: "kick", platform: "Kick", milestone: "Unlocks at 5 Hosted Stream Raids", icon: "🟢" },
  { key: "tiktok", platform: "TikTok", milestone: "Unlocks at Top 50 Creator Rankings", icon: "🎵" },
  { key: "instagram", platform: "Instagram", milestone: "Unlocks at Verified Partner Milestone", icon: "📸" },
] as const;

function twitchLoginFromInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutUrl = trimmed.replace(/^https?:\/\/(?:www\.)?twitch\.tv\//i, "").replace(/^@/, "");
  const login = withoutUrl.split(/[/?#]/)[0]?.toLowerCase() ?? "";
  return /^[a-z0-9_]{3,25}$/.test(login) ? login : "";
}

function milestoneProgress(key: (typeof LOCKED_MILESTONES)[number]["key"], status: CreatorMilestoneStatus | null) {
  if (!status) return "Calculating from community data…";
  const metrics = status.metrics;
  switch (key) {
    case "youtube": return `${Math.min(metrics.generalMessages, 50)} / 50 general messages`;
    case "discord": return `Level ${metrics.streamerLevel} · ${metrics.activityPoints} activity points`;
    case "twitter": return `${Math.min(metrics.receivedReactions, 100)} / 100 received reactions`;
    case "kick": return `${Math.min(metrics.hostedRaids, 5)} / 5 confirmed Twitch raids`;
    case "tiktok": return metrics.rankingPosition ? `Current creator rank: #${metrics.rankingPosition}` : "No ranking snapshot yet";
    case "instagram": return metrics.verifiedPartner ? "Verified Partner role confirmed" : "Verified Partner role required";
  }
}

export function ProfileEditor({
  account,
  refresh,
  notify,
  onSignOut,
  accessToken,
}: {
  account: Account;
  refresh: () => Promise<void>;
  notify: (m: string) => void;
  onSignOut: () => void;
  accessToken?: string | undefined;
}) {
  const [form, setForm] = useState({
    display_name: account.display_name,
    handle: account.handle ?? "",
    bio: account.bio,
    platform: account.platform || "Twitch",
    channel_url: account.channel_url || "",
    status: account.status || "online",
    avatar_url: account.avatar_url,
    banner_url: account.banner_url,
    created_at: account.created_at,
    social_links: account.social_links ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [authorizingTwitch, setAuthorizingTwitch] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [milestones, setMilestones] = useState<CreatorMilestoneStatus | null>(null);
  const [milestonesLoading, setMilestonesLoading] = useState(false);

  useEffect(() => {
    setForm({
      display_name: account.display_name,
      handle: account.handle ?? "",
      bio: account.bio,
      platform: account.platform || "Twitch",
      channel_url: account.channel_url || "",
      status: account.status || "online",
      avatar_url: account.avatar_url,
      banner_url: account.banner_url,
      created_at: account.created_at,
      social_links: account.social_links ?? [],
    });
  }, [account.id]);

  const role = topRole(account.roles);
  const isAdmin = role === "admin";
  const isAuthorized = Boolean(account.channel_authorized || account.twitch_verified);

  useEffect(() => {
    if (isAdmin || !accessToken) return;
    let active = true;
    setMilestonesLoading(true);
    getCreatorMilestoneStatus({ data: { accessToken } })
      .then((result) => { if (active) setMilestones(result); })
      .catch((error) => { if (active) notify(error instanceof Error ? error.message : "Could not calculate milestones"); })
      .finally(() => { if (active) setMilestonesLoading(false); });
    return () => { active = false; };
  }, [accessToken, account.id, isAdmin, notify]);

  async function handleAuthorizeTwitch() {
    await connectTwitchOAuth(true);
  }

  async function connectTwitchOAuth(requireMatchingLogin = false) {
    const expectedLogin = twitchLoginFromInput(form.channel_url);
    if (requireMatchingLogin && !expectedLogin) {
      notify("Enter a valid Twitch username or twitch.tv channel URL first.");
      return;
    }
    setAuthorizingTwitch(true);
    try {
      const { url } = await beginTwitchAuthorization();
      const state = crypto.randomUUID();
      localStorage.setItem("streamcore:twitch-oauth-state", state);
      if (expectedLogin) localStorage.setItem("streamcore:twitch-expected-login", expectedLogin);
      else localStorage.removeItem("streamcore:twitch-expected-login");
      window.location.assign(`${url}&state=${encodeURIComponent(state)}`);
    } catch (error) {
      setAuthorizingTwitch(false);
      notify(error instanceof Error ? error.message : "Twitch authorization could not start.");
    }
  }

  function setSocialUrl(platform: string, url: string) {
    const others = form.social_links.filter((link) => link.platform !== platform);
    const next = url.trim() ? [...others, { platform, label: platform, url }] : others;
    setForm({ ...form, social_links: next });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isAdmin) {
        const { error } = await supabase.from("profiles").update(form).eq("id", account.id);
        if (error) throw error;
      } else {
        if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
        await saveCreatorProfile({ data: {
          accessToken,
          profile: {
            display_name: form.display_name,
            bio: form.bio,
            avatar_url: form.avatar_url,
            banner_url: form.banner_url,
            social_links: form.social_links,
          },
        } });
      }
      await refresh();
      notify("Profile saved");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Profile could not be saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-5 max-w-3xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Your Creator Account
          </p>
          <h1 className="text-xl font-extrabold">{account.display_name}</h1>
        </div>
        <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary">
          {ROLE_META[role].icon} {ROLE_META[role].label}
        </span>
      </header>

      {/* Mandatory Twitch Channel Authorization Card */}
      {!isAuthorized && !isAdmin && (
        <div className="rounded-2xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-950/50 via-purple-900/20 to-background p-6 shadow-xl space-y-4 animate-in fade-in">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-600 text-2xl text-white shadow-lg">
              🟣
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-foreground tracking-wide">
                  Step 2 · Authorize Your Twitch Channel
                </h2>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                  Required To Access Community
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Connecting your Twitch channel authorizes your creator profile, confirms your identity, and allows fellow community members to discover and support your live streams.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/30 bg-background/80 p-4 space-y-3">
            <Field label="Your Twitch Channel or Username">
              <input
                type="text"
                className={`${inputClass} border-purple-500/40 focus:border-purple-400`}
                placeholder="e.g. your_twitch_name or https://twitch.tv/your_twitch_name"
                value={form.channel_url}
                onChange={(e) => setForm({ ...form, channel_url: e.target.value })}
              />
            </Field>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                disabled={authorizingTwitch}
                onClick={() => void handleAuthorizeTwitch()}
                className="flex-1 rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white hover:bg-purple-500 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2"
              >
                <span>🟣</span>
                <span>{authorizingTwitch ? "Verifying & Authorizing…" : "Authorize Channel & Continue to #general"}</span>
              </button>

              <button
                type="button"
                disabled={authorizingTwitch}
                onClick={() => void connectTwitchOAuth()}
                className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition"
                title="Authorize with Twitch OAuth login"
              >
                OAuth Login ↗
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span>🔒</span>
            <span>You must complete Twitch channel authorization before leaving your profile page.</span>
          </p>
        </div>
      )}

      {isAuthorized && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-center justify-between">
          <span className="font-semibold flex items-center gap-1.5">
            <span>✓</span>
            <span>Twitch Channel Connected & Authorized: <strong className="text-white">{account.channel_url || account.display_name}</strong></span>
          </span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
            Active
          </span>
        </div>
      )}

      <div className="rounded-xl bg-popover p-4 text-xs text-muted-foreground">
        Member since {formatDate(new Date(account.created_at).getTime())}.{" "}
        {account.is_banned
          ? "Your account is banned — contact the owner."
          : isRestricted(account)
            ? "Posting is temporarily restricted by a moderator."
            : "Your profile is visible in the creator directory."}
      </div>

      <form onSubmit={save} className="space-y-3 rounded-xl bg-popover p-4">
        <Field label="Display name">
          <input
            required
            className={inputClass}
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </Field>
        <Field label="Handle">
          <input
            className={inputClass}
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
            placeholder="@yourhandle"
          />
        </Field>
        <Field label="Bio">
          <textarea
            rows={3}
            className={inputClass}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </Field>

        {/* Social Connections Section with Milestone Locking for New Members */}
        <div className="space-y-3 rounded-xl bg-background p-4 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-foreground">Social Connections</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Manage connected platform links." : "Twitch is your primary verified connection. Other platforms unlock with community milestones."}
              </p>
            </div>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => setConnectionsOpen(true)}
                className={ghostButtonClass}
              >
                Milestones Info
              </button>
            )}
          </div>

          {/* Primary Twitch Connection */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🟣</span>
              <div>
                <p className="text-xs font-bold text-foreground">Twitch</p>
                <p className="text-[11px] text-muted-foreground">
                  {isAuthorized ? form.channel_url || "Connected & Authorized" : "Mandatory Creator Connection"}
                </p>
              </div>
            </div>
            {isAuthorized ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                ✓ Authorized
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void handleAuthorizeTwitch()}
                className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500"
              >
                Authorize
              </button>
            )}
          </div>

          {/* Real milestone results for new members */}
          {!isAdmin && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                {milestonesLoading ? "⏳ Calculating Community Milestones" : "Community Milestone Connections"}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {LOCKED_MILESTONES.map((item) => {
                  const unlocked = Boolean(milestones?.unlocks[item.key]);
                  const existing = form.social_links.find((link) => link.platform === item.platform)?.url ?? "";
                  return (
                    <div key={item.platform} className={`rounded-lg border px-3 py-2 text-xs ${unlocked ? "border-emerald-500/35 bg-emerald-500/10" : "border-border/40 bg-accent/20 opacity-85"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{item.icon} {item.platform}</span>
                        <span className={`text-[10px] font-bold ${unlocked ? "text-emerald-400" : "text-amber-400"}`}>
                          {unlocked ? "✓ Unlocked" : "🔒 Locked"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">{milestoneProgress(item.key, milestones)}</p>
                      {unlocked && (
                        <input
                          type="url"
                          className={`${inputClass} mt-2 h-8 text-xs`}
                          placeholder={`${item.platform} profile URL`}
                          value={existing}
                          onChange={(event) => setSocialUrl(item.platform, event.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin custom links */}
          {isAdmin && form.social_links.map((link: SocialLink, index: number) => (
            <div key={index} className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2">
              <span className="self-center text-sm font-semibold">{link.platform}</span>
              <input
                type="url"
                className={inputClass}
                placeholder="Profile URL"
                value={link.url}
                onChange={(e) =>
                  setForm({
                    ...form,
                    social_links: form.social_links.map((item, i) =>
                      i === index ? { ...item, url: e.target.value, label: e.target.value } : item,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="text-xs text-destructive"
                onClick={() =>
                  setForm({
                    ...form,
                    social_links: form.social_links.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Platform">
                <select
                  className={inputClass}
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                >
                  {["Twitch", "YouTube", "TikTok", "Kick", "Other"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="online">Online</option>
                  <option value="live">Live now</option>
                  <option value="offline">Offline</option>
                </select>
              </Field>
            </div>
            <Field label="Channel URL">
              <input
                type="url"
                className={inputClass}
                value={form.channel_url}
                onChange={(e) => setForm({ ...form, channel_url: e.target.value })}
                placeholder="https://twitch.tv/yourchannel"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Avatar image URL">
                <input
                  className={inputClass}
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                />
              </Field>
              <Field label="Banner image URL">
                <input
                  className={inputClass}
                  value={form.banner_url}
                  onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                />
              </Field>
            </div>
          </>
        )}

        <button disabled={busy} type="submit" className={`${buttonClass} w-full`}>
          {busy ? "Saving…" : "Save profile changes"}
        </button>
      </form>

      {/* Milestone Modal */}
      {connectionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in"
          onClick={() => setConnectionsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-popover p-5 shadow-elevated space-y-4 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-foreground">Community Milestone Unlocks</h2>
              <button onClick={() => setConnectionsOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              These values are calculated from your stored community posts, received reactions, confirmed Twitch raids, latest ranking snapshot, and assigned roles. Level 2 requires 50 activity points: one per general message, one per two reactions, and ten per confirmed raid.
            </p>
            <div className="space-y-2">
              {LOCKED_MILESTONES.map((m) => (
                <div key={m.platform} className="flex items-center justify-between rounded-lg bg-accent/40 p-2.5 text-xs">
                  <span className="font-semibold text-foreground">{m.icon} {m.platform}</span>
                  <span className={`text-[11px] font-medium ${milestones?.unlocks[m.key] ? "text-emerald-400" : "text-amber-400"}`}>
                    {milestones?.unlocks[m.key] ? "✓ Unlocked" : `🔒 ${milestoneProgress(m.key, milestones)}`}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setConnectionsOpen(false)}
              className={`${buttonClass} w-full`}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <button onClick={onSignOut} className={`${ghostButtonClass} w-full`}>
        Sign out
      </button>
    </div>
  );
}
