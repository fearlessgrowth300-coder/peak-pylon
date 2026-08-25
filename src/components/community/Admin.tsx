import { useState, type ReactNode, type FormEvent } from "react";
import {
  readFileAsDataUrl,
  type Member,
  type State,
  type PostInput,
  type Stats,
  type Status,
} from "@/lib/community";
import { Avatar, Field, buttonClass, ghostButtonClass, inputClass } from "./Bits";

export function AdminView({
  state,
  addMember,
  removeMember,
  addPost,
  setStats,
  notify,
  crm,
}: {
  state: State;
  addMember: (m: Omit<Member, "id">) => void;
  removeMember: (id: string) => void;
  addPost: (post: PostInput) => void;
  setStats: (s: Stats) => void;
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
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

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
    addMember({ ...form, avatar, banner });
    setForm({ name: "", handle: "", link: "", bio: "", status: "online", platform: "Twitch" });
    setAvatarFile(null);
    setBannerFile(null);
    notify("Member added");
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

      <form onSubmit={submitMember} className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">01 · Add a member</h2>
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
          <input
            type="url"
            className={inputClass}
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            placeholder="https://twitch.tv/..."
          />
        </Field>
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
              {["Twitch", "YouTube", "TikTok", "Kick", "Other"].map((p) => (
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
        <button type="submit" className={`${buttonClass} w-full`}>
          Add member
        </button>
      </form>

      <form onSubmit={submitPost} className="space-y-3 rounded-xl bg-popover p-4">
        <h2 className="font-bold">02 · Publish a post</h2>
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
        <p className="rounded-md bg-background p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Transparency label is always on.</strong> Posts
          show “Community-managed post” so viewers know the owner published it.
        </p>
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
        <h2 className="font-bold">03 · Public stats</h2>
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
        <h2 className="font-bold">04 · Manage members</h2>
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
              <button
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
          ))}
        </div>
      </div>

      {crm}
    </div>
  );
}
