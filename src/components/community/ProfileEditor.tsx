import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_META, isRestricted, topRole, type Account, type SocialLink } from "@/lib/account";
import { formatDate } from "@/lib/community";
import { Field, buttonClass, ghostButtonClass, inputClass } from "./Bits";
import { beginTwitchAuthorization, getTwitchChannel } from "@/lib/twitch.functions";

export function ProfileEditor({
  account,
  refresh,
  notify,
  onSignOut,
}: {
  account: Account;
  refresh: () => Promise<void>;
  notify: (m: string) => void;
  onSignOut: () => void;
}) {
  const [form, setForm] = useState({
    display_name: account.display_name,
    handle: account.handle ?? "",
    bio: account.bio,
    platform: account.platform,
    channel_url: account.channel_url,
    status: account.status,
    avatar_url: account.avatar_url,
    banner_url: account.banner_url,
    created_at: account.created_at,
    social_links: account.social_links ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      display_name: account.display_name,
      handle: account.handle ?? "",
      bio: account.bio,
      platform: account.platform,
      channel_url: account.channel_url,
      status: account.status,
      avatar_url: account.avatar_url,
      banner_url: account.banner_url,
      created_at: account.created_at,
      social_links: account.social_links ?? [],
    });
  // A heartbeat refresh replaces the account object every minute. Do not throw
  // away an admin's in-progress date edit merely because that happened.
  }, [account.id]);

  const role = topRole(account.roles);
  const isAdmin = role === "admin";
  const providers = ["Twitch", "Instagram", "YouTube", "TikTok", "Kick", "X", "Discord", "Spotify", "Steam", "Reddit", "GitHub", "Facebook"];

  async function autoFillChannel() {
    if (!form.channel_url.trim()) return notify("Paste your Twitch channel URL first");
    try {
      const metadata = await getTwitchChannel({ data: { channelUrl: form.channel_url } });
      setForm((current) => ({ ...current, display_name: metadata.name || current.display_name, handle: metadata.handle || current.handle, bio: metadata.bio || current.bio, platform: metadata.platform, status: metadata.status, avatar_url: metadata.avatar || current.avatar_url, banner_url: metadata.banner || current.banner_url }));
      notify("Twitch profile, banner, bio, and live status filled");
    } catch { notify("Could not read that Twitch channel. Check the URL and try again."); }
  }

  async function connectTwitch() {
    try {
      const { url } = await beginTwitchAuthorization();
      const state = crypto.randomUUID();
      localStorage.setItem("streamcore:twitch-oauth-state", state);
      window.location.assign(`${url}&state=${encodeURIComponent(state)}`);
    } catch { notify("Twitch connection is not configured yet."); }
  }

  function addSocialLink() {
    setForm((current) => ({ ...current, social_links: [...current.social_links, { platform: "Instagram", url: "", label: "" }] }));
  }

  function chooseProvider(provider: string) {
    if (provider === "Twitch") return void connectTwitch();
    setSelectedProvider(provider);
    setConnectionsOpen(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", account.id);
    await refresh();
    setBusy(false);
    notify(error ? error.message : "Profile saved");
  }

  return (
    <div className="space-y-4 px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Your account
          </p>
          <h1 className="text-xl font-extrabold">{account.display_name}</h1>
        </div>
        <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary">
          {ROLE_META[role].icon} {ROLE_META[role].label}
        </span>
      </header>

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
        {isAdmin && <><div className="grid grid-cols-2 gap-3">
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
          <div className="flex gap-2"><input
            type="url"
            className={inputClass}
            value={form.channel_url}
            onChange={(e) => setForm({ ...form, channel_url: e.target.value })}
            placeholder="https://twitch.tv/yourchannel"
          /><button type="button" onClick={() => void autoFillChannel()} className={`${ghostButtonClass} shrink-0`}>Auto-fill</button></div>
        </Field>
        {isAdmin && <Field label="Member since"><input type="date" className={inputClass} value={form.created_at.slice(0, 10)} onChange={(e) => setForm({ ...form, created_at: new Date(`${e.target.value}T12:00:00`).toISOString() })} /><p className="mt-1 text-xs text-muted-foreground">Only the community admin can adjust this date.</p></Field>}
        </>}
        {!isAdmin && <div className="space-y-3 rounded-xl bg-background p-4"><div className="flex items-center justify-between"><div><p className="font-bold">Connections</p><p className="text-xs text-muted-foreground">Connect accounts to verify and show them on your profile.</p></div><button type="button" onClick={() => setConnectionsOpen(true)} className={ghostButtonClass}>Add</button></div>{account.twitch_verified && <p className="rounded-md bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">✓ Twitch connected and verified</p>}{form.social_links.map((link: SocialLink, index: number) => <div key={index} className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2"><span className="self-center text-sm font-semibold">{link.platform}</span><input type="url" className={inputClass} placeholder="Profile URL" value={link.url} onChange={(e) => setForm({ ...form, social_links: form.social_links.map((item, i) => i === index ? { ...item, url: e.target.value, label: e.target.value } : item) })} /><button type="button" className="text-xs text-destructive" onClick={() => setForm({ ...form, social_links: form.social_links.filter((_, i) => i !== index) })}>Remove</button></div>)}{selectedProvider && <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] gap-2"><span className="self-center text-sm font-semibold">{selectedProvider}</span><input autoFocus type="url" className={inputClass} placeholder={`${selectedProvider} profile URL`} onBlur={(e) => { if (e.target.value.trim()) setForm({ ...form, social_links: [...form.social_links, { platform: selectedProvider, url: e.target.value.trim(), label: e.target.value.trim() }] }); setSelectedProvider(null); }} /><button type="button" className="text-xs text-muted-foreground" onClick={() => setSelectedProvider(null)}>Cancel</button></div>}</div>}
        {isAdmin && <div className="grid grid-cols-2 gap-3">
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
        </div>}
        <button disabled={busy} type="submit" className={`${buttonClass} w-full`}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>

      {connectionsOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setConnectionsOpen(false)}><div className="w-full max-w-md rounded-t-2xl bg-popover p-4 shadow-elevated sm:rounded-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Add new connection</h2><button onClick={() => setConnectionsOpen(false)} className="text-muted-foreground">×</button></div><div className="grid grid-cols-2 gap-2">{providers.map((provider) => <button key={provider} type="button" onClick={() => chooseProvider(provider)} className="rounded-lg bg-accent px-3 py-3 text-left text-sm font-semibold hover:bg-accent/70">{provider}{provider === "Twitch" && <span className="mt-1 block text-[10px] font-normal text-primary">Authorize account</span>}</button>)}</div><p className="mt-3 text-xs text-muted-foreground">Twitch uses secure account authorization. Other providers are shown as verified profile links until their own OAuth apps are configured.</p></div></div>}

      <button onClick={onSignOut} className={`${ghostButtonClass} w-full`}>
        Sign out
      </button>
    </div>
  );
}
