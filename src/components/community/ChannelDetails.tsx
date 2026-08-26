import { useMemo, useState } from "react";
import type { Member, Post } from "@/lib/community";
import { Avatar } from "./Bits";

type DetailTab = "Members" | "Media" | "Pins" | "Links" | "Files";

export function ChannelDetails({
  members,
  posts,
  onClose,
  onPickMember,
}: {
  members: Member[];
  posts: Post[];
  onClose: () => void;
  onPickMember: (member: Member) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("Members");
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const media = posts.filter((p) => p.image || p.video);
  const links = posts.filter((p) => /https?:\/\//i.test(p.text));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-0 sm:flex sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
      <section className="h-full w-full overflow-y-auto bg-background sm:h-auto sm:max-h-[88vh] sm:max-w-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-3xl">#</span><div><h2 className="text-xl font-extrabold">general</h2><p className="text-sm text-muted-foreground">Text channel · Stream-related discussion</p></div></div>
          <button onClick={onClose} aria-label="Close channel details" className="grid h-9 w-9 place-items-center rounded-full bg-accent text-lg">×</button>
        </header>
        <nav className="flex overflow-x-auto border-b border-border px-3">
          {(["Members", "Media", "Pins", "Links", "Files"] as DetailTab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-bold ${tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{item}</button>)}
        </nav>
        <div className="p-4">
          {tab === "Members" && <div className="space-y-2"><p className="text-sm font-semibold text-muted-foreground">Members — {members.length}</p>{members.map((m) => <button key={m.id} onClick={() => onPickMember(m)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent"><Avatar member={m} size={42} /><span className="min-w-0"><span className="block truncate font-semibold">{m.name}</span><span className="block truncate text-xs text-muted-foreground">{m.handle} · {m.status}</span></span></button>)}</div>}
          {tab === "Media" && <Gallery items={media} memberById={memberById} />}
          {tab === "Pins" && <Empty title="No pinned messages yet" detail="Pin an important announcement to make it appear here." />}
          {tab === "Links" && <div className="space-y-3">{links.length ? links.map((p) => <PostCard key={p.id} post={p} author={memberById.get(p.authorId)} />) : <Empty title="No shared links yet" detail="Links posted in #general will be collected here." />}</div>}
          {tab === "Files" && <Empty title="No files shared yet" detail="Images and videos are available in the Media tab." />}
        </div>
      </section>
    </div>
  );
}

function Gallery({ items, memberById }: { items: Post[]; memberById: Map<string, Member> }) {
  if (!items.length) return <Empty title="No media shared yet" detail="Images and videos from #general will appear here." />;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map((p) => <div key={p.id} className="overflow-hidden rounded-lg bg-accent"><div className="aspect-square bg-muted">{p.image ? <img src={p.image} alt={`Shared by ${memberById.get(p.authorId)?.name ?? "member"}`} className="h-full w-full object-cover" /> : <video src={p.video} className="h-full w-full object-cover" />}</div><p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{memberById.get(p.authorId)?.name ?? "Member"}</p></div>)}</div>;
}

function PostCard({ post, author }: { post: Post; author: Member | undefined }) { return <div className="rounded-xl bg-popover p-3"><p className="text-sm font-bold">{author?.name ?? "Member"}</p><p className="mt-1 break-words text-sm text-primary">{post.text.match(/https?:\/\/\S+/i)?.[0]}</p></div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl bg-popover p-6 text-center"><p className="font-bold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>; }
