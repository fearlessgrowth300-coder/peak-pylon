import { useMemo, useState } from "react";
import { AtSign, Bell, CheckCheck, MessageSquare, Radio, Users } from "lucide-react";
import { timeAgo, type Member, type Post } from "@/lib/community";
import { Avatar } from "./Bits";

type NotificationCategory = "all" | "mentions" | "social" | "community";

type RealNotification = {
  id: string;
  category: Exclude<NotificationCategory, "all">;
  actorId?: string;
  title: string;
  body: string;
  time: number;
  view: string;
};

export function NotificationsView({
  onNavigate,
  onPickMember,
  members,
  posts,
  currentUserId,
}: {
  onNavigate: (view: string, targetId?: string) => void;
  onPickMember?: (member: Member) => void;
  members: Member[];
  posts: Post[];
  currentUserId?: string | undefined;
  setToast?: (message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<NotificationCategory>("all");
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const notifications = useMemo<RealNotification[]>(() => {
    const items: RealNotification[] = [];
    const current = currentUserId ? memberById.get(currentUserId) : undefined;
    const handle = current?.handle?.replace(/^@/, "").toLowerCase();

    for (const member of members) {
      if (member.status !== "live") continue;
      items.push({
        id: `live-${member.id}`,
        category: "social",
        actorId: member.id,
        title: `${member.name} is live`,
        body: [member.gameName, member.viewerCount !== undefined ? `${member.viewerCount.toLocaleString()} viewers` : ""].filter(Boolean).join(" · ") || "Live on Twitch",
        time: Date.now(),
        view: "live-now",
      });
    }

    for (const post of posts) {
      const author = memberById.get(post.authorId);
      if (post.channel === "announcements" || post.channel === "trending") {
        items.push({
          id: `post-${post.id}`,
          category: "community",
          actorId: post.authorId,
          title: post.channel === "announcements" ? "New announcement" : "New trending post",
          body: post.text.split("\n")[0]?.slice(0, 160) || "Open post",
          time: post.time,
          view: post.channel,
        });
      }

      if (currentUserId && post.authorId === currentUserId) {
        for (const comment of post.comments ?? []) {
          if (comment.authorId === currentUserId) continue;
          const commenter = memberById.get(comment.authorId);
          items.push({
            id: `comment-${post.id}-${comment.id}`,
            category: "mentions",
            actorId: comment.authorId,
            title: `${commenter?.name ?? "A member"} commented on your post`,
            body: comment.text,
            time: comment.time,
            view: post.channel || "general",
          });
        }
      }

      if (handle && post.authorId !== currentUserId && post.text.toLowerCase().includes(`@${handle}`)) {
        items.push({
          id: `mention-${post.id}`,
          category: "mentions",
          actorId: post.authorId,
          title: `${author?.name ?? "A member"} mentioned you`,
          body: post.text.slice(0, 180),
          time: post.time,
          view: post.channel || "general",
        });
      }
    }

    return items.sort((left, right) => right.time - left.time).slice(0, 100);
  }, [currentUserId, memberById, members, posts]);

  const filtered = activeTab === "all" ? notifications : notifications.filter((item) => item.category === activeTab);
  const unread = notifications.filter((item) => !readIds.has(item.id)).length;
  const tabs: Array<{ id: NotificationCategory; label: string }> = [
    { id: "all", label: "All" },
    { id: "mentions", label: "Mentions" },
    { id: "social", label: "Live" },
    { id: "community", label: "Community" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400"><Bell className="h-4 w-4" />Real activity</p>
          <h1 className="mt-1 text-3xl font-black">Notifications</h1>
          <p className="mt-1 text-xs text-muted-foreground">Built from current live creators, Supabase posts, mentions and real comments.</p>
        </div>
        <button onClick={() => setReadIds(new Set(notifications.map((item) => item.id)))} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-accent">
          <CheckCheck className="h-4 w-4" /> Mark all read
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-3 py-2 text-xs font-bold ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
            {tab.label}{tab.id === "all" && unread ? ` (${unread})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((item) => {
          const actor = item.actorId ? memberById.get(item.actorId) : undefined;
          const isRead = readIds.has(item.id);
          const Icon = item.category === "social" ? Radio : item.category === "mentions" ? AtSign : Users;
          return (
            <button
              key={item.id}
              onClick={() => {
                setReadIds((current) => new Set(current).add(item.id));
                onNavigate(item.view, item.id);
              }}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:bg-accent/40 ${isRead ? "border-border bg-card/50" : "border-primary/40 bg-primary/5"}`}
            >
              {actor ? (
                <span onClick={(event) => { event.stopPropagation(); onPickMember?.(actor); }}><Avatar member={actor} size={42} /></span>
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent"><Icon className="h-4 w-4" /></span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <strong className="text-sm">{item.title}</strong>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(item.time)}</span>
                </span>
                <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>
              </span>
            </button>
          );
        })}
        {!filtered.length && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-bold">No real activity in this tab yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Notifications appear when creators go live or members post, mention and comment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
