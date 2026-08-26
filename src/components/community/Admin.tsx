import { useState, type ReactNode, type FormEvent } from "react";
import {
  readFileAsDataUrl,
  type Community,
  type Connection,
  type Member,
  type State,
  type PostInput,
  type Stats,
  type Status,
} from "@/lib/community";
import { Avatar, Field, buttonClass, ghostButtonClass, inputClass } from "./Bits";
import { getChannelMetadata } from "@/lib/channel-metadata";

export function AdminView({
  state,
  addMember,
  removeMember,
  addPost,
  setStats,
  setCommunity,
  updateMember,
  notify,
  crm,
}: {
  state: State;
  addMember: (m: Omit<Member, "id">) => void;
  removeMember: (id: string) => void;
  addPost: (post: PostInput) => void;
  setStats: (s: Stats) => void;
  setCommunity: (community: Community) => void;
  updateMember: (id: string, patch: Partial<Member>) => void;
  notify: (msg: string) => void;
  crm?: ReactNode;
}) {
  const [form, setForm] = useState({
    name: "",
    handle: "",
    link: "",
    bio: "",
    status: "online" as Status,
    platform: "Twitch",
    joined: new Date().toISOString().slice(0, 10),
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [connectionPlatform, setConnectionPlatform] = useState("Instagram");
  const [connectionLabel, setConnectionLabel] = useState("");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [community, setLocalCommunity] = useState<Community>(state.community);
  const [communityLogoFile, setCommunityLogoFile] = useState<File | null>(null);
  const [communityBannerFile, setCommunityBannerFile] = useState<File | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoAvatar, setAutoAvatar] = useState("");
  const [autoBanner, setAutoBanner] = useState("");

  const [postAuthor, setPostAuthor] = useState(state.members[0]?.id ?? "");
  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);

  const [stats, setLocalStats] = useState<Stats>(state.stats);

  async function submitMember(e: FormEvent) {
    e.preventDefault();
    const [avatar, banner] = await Promise.all([
      readFileAsDataUrl(avatarFile),
      readFileAsDataUrl(bannerFile),
    ]);
    const primary: Connection | undefined = form.link
      ? {
          id: "primary",
          platform: form.platform,
          label: form.handle.replace(/^@/, "") || form.name,
          url: form.link,
          verified: true,
        }
      : undefined;
    const saved = {
      ...form,
      avatar: avatar || autoAvatar || editingMember?.avatar || "",
      banner: banner || autoBanner || editingMember?.banner || "",
      connections: [...(primary ? [primary] : []), ...connections],
      joined: new Date(`${form.joined}T12:00:00`).getTime() || Date.now(),
    };
    if (editingMember) {
      updateMember(editingMember.id, saved);
      notify("Member updated");
    } else {
      addMember(saved);
      notify("Member added");
    }
    setForm({ name: "", handle: "", link: "", bio: "", status: "online", platform: "Twitch", joined: new Date().toISOString().slice(0, 10) });
    setAvatarFile(null);
    setBannerFile(null);
    setAutoAvatar("");
    setAutoBanner("");
    setConnections([]);
    setEditingMember(null);
  }

  async function submitCommunity(e: FormEvent) {
    e.preventDefault();
    const [logo, banner] = await Promise.all([
      readFileAsDataUrl(communityLogoFile),
      readFileAsDataUrl(communityBannerFile),
    ]);
    setCommunity({
      ...community,
      logo: logo || state.community.logo,
      banner: banner || state.community.banner,
    });
    setCommunityLogoFile(null);
    setCommunityBannerFile(null);
    notify("Community appearance updated");
  }

  function beginEdit(member: Member) {
    setEditingMember(member);
    setForm({
      name: member.name,
      handle: member.handle,
      link: member.link,
      bio: member.bio,
      status: member.status,
      platform: member.platform,
      joined: member.joined ? new Date(member.joined).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setConnections((member.connections ?? []).filter((c) => c.id !== "primary"));
    setAutoAvatar(member.avatar);
    setAutoBanner(member.banner);
  }

  async function autoFillChannel() {
    if (!form.link.trim()) return notify("Paste a channel link first");
    setAutoFilling(true);
    try {
      const metadata = await getChannelMetadata(form.link);
      setForm((current) => ({
        ...current,
        name: metadata.name || current.name,
        handle: metadata.handle || current.handle,
        bio: metadata.bio || current.bio,
        platform: metadata.platform,
      }));
      if (metadata.avatar && !avatarFile) setAutoAvatar(metadata.avatar);
      if (metadata.banner && !bannerFile) setAutoBanner(metadata.banner);
      notify("Public channel details filled. Review before saving.");
    } catch {
      notify("Could not read that channel. Fill in the details manually.");
    } finally {
      setAutoFilling(false);
    }
  }

  function addConnection() {
    if (!connectionUrl.trim()) return notify("Add a connection URL first");
    setConnections((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        platform: connectionPlatform,
        label: connectionLabel.trim() || connectionPlatform,
        url: connectionUrl.trim(),
        verified: true,
      },
    ]);
    setConnectionLabel("");
    setConnectionUrl("");
  }

  async function submitPost(e: FormEvent) {
    e.preventDefault();
    const image = await readFileAsDataUrl(postImage);
    const author = postAuthor || state.members[0]?.id;
    if (!author) return;
    addPost({ authorId: author, text: postText, image });
    setPostText("");
    setPostImage(null);
    notify("Post published");
  }

  return (
    <div className="space-y-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Owner only
          </p>
          <h1 className="text-xl font-extrabold">Community control center</h1>
        </div>
        <span className="shrink-0 rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary">
          ADMIN MODE
        </span>
      </header>

      <form onSubmit={submitCommunity} className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">01 · Community identity</h2>
        <Field label="Community name">
          <input required className={inputClass} value={community.name} onChange={(e) => setLocalCommunity({ ...community, name: e.target.value })} />
        </Field>
        <Field label="Tagline">
          <input className={inputClass} value={community.tagline} onChange={(e) => setLocalCommunity({ ...community, tagline: e.target.value })} placeholder="The home of streamers" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={communityLogoFile ? "Community logo ✓" : "Community logo"}>
            <input type="file" accept="image/*" className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-foreground`} onChange={(e) => setCommunityLogoFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field label={communityBannerFile ? "Community banner ✓" : "Community banner"}>
            <input type="file" accept="image/*" className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-foreground`} onChange={(e) => setCommunityBannerFile(e.target.files?.[0] ?? null)} />
          </Field>
        </div>
        <button type="submit" className={`${buttonClass} w-full`}>Save community details</button>
      </form>

      <form onSubmit={submitMember} className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">02 · {editingMember ? "Edit member" : "Add a member"}</h2>
        <Field label="Creator name">
          <input
            required
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. NovaStreams"
          />
        </Field>
        <Field label="Handle">
          <input
            required
            className={inputClass}
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
            placeholder="@novastreams"
          />
        </Field>
        <Field label="Channel link">
          <div className="flex gap-2"><input type="url" className={inputClass} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://twitch.tv/..." /><button type="button" disabled={autoFilling} onClick={() => void autoFillChannel()} className={`${ghostButtonClass} shrink-0 disabled:opacity-50`}>{autoFilling ? "Checking…" : "Auto-fill"}</button></div>
        </Field>
        <p className="-mt-1 text-xs text-muted-foreground">Auto-fill uses public channel metadata. Set live status manually unless you connect the official platform API.</p>
        <Field label="Bio">
          <textarea
            rows={3}
            className={inputClass}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Short creator bio"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
            >
              <option value="online">Online</option>
              <option value="live">Live now</option>
              <option value="offline">Offline</option>
            </select>
          </Field>
          <Field label="Platform">
            <select
              className={inputClass}
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
            >
              {["Twitch", "YouTube", "TikTok", "Instagram", "Spotify", "Kick", "Other"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={avatarFile ? "Avatar ✓" : "Avatar"}>
            <input
              type="file"
              accept="image/*"
              className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-foreground`}
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label={bannerFile ? "Banner ✓" : "Banner"}>
            <input
              type="file"
              accept="image/*"
              className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-foreground`}
              onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <Field label="Member since">
          <input type="date" className={inputClass} value={form.joined} onChange={(e) => setForm({ ...form, joined: e.target.value })} />
        </Field>
        <div className="space-y-2 rounded-lg bg-background p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Additional connections</p>
          <div className="grid grid-cols-2 gap-2">
            <select className={inputClass} value={connectionPlatform} onChange={(e) => setConnectionPlatform(e.target.value)}>
              {["Instagram", "TikTok", "YouTube", "Spotify", "Twitch", "Kick", "X", "Discord"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <input className={inputClass} value={connectionLabel} onChange={(e) => setConnectionLabel(e.target.value)} placeholder="Username (optional)" />
          </div>
          <div className="flex gap-2"><input type="url" className={inputClass} value={connectionUrl} onChange={(e) => setConnectionUrl(e.target.value)} placeholder="https://..." /><button type="button" onClick={addConnection} className={ghostButtonClass}>Add</button></div>
          {connections.map((c) => <div key={c.id} className="flex items-center justify-between text-xs"><span>{c.platform} · {c.label}</span><button type="button" className="text-destructive" onClick={() => setConnections((items) => items.filter((x) => x.id !== c.id))}>Remove</button></div>)}
        </div>
        <button type="submit" className={`${buttonClass} w-full`}>
          {editingMember ? "Save member" : "Add member"}
        </button>
      </form>

      <form onSubmit={submitPost} className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">03 · Publish a post</h2>
        <Field label="Display author">
          <select
            className={inputClass}
            value={postAuthor}
            onChange={(e) => setPostAuthor(e.target.value)}
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.handle}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Post text">
          <textarea
            required
            rows={5}
            className={inputClass}
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="Type anything you want the community to see..."
          />
        </Field>
        <Field label={postImage ? "Image ✓" : "Optional image"}>
          <input
            type="file"
            accept="image/*"
            className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-foreground`}
            onChange={(e) => setPostImage(e.target.files?.[0] ?? null)}
          />
        </Field>
        <button type="submit" className={`${buttonClass} w-full`}>
          Publish to community
        </button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setStats(stats);
          notify("Public stats updated");
        }}
        className="space-y-3 rounded-xl bg-popover p-4"
      >
        <h2 className="font-bold">04 · Public stats</h2>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Members">
            <input
              className={inputClass}
              value={stats.members}
              onChange={(e) => setLocalStats({ ...stats, members: e.target.value })}
            />
          </Field>
          <Field label="Online">
            <input
              className={inputClass}
              value={stats.online}
              onChange={(e) => setLocalStats({ ...stats, online: e.target.value })}
            />
          </Field>
          <Field label="Rank">
            <input
              className={inputClass}
              value={stats.rank}
              onChange={(e) => setLocalStats({ ...stats, rank: e.target.value })}
            />
          </Field>
        </div>
        <button type="submit" className={`${ghostButtonClass} w-full`}>
          Update public stats
        </button>
      </form>

      <div className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">05 · Manage members</h2>
        <div className="space-y-2">
          {state.members.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-background p-2.5"
            >
              <Avatar member={m} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.handle} · {m.status}
                </p>
              </div>
              <div className="flex gap-2">
              <button type="button" onClick={() => beginEdit(m)} className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-bold">Edit</button>
              <button
                type="button"
                onClick={() => {
                  if (state.members.length <= 1) return notify("Keep at least one profile");
                  removeMember(m.id);
                  notify("Member removed");
                }}
                className="shrink-0 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive"
              >
                Remove
              </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {crm}
    </div>
  );
}
