import { useState, type ReactNode, type FormEvent } from "react";
import {
  readFileAsDataUrl,
  uploadCommunityMedia,
  type Community,
  type CommunityChannel,
  type Connection,
  type Member,
  type State,
  type PostInput,
  type Stats,
  type Status,
  uid,
} from "@/lib/community";
import { Avatar, Field, buttonClass, ghostButtonClass, inputClass } from "./Bits";
import { getTwitchChannel, testTwitchConnection } from "@/lib/twitch.functions";
import { getChannelMetadata } from "@/lib/channel-metadata";
import {
  getResendNotificationConfig,
  saveResendNotificationConfig,
  sendResendEmail,
  type ResendNotificationConfig,
} from "@/lib/notifications";

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
  addChannel,
  removeChannel,
  generateClips,
  allMembers,
}: {
  state: State;
  allMembers?: Member[];
  addMember: (m: Omit<Member, "id">) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  addPost: (post: PostInput) => Promise<void>;
  setStats: (s: Stats) => void;
  setCommunity: (community: Community) => void;
  updateMember: (id: string, patch: Partial<Member>) => Promise<void>;
  notify: (msg: string) => void;
  crm?: ReactNode;
  addChannel: (channel: Omit<CommunityChannel, "id" | "createdAt">) => void;
  removeChannel: (id: string) => void;
  generateClips?: (member: Member, amount: number) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    handle: "",
    link: "",
    bio: "",
    status: "online" as Status,
    platform: "Twitch",
    role: "affiliate",
    joined: new Date().toISOString().slice(0, 10),
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [clipAmounts, setClipAmounts] = useState<Record<string, number>>({});
  const [activeClipModalMember, setActiveClipModalMember] = useState<Member | null>(null);
  const [modalClipAmount, setModalClipAmount] = useState(5);
  const [generatingClipsLoading, setGeneratingClipsLoading] = useState(false);
  const [connectionPlatform, setConnectionPlatform] = useState("Instagram");
  const [connectionLabel, setConnectionLabel] = useState("");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [community, setLocalCommunity] = useState<Community>(() => state?.community ?? { name: "StreamCore", logo: "", banner: "", tagline: "The home of streamers", rules: "" });
  const [communityLogoFile, setCommunityLogoFile] = useState<File | null>(null);
  const [communityBannerFile, setCommunityBannerFile] = useState<File | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoAvatar, setAutoAvatar] = useState("");
  const [autoBanner, setAutoBanner] = useState("");
  const [autoFollowers, setAutoFollowers] = useState<number | undefined>(undefined);
  const [autoViewerCount, setAutoViewerCount] = useState<number | undefined>(undefined);
  const [autoGameName, setAutoGameName] = useState<string | undefined>(undefined);
  const [autoStreamTitle, setAutoStreamTitle] = useState<string | undefined>(undefined);
  const [channelName, setChannelName] = useState("");
  const [channelTopic, setChannelTopic] = useState("");
  const [channelType, setChannelType] = useState<CommunityChannel["type"]>("text");
  const [channelAllowsChat, setChannelAllowsChat] = useState(true);

  const [postAuthor, setPostAuthor] = useState(() => state?.members?.[0]?.id ?? "");
  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postChannel, setPostChannel] = useState("general");

  const [stats, setLocalStats] = useState<Stats>(() => state?.stats ?? { members: "21", online: "18", rank: "#1" });

  const [resendConfig, setLocalResendConfig] = useState<ResendNotificationConfig>(() => getResendNotificationConfig());
  const [testingResend, setTestingResend] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState("");
  const [testingTwitch, setTestingTwitch] = useState(false);
  const [twitchStatus, setTwitchStatus] = useState<string | null>(null);
  const [syncingAllTwitch, setSyncingAllTwitch] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; logs: string[] } | null>(null);

  async function submitMember(e: FormEvent) {
    e.preventDefault();
    const [avatar, banner] = await Promise.all([
      avatarFile ? uploadCommunityMedia(avatarFile) : Promise.resolve(""),
      bannerFile ? uploadCommunityMedia(bannerFile) : Promise.resolve(""),
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
    // Check for duplicate member
    const normLink = form.link.trim().toLowerCase().replace(/\/$/, "");
    const normHandle = form.handle.trim().toLowerCase().replace(/^@/, "");
    const normName = form.name.trim().toLowerCase();

    const existingMatch = state.members.find((m) => {
      if (editingMember && m.id === editingMember.id) return false;
      const mLink = (m.link || "").trim().toLowerCase().replace(/\/$/, "");
      const mHandle = (m.handle || "").trim().toLowerCase().replace(/^@/, "");
      const mName = (m.name || "").trim().toLowerCase();
      return (
        (normLink && mLink && normLink === mLink) ||
        (normHandle && mHandle && normHandle === mHandle) ||
        (normName && mName && normName === mName)
      );
    });

    if (!editingMember && existingMatch) {
      return notify(`⚠️ "${existingMatch.name}" (@${existingMatch.handle.replace(/^@/, "")}) is ALREADY added in this community!`);
    }

    const saved = {
      ...form,
      role: (form.role || "affiliate") as Member["role"],
      avatar: avatar || autoAvatar || editingMember?.avatar || "",
      banner: banner || autoBanner || editingMember?.banner || "",
      followers: autoFollowers ?? editingMember?.followers,
      viewerCount: autoViewerCount ?? editingMember?.viewerCount,
      gameName: autoGameName ?? editingMember?.gameName,
      streamTitle: autoStreamTitle ?? editingMember?.streamTitle,
      connections: [...(primary ? [primary] : []), ...connections],
      joined: new Date(`${form.joined}T12:00:00`).getTime() || Date.now(),
      manualStatus: (form.status === "offline" ? "offline" : "online") as "online" | "offline",
    };
    if (editingMember) {
      try {
        await updateMember(editingMember.id, saved);
        notify("Member updated successfully");
      } catch {
        return notify("Member update could not be saved to Supabase");
      }
    } else {
      try {
        await addMember(saved);
        notify(`🎉 Streamer ${saved.name} added to community!`);
      } catch {
        return notify("Member could not be saved to Supabase");
      }
    }
    setForm({ name: "", handle: "", link: "", bio: "", status: "online", platform: "Twitch", role: "affiliate", joined: new Date().toISOString().slice(0, 10) });
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
      role: member.role || "affiliate",
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
      const isTwitch = /(^|\.)twitch\.tv\//i.test(new URL(form.link).hostname + "/");
      const metadata = isTwitch
        ? await getTwitchChannel({ data: { channelUrl: form.link } })
        : await getChannelMetadata(form.link);

      // Check if channel link already exists
      const normInput = form.link.trim().toLowerCase().replace(/\/$/, "");
      const isDuplicate = state.members.find((m) => {
        const mLink = (m.link || "").trim().toLowerCase().replace(/\/$/, "");
        const mHandle = (m.handle || "").trim().toLowerCase().replace(/^@/, "");
        const autoHandle = (metadata.handle || "").trim().toLowerCase().replace(/^@/, "");
        return (normInput && mLink && normInput === mLink) || (autoHandle && mHandle && autoHandle === mHandle);
      });

      if (isDuplicate) {
        notify(`⚠️ Streamer "${isDuplicate.name}" (@${isDuplicate.handle.replace(/^@/, "")}) is ALREADY added in this community!`);
      } else {
        notify(isTwitch ? "Twitch profile and live status filled. Review before saving." : "Public channel details filled. Review before saving.");
      }

      setForm((current) => ({
        ...current,
        name: metadata.name || current.name,
        handle: metadata.handle || current.handle,
        bio: metadata.bio || current.bio,
        platform: metadata.platform,
        status: ("status" in metadata ? metadata.status : current.status) as typeof current.status,
      }));
      if (metadata.avatar && !avatarFile) setAutoAvatar(metadata.avatar);
      if (metadata.banner && !bannerFile) setAutoBanner(metadata.banner);
      if ("followers" in metadata && metadata.followers) setAutoFollowers(metadata.followers as number);
      if ("viewerCount" in metadata && metadata.viewerCount) setAutoViewerCount(metadata.viewerCount as number);
      if ("gameName" in metadata && metadata.gameName) setAutoGameName(metadata.gameName as string);
      if ("streamTitle" in metadata && metadata.streamTitle) setAutoStreamTitle(metadata.streamTitle as string);
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
    const author = postAuthor || state.members[0]?.id;
    if (!author) return;
    try {
      const image = postImage ? await uploadCommunityMedia(postImage) : "";
      await addPost({ authorId: author, text: postText, image, channel: postChannel });
      setPostText("");
      setPostImage(null);
      notify("Post published");
    } catch {
      notify("Post could not be saved to Supabase");
    }
  }

  function submitChannel(e: FormEvent) {
    e.preventDefault();
    const name = channelName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!name) return notify("Enter a channel name");
    if (state.channels.some((channel) => channel.name === name) || ["general", "creators", "live-now"].includes(name)) return notify("That channel already exists");
    addChannel({ name, topic: channelTopic.trim() || "Community discussion", type: channelType, allowChat: channelAllowsChat });
    setChannelName("");
    setChannelTopic("");
    notify(`#${name} created`);
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
        <Field label="Community rules (one rule per line)">
          <textarea rows={5} className={inputClass} value={community.rules} onChange={(e) => setLocalCommunity({ ...community, rules: e.target.value })} />
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
        <p className="-mt-1 text-xs text-muted-foreground">Twitch links fill the public profile and live status automatically. Other platforms use available public metadata.</p>
        <Field label="Bio">
          <textarea
            rows={3}
            className={inputClass}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Short creator bio"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <Field label="Channel Growth Tier">
            <select
              className={inputClass}
              value={form.role || "affiliate"}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="affiliate">🟢 Affiliate Streamer</option>
              <option value="partner">🟣 Partner Creator</option>
              <option value="verified">🔵 Verified Creator</option>
              <option value="rising">🚀 Rising Star</option>
              <option value="member">Streamer Member</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={avatarFile ? "Avatar ✓" : "Avatar"}>
            <div className="space-y-2"><input type="file" accept="image/*" className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-foreground`} onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />{autoAvatar && !avatarFile && <div className="flex items-center gap-2 rounded-md bg-background p-2 text-xs text-muted-foreground"><img src={autoAvatar} alt="Auto-detected creator avatar" className="h-9 w-9 rounded-full object-cover" /><span>Auto-detected avatar — saved when you add the member.</span></div>}</div>
          </Field>
          <Field label={bannerFile ? "Banner ✓" : "Banner"}>
            <div className="space-y-2"><input type="file" accept="image/*" className={`${inputClass} file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:text-foreground`} onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} />{autoBanner && !bannerFile && <div className="overflow-hidden rounded-md bg-background text-xs text-muted-foreground"><img src={autoBanner} alt="Auto-detected creator banner" className="h-12 w-full object-cover" /><p className="p-2">Auto-detected banner — saved when you add the member.</p></div>}{!autoBanner && !bannerFile && <p className="text-xs text-muted-foreground">Twitch did not provide a banner for this channel. Upload one manually if needed.</p>}</div>
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

      <form onSubmit={submitChannel} className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">03 · Community channels</h2>
        <p className="text-xs text-muted-foreground">Only the community owner can create or remove channels. New members begin in #rules.</p>
        <Field label="Channel name">
          <input required className={inputClass} value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="e.g. clips-and-highlights" />
        </Field>
        <Field label="Channel topic">
          <input className={inputClass} value={channelTopic} onChange={(e) => setChannelTopic(e.target.value)} placeholder="What members can discuss here" />
        </Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Channel type"><select className={inputClass} value={channelType} onChange={(e) => setChannelType(e.target.value as CommunityChannel["type"])}><option value="text">Text chat</option><option value="media">Clips & media</option><option value="announcement">Announcements</option><option value="testimony">Testimonials</option><option value="social">Social updates</option><option value="voice">Call room</option></select></Field><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={channelAllowsChat} onChange={(e) => setChannelAllowsChat(e.target.checked)} /> Allow members to chat</label></div>
        <button type="submit" className={`${buttonClass} w-full`}>Create channel</button>
        <div className="space-y-2 pt-1">
          {state.channels.map((channel) => <div key={channel.id} className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm"><span><strong># {channel.name}</strong><span className="ml-2 text-xs text-muted-foreground">{channel.type} · {channel.allowChat ? "chat on" : "read only"}</span></span>{channel.id === "rules" ? <span className="text-xs text-primary">Required</span> : <button type="button" className="text-xs font-semibold text-destructive" onClick={() => { removeChannel(channel.id); notify(`#${channel.name} removed`); }}>Remove</button>}</div>)}
        </div>
      </form>

      <form onSubmit={submitPost} className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">04 · Publish a post</h2>
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
        <Field label="Publish location">
          <select className={inputClass} value={postChannel} onChange={(e) => setPostChannel(e.target.value)}>
            <option value="general"># general</option>
            <option value="trending">Trending (admin only)</option>
            <option value="clips"># clips</option>
            {state.channels.filter((channel) => !["general", "clips"].includes(channel.id)).map((channel) => <option key={channel.id} value={channel.name}># {channel.name}</option>)}
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
        <h2 className="font-bold">05 · Public stats</h2>
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
        <h2 className="font-bold">06 · Manage members</h2>
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
               <div className="flex flex-wrap justify-end gap-2">
                {generateClips && m.platform === "Twitch" && m.link && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClipModalMember(m);
                      setModalClipAmount(clipAmounts[m.id] ?? 4);
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                    title="Generate clips with custom comments & likes"
                  >
                    🎬 Generate clips…
                  </button>
                )}
                <button type="button" onClick={() => { const next = m.manualStatus === "online" || m.status === "online" ? "offline" : "online"; void updateMember(m.id, { manualStatus: next, status: next }).then(() => notify(`${m.name} set ${next}`)).catch(() => notify("Could not save member status")); }} className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-bold">{m.manualStatus === "online" || m.status === "online" ? "Set offline" : "Set online"}</button>
                <button type="button" onClick={() => beginEdit(m)} className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-bold">Edit</button>
                <button
                  type="button"
                  onClick={() =>
                    void removeMember(m.id)
                      .then(() => notify("Member permanently removed from the community"))
                      .catch((error) => notify(`Could not remove member: ${error.message ?? "database request failed"}`))
                  }
                  className="shrink-0 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 06 · Twitch API Live Diagnostics & Real-Time Sync */}
      <div className="space-y-4 rounded-xl bg-popover p-4 border border-[#9146FF]/30 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <span className="text-[#9146FF]">🎮</span> 06 · Twitch API Real-Time Connection & Helix Sync
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Syncs real follower counts, live broadcaster statuses, viewer counts, official avatars, and stream titles directly from Twitch Helix.
            </p>
          </div>
          <span className="rounded-full bg-[#9146FF]/20 px-2.5 py-1 text-xs font-bold text-[#9146FF]">
            Twitch Helix API
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={testingTwitch}
            onClick={async () => {
              setTestingTwitch(true);
              setTwitchStatus(null);
              try {
                const result = await testTwitchConnection();
                setTwitchStatus(result.message);
                notify(result.message);
              } catch (err: any) {
                const msg = `❌ Twitch Connection Failed: ${err.message}`;
                setTwitchStatus(msg);
                notify(msg);
              } finally {
                setTestingTwitch(false);
              }
            }}
            className="rounded-lg bg-[#9146FF] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#772CE8] transition-colors cursor-pointer flex items-center gap-2"
          >
            {testingTwitch ? "Testing Helix API…" : "⚡ Test Live Twitch API Connection"}
          </button>

          <button
            type="button"
            disabled={syncingAllTwitch}
            onClick={async () => {
              const targetPool = allMembers && allMembers.length > 0 ? allMembers : state.members;
              const twitchMembers = targetPool.filter(
                (m) => (m.platform?.toLowerCase() === "twitch" || m.link?.includes("twitch.tv")) && Boolean(m.link?.trim())
              );
              if (!twitchMembers.length) {
                return notify("No Twitch creators found in the community to sync.");
              }
              setSyncingAllTwitch(true);
              const logs: string[] = [];
              setSyncProgress({ current: 0, total: twitchMembers.length, logs: [] });

              for (let i = 0; i < twitchMembers.length; i++) {
                const member = twitchMembers[i];
                if (!member) continue;
                try {
                  const channelData = await getTwitchChannel({ data: { channelUrl: member.link } });
                  const patch: Partial<Member> = {
                    name: channelData.name || member.name,
                    handle: channelData.handle || member.handle,
                    bio: channelData.bio || member.bio,
                    avatar: channelData.avatar || member.avatar,
                    banner: channelData.banner || member.banner,
                    status: channelData.status as any,
                    followers: channelData.followers,
                    viewerCount: channelData.viewerCount,
                    gameName: channelData.gameName,
                    streamTitle: channelData.streamTitle,
                  };
                  await updateMember(member.id, patch);
                  const followerText = channelData.followers ? `${channelData.followers.toLocaleString()} followers` : "followers updated";
                  const statusText = channelData.status === "live" ? `🔴 LIVE (${channelData.viewerCount?.toLocaleString()} viewers)` : "Offline";
                  const log = `[${i + 1}/${twitchMembers.length}] ✅ ${member.name} (${member.handle}): ${followerText} | ${statusText}`;
                  logs.push(log);
                  setSyncProgress({ current: i + 1, total: twitchMembers.length, logs: [...logs] });
                } catch (err: any) {
                  const log = `[${i + 1}/${twitchMembers.length}] ⚠️ ${member.name}: ${err.message || "Failed to fetch"}`;
                  logs.push(log);
                  setSyncProgress({ current: i + 1, total: twitchMembers.length, logs: [...logs] });
                }
              }
              setSyncingAllTwitch(false);
              notify(`🎉 Finished syncing all ${twitchMembers.length} creators from Twitch!`);
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 transition-colors cursor-pointer flex items-center gap-2"
          >
            {syncingAllTwitch
              ? `🔄 Syncing (${syncProgress?.current ?? 0}/${syncProgress?.total ?? 0})…`
              : `🔄 Re-Pull & Sync All ${(allMembers && allMembers.length > 0 ? allMembers : state.members).filter((m) => (m.platform?.toLowerCase() === "twitch" || m.link?.includes("twitch.tv")) && m.link).length} Creators from Twitch`}
          </button>
        </div>

        {twitchStatus && (
          <div className="rounded-lg bg-accent/60 p-3 text-xs font-semibold text-foreground border border-border">
            {twitchStatus}
          </div>
        )}

        {syncProgress && (
          <div className="space-y-2 rounded-xl bg-background/90 p-3 border border-border">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Syncing Community Creators from Twitch:</span>
              <span className="text-primary font-mono">
                {syncProgress.current} / {syncProgress.total} ({Math.round((syncProgress.current / syncProgress.total) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-accent rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] bg-popover/80 p-2.5 rounded-lg border border-border">
              {syncProgress.logs.map((log, idx) => (
                <div key={idx} className={log.includes("✅") ? "text-emerald-400" : "text-amber-400"}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Credentials are server-managed. Artificial posting is intentionally disabled. */}
      <div className="space-y-2 rounded-xl bg-popover p-4 border border-border">
        <h2 className="font-bold text-foreground">07 · Secure server integrations</h2>
        <p className="text-xs text-muted-foreground">
          Gemini and Resend credentials are read only from protected deployment environment variables. No API key is stored in this browser, and automated member impersonation is disabled.
        </p>
      </div>
      {/* 09 · Resend Email Notifications for Real Streamers */}
      <div className="space-y-4 rounded-xl bg-popover p-5 border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">09 · Resend Email Notifications for Real Streamers</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically dispatches email notifications to verified real creators who signed up with their email (replies, announcements, new clips, live alerts).
            </p>
          </div>
          <span className="rounded-full bg-online/20 px-3 py-1 text-xs font-bold text-online">
            🔒 Server-managed credentials
          </span>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Sender 'From' Address">
              <input
                type="text"
                placeholder="StreamCore Alerts <onboarding@resend.dev>"
                value={resendConfig.fromEmail}
                onChange={(e) => {
                  const updated = { ...resendConfig, fromEmail: e.target.value };
                  setLocalResendConfig(updated);
                  saveResendNotificationConfig(updated);
                }}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={resendConfig.notifyRepliesAndMentions}
                onChange={(e) => {
                  const updated = { ...resendConfig, notifyRepliesAndMentions: e.target.checked };
                  setLocalResendConfig(updated);
                  saveResendNotificationConfig(updated);
                }}
                className="rounded border-border text-primary"
              />
              <span>✉️ Send email on replies & mentions to real members</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={resendConfig.notifyNewAnnouncement}
                onChange={(e) => {
                  const updated = { ...resendConfig, notifyNewAnnouncement: e.target.checked };
                  setLocalResendConfig(updated);
                  saveResendNotificationConfig(updated);
                }}
                className="rounded border-border text-primary"
              />
              <span>📢 Send email on new official announcements</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={resendConfig.notifyStreamerLive}
                onChange={(e) => {
                  const updated = { ...resendConfig, notifyStreamerLive: e.target.checked };
                  setLocalResendConfig(updated);
                  saveResendNotificationConfig(updated);
                }}
                className="rounded border-border text-primary"
              />
              <span>🔴 Send email when community members go live</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={resendConfig.notifyNewClips}
                onChange={(e) => {
                  const updated = { ...resendConfig, notifyNewClips: e.target.checked };
                  setLocalResendConfig(updated);
                  saveResendNotificationConfig(updated);
                }}
                className="rounded border-border text-primary"
              />
              <span>🎬 Send email when top streamer clips are posted</span>
            </label>
          </div>

          {/* Test Email Dispatcher */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
            <input
              type="email"
              placeholder="Enter test email address (e.g. your_email@domain.com)"
              value={testEmailTarget}
              onChange={(e) => setTestEmailTarget(e.target.value)}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={testingResend || !testEmailTarget}
              onClick={async () => {
                setTestingResend(true);
                try {
                  const res = await sendResendEmail({
                    to: testEmailTarget,
                    subject: "⚡ Test Email from StreamCore Creator Community",
                    html: `
                      <div style="font-family: sans-serif; background: #0d0e12; color: #fff; padding: 24px; border-radius: 12px;">
                        <h2 style="color: #8b5cf6;">StreamCore Resend Notification Test</h2>
                        <p style="color: #ccc;">Your Resend email configuration is working perfectly! Streamer notifications are active.</p>
                      </div>
                    `,
                  });
                  if (res.success) {
                    notify("✓ Test email sent successfully via Resend!");
                  } else {
                    notify(`Resend Error: ${res.error}`);
                  }
                } catch (err) {
                  notify(err instanceof Error ? err.message : "Failed to send test email");
                } finally {
                  setTestingResend(false);
                }
              }}
              className={`${buttonClass} shrink-0 text-xs`}
            >
              {testingResend ? "Sending Test…" : "✉️ Send Test Email"}
            </button>
          </div>
        </div>
      </div>

      {activeClipModalMember && generateClips && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-black text-foreground">🎬 Import real Twitch clips</h3>
                <p className="text-xs text-muted-foreground">
                  Select how many public clips to import for <strong className="text-primary">{activeClipModalMember.name}</strong>. Likes, comments, and shares start at zero and come only from real members.
                </p>
              </div>
              <button onClick={() => setActiveClipModalMember(null)} className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground">✕</button>
            </div>
            <Field label="Clips to import">
              <input
                type="number"
                min={1}
                max={20}
                value={modalClipAmount}
                onChange={(event) => setModalClipAmount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                className={inputClass}
              />
            </Field>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setActiveClipModalMember(null)} className={ghostButtonClass + " flex-1"}>Cancel</button>
              <button
                type="button"
                disabled={generatingClipsLoading}
                onClick={async () => {
                  if (!activeClipModalMember) return;
                  try {
                    setGeneratingClipsLoading(true);
                    await generateClips(activeClipModalMember, modalClipAmount);
                    setActiveClipModalMember(null);
                  } finally {
                    setGeneratingClipsLoading(false);
                  }
                }}
                className={buttonClass + " flex-1"}
              >
                {generatingClipsLoading ? "Importing…" : "Post real clips"}
              </button>
            </div>
          </div>
        </div>
      )}

      {crm}
    </div>
  );
}
