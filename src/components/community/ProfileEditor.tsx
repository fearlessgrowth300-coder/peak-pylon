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
    social_links: account.social_links ?? [],
  });
  const [busy, setBusy] = useState(false);

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
      social_links: account.social_links ?? [],
    });
  }, [account]);

  const role = topRole(account.roles);

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
          <div className="flex gap-2"><input
            type="url"
            className={inputClass}
            value={form.channel_url}
            onChange={(e) => setForm({ ...form, channel_url: e.target.value })}
            placeholder="https://twitch.tv/yourchannel"
          /><button type="button" onClick={() => void autoFillChannel()} className={`${ghostButtonClass} shrink-0`}>Preview</button></div>
        </Field>
        <button type="button" onClick={() => void connectTwitch()} className={`${buttonClass} w-full`}>{account.twitch_verified ? "✓ Twitch account verified" : "Connect and verify Twitch account"}</button>
        <div className="space-y-2 rounded-lg bg-background p-3"><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Social links</p><button type="button" onClick={addSocialLink} className="text-xs font-semibold text-primary">+ Add social</button></div>{form.social_links.map((link: SocialLink, index: number) => <div key={index} className="grid grid-cols-[120px_minmax(0,1fr)_auto] gap-2"><select className={inputClass} value={link.platform} onChange={(e) => setForm({ ...form, social_links: form.social_links.map((item, i) => i === index ? { ...item, platform: e.target.value } : item) })}>{["Instagram", "YouTube", "TikTok", "Kick", "X", "Discord", "Other"].map((name) => <option key={name}>{name}</option>)}</select><input type="url" className={inputClass} placeholder="https://..." value={link.url} onChange={(e) => setForm({ ...form, social_links: form.social_links.map((item, i) => i === index ? { ...item, url: e.target.value } : item) })} /><button type="button" className="text-xs text-destructive" onClick={() => setForm({ ...form, social_links: form.social_links.filter((_, i) => i !== index) })}>Remove</button></div>)}</div>
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
        <button disabled={busy} type="submit" className={`${buttonClass} w-full`}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>

      <button onClick={onSignOut} className={`${ghostButtonClass} w-full`}>
        Sign out
      </button>
    </div>
  );
}
