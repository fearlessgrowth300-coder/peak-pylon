import { useMemo, useState } from "react";
import { Gem, MessageSquare, Plus, Radio, Search, Send, X } from "lucide-react";
import { timeAgo, type Member, type Post, type PostInput } from "@/lib/community";
import { Avatar } from "./Bits";
import { BrandIcon } from "./BrandIcon";

type LoungeTag = "Discussion" | "Announcement" | "Opportunity" | "Event" | "Resource";

function parseLoungePost(post: Post) {
  const firstLine = post.text.split("\n")[0] ?? "";
  const tagMatch = firstLine.match(/^\[([^\]]+)\]\s*(.*)$/);
  return {
    tag: (tagMatch?.[1] || "Discussion") as LoungeTag,
    title: tagMatch?.[2] || firstLine || "Partner discussion",
    content: post.text.split("\n").slice(1).join("\n").trim(),
  };
}

export function PartnersView({
  members,
  posts,
  onPick,
  isAdmin,
  currentUserId,
  onCreate,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  isAdmin?: boolean;
  currentUserId?: string | undefined;
  setToast?: (message: string) => void;
  onSendMessage?: (member: Member) => void;
  onCreate: (post: PostInput) => Promise<void>;
}) {
  const [tab, setTab] = useState<"directory" | "lounge">("directory");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [tag, setTag] = useState<LoungeTag>("Discussion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const partners = useMemo(
    () => members.filter((member) => member.role === "partner").sort((left, right) => (right.followers ?? 0) - (left.followers ?? 0)),
    [members],
  );
  const partnerIds = useMemo(() => new Set(partners.map((member) => member.id)), [partners]);
  const loungePosts = useMemo(
    () => posts.filter((post) => post.channel === "partners" && (partnerIds.has(post.authorId) || isAdmin)).sort((left, right) => right.time - left.time),
    [isAdmin, partnerIds, posts],
  );
  const currentMember = members.find((member) => member.id === currentUserId);
  const canPost = Boolean(isAdmin || currentMember?.role === "partner");
  const filtered = partners.filter((member) => {
    const query = search.trim().toLowerCase();
    return !query || [member.name, member.handle, member.bio, member.gameName].some((value) => value?.toLowerCase().includes(query));
  });

  async function publish() {
    if (!currentMember || !title.trim() || !content.trim()) return;
    setBusy(true);
    try {
      await onCreate({
        authorId: currentMember.id,
        channel: "partners",
        text: `[${tag}] ${title.trim()}\n\n${content.trim()}`,
      });
      setTitle("");
      setContent("");
      setTag("Discussion");
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-card to-cyan-950/20 p-6">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-400"><Gem className="h-4 w-4" />Verified database roles</p>
        <h1 className="mt-1 text-3xl font-black">StreamCore Partners</h1>
        <p className="mt-2 text-sm text-muted-foreground">{partners.length} member{partners.length === 1 ? "" : "s"} currently have the partner role in Supabase.</p>
      </header>

      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button onClick={() => setTab("directory")} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === "directory" ? "bg-cyan-500 text-black" : "bg-card"}`}>Partner directory</button>
          <button onClick={() => setTab("lounge")} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === "lounge" ? "bg-cyan-500 text-black" : "bg-card"}`}>Partner lounge</button>
        </div>
        {tab === "directory" ? (
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search real partners" className="rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none" />
          </label>
        ) : canPost ? (
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-black"><Plus className="h-4 w-4" />New discussion</button>
        ) : null}
      </div>

      {tab === "directory" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <button key={member.id} onClick={() => onPick(member)} className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-card text-left hover:border-cyan-500/50">
              <div className="h-24 bg-accent bg-cover bg-center" style={member.banner ? { backgroundImage: `url(${member.banner})` } : undefined} />
              <div className="-mt-7 p-4">
                <Avatar member={member} size={56} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0"><h2 className="truncate font-black">{member.name}</h2><p className="truncate text-xs text-muted-foreground">{member.handle}</p></div>
                  {member.status === "live" && <Radio className="h-4 w-4 text-live" />}
                </div>
                <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{member.bio || "No biography supplied."}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><BrandIcon platform={member.platform} size={13} />{member.platform}</span>
                  <span>{member.followers?.toLocaleString() ?? "Not synced"} followers</span>
                  {member.gameName && <span>{member.gameName}</span>}
                </div>
              </div>
            </button>
          ))}
          {!filtered.length && <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No members currently have a real partner role.</div>}
        </div>
      )}

      {tab === "lounge" && (
        <div className="space-y-3">
          {loungePosts.map((post) => {
            const author = members.find((member) => member.id === post.authorId);
            const parsed = parseLoungePost(post);
            return (
              <article key={post.id} className="rounded-2xl border border-cyan-500/20 bg-card p-5">
                <div className="flex items-center gap-3">
                  {author && <Avatar member={author} size={40} />}
                  <div><strong className="text-sm">{author?.name ?? "StreamCore Admin"}</strong><p className="text-[11px] text-muted-foreground">{timeAgo(post.time)}</p></div>
                  <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-1 text-[10px] font-black text-cyan-300">{parsed.tag}</span>
                </div>
                <h3 className="mt-4 font-black">{parsed.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{parsed.content}</p>
                <div className="mt-4 flex gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{post.comments?.length ?? 0} comments</span>
                  <span>{post.likes?.length ?? 0} likes</span>
                  <span>{post.shares ?? 0} shares</span>
                </div>
              </article>
            );
          })}
          {!loungePosts.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No real partner discussions have been posted yet.</div>}
        </div>
      )}

      {modalOpen && currentMember && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-popover p-6">
            <div className="flex items-center justify-between"><h2 className="font-black">Post to Partner Lounge</h2><button onClick={() => setModalOpen(false)}><X className="h-4 w-4" /></button></div>
            <select value={tag} onChange={(event) => setTag(event.target.value as LoungeTag)} className="w-full rounded-xl border border-border bg-input p-3 text-sm">
              {["Discussion", "Announcement", "Opportunity", "Event", "Resource"].map((value) => <option key={value}>{value}</option>)}
            </select>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Discussion title" className="w-full rounded-xl border border-border bg-input p-3 text-sm" />
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} placeholder="Write the real details…" className="w-full rounded-xl border border-border bg-input p-3 text-sm" />
            <button disabled={busy || !title.trim() || !content.trim()} onClick={() => void publish()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 p-3 text-sm font-black text-black disabled:opacity-50"><Send className="h-4 w-4" />{busy ? "Publishing…" : "Publish"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
