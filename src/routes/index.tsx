import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { timeAgo, useCommunity, type Member, type PostInput } from "@/lib/community";
import { Composer } from "@/components/community/Composer";
import { Avatar, ghostButtonClass, statusColor } from "@/components/community/Bits";
import { ProfileModal } from "@/components/community/ProfileModal";
import { AdminView } from "@/components/community/Admin";
import { MembersCRM } from "@/components/community/MembersCRM";
import { ProfileEditor } from "@/components/community/ProfileEditor";
import { accountToMember, useAccounts, useSession, ROLE_META, type Role } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StreamCore — Discord-style Streamer Community" },
      {
        name: "description",
        content:
          "StreamCore is a Discord-style streamer community: creator directory, live status, profile cards and a community feed managed by the owner.",
      },
      { property: "og:title", content: "StreamCore — Streamer Community" },
      {
        property: "og:description",
        content:
          "Browse thousands of creator profiles, see who's live, and follow community announcements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type View = "general" | "creators" | "live-now" | "admin" | "me";

function Index() {
  const { state, addMember, removeMember, addPost, setStats } = useCommunity();
  const navigate = useNavigate();
  const { session } = useSession();
  const { accounts, refresh } = useAccounts();
  const [view, setView] = useState<View>("general");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profile, setProfile] = useState<Member | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [chatAuthor, setChatAuthor] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const userId = session?.user.id;
  const myAccount = useMemo(
    () => (userId ? (accounts.find((a) => a.id === userId) ?? null) : null),
    [userId, accounts],
  );
  const isAdmin = !!myAccount?.roles.includes("admin");

  const channels = useMemo(() => {
    const groups: { group: string; items: { id: View; label: string; icon: string }[] }[] = [
      {
        group: "Community",
        items: [
          { id: "general", label: "general", icon: "#" },
          { id: "creators", label: "creators", icon: "#" },
          { id: "live-now", label: "live-now", icon: "#" },
        ],
      },
    ];
    if (myAccount)
      groups.push({ group: "You", items: [{ id: "me", label: "my-profile", icon: "@" }] });
    groups.push({ group: "Owner", items: [{ id: "admin", label: "control-center", icon: "⚙" }] });
    return groups;
  }, [myAccount]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (view !== "general") return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view, state.posts.length]);

  const realMembers = useMemo(
    () => accounts.filter((a) => !a.is_banned).map(accountToMember),
    [accounts],
  );
  const allMembers = useMemo(
    () => [...realMembers, ...state.members],
    [realMembers, state.members],
  );

  const memberById = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers]);

  const filtered = allMembers.filter((m) =>
    `${m.name} ${m.handle} ${m.platform} ${m.bio}`.toLowerCase().includes(query.toLowerCase()),
  );
  const liveMembers = allMembers.filter((m) => m.status !== "offline");
  const online = allMembers.filter((m) => m.status !== "offline");
  const offline = allMembers.filter((m) => m.status === "offline");

  async function signOut() {
    await supabase.auth.signOut();
    setView("general");
    setToast("Signed out");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Server rail */}
      <nav className="hidden w-[72px] shrink-0 flex-col items-center gap-2 bg-rail py-3 sm:flex">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground">
          SC
        </div>
        <div className="h-0.5 w-8 rounded bg-border" />
        {["NR", "PM", "KV", "+"].map((s) => (
          <div
            key={s}
            className="grid h-12 w-12 place-items-center rounded-3xl bg-accent text-xs font-bold text-muted-foreground transition-all hover:rounded-2xl hover:bg-primary hover:text-primary-foreground"
          >
            {s}
          </div>
        ))}
      </nav>

      {/* Channel sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col bg-sidebar transition-transform md:static md:flex md:translate-x-0 ${
          sidebarOpen ? "flex translate-x-0" : "flex -translate-x-full"
        }`}
      >
        <div className="flex h-12 items-center justify-between border-b border-rail px-4 shadow-sm">
          <strong className="truncate text-[15px]">StreamCore</strong>
          <span className="h-2 w-2 shrink-0 rounded-full bg-online" />
        </div>

        <div className="p-3">
          <button
            onClick={() => setToast("Invite link copied")}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold hover:bg-accent/70"
          >
            Invite
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {CHANNELS.map((group) => (
            <div key={group.group} className="mb-3">
              <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {group.group}
              </p>
              {group.items.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setView(c.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[15px] transition-colors ${
                    view === c.id
                      ? "bg-accent font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <span className="text-lg text-muted-foreground">{c.icon}</span>
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-rail px-3 py-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            OW
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Community Owner</p>
            <p className="truncate text-xs text-muted-foreground">Full control</p>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="grid h-12 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-rail bg-background px-3 shadow-sm">
          <button
            className="text-xl text-muted-foreground md:hidden"
            aria-label="Open channels"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xl text-muted-foreground">#</span>
            <strong className="truncate">{view === "admin" ? "control-center" : view}</strong>
          </div>
          <button
            className="text-lg text-muted-foreground"
            aria-label="Show members"
            onClick={() => setMembersOpen((v) => !v)}
          >
            ◉
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
            {view === "general" && (
              <div className="space-y-4 px-4 py-5">
                <section className="rounded-xl bg-popover p-5">
                  <p className="inline-block rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                    The home of streamers
                  </p>
                  <h1 className="mt-3 text-3xl font-extrabold leading-tight">
                    One community.
                    <br />
                    Every creator.
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A showcase community for streamers, creators, teams, and fans.
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat value={state.stats.members} label="Members" />
                    <Stat value={state.stats.online} label="Online" dot />
                    <Stat value={state.stats.rank} label="Rank by size" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => setView("creators")}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
                    >
                      Explore creators
                    </button>
                    <button onClick={() => setView("admin")} className={ghostButtonClass}>
                      Owner controls
                    </button>
                  </div>
                </section>

                <p className="rounded-md bg-primary/10 p-3 text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Community-managed demo.</strong> Creator
                  profiles can link to real channels, but posts are labeled so visitors know
                  they were published by the community owner.
                </p>

                <div className="space-y-0.5">
                  {[...state.posts]
                    .sort((a, b) => a.time - b.time)
                    .map((p) => {
                      const m = memberById.get(p.authorId);
                      const parent = p.replyToId
                        ? state.posts.find((x) => x.id === p.replyToId)
                        : undefined;
                      const parentAuthor = parent
                        ? memberById.get(parent.authorId)
                        : undefined;
                      return (
                        <article
                          key={p.id}
                          className="group rounded-md px-1 py-2 hover:bg-accent/25"
                        >
                          {parent && (
                            <div className="mb-1 flex min-w-0 items-center gap-2 pl-12 text-xs text-muted-foreground">
                              <span>↰</span>
                              <span className="truncate">
                                <strong className="text-primary">
                                  {parentAuthor?.name ?? "Community"}
                                </strong>{" "}
                                {parent.text || parent.sticker || "attachment"}
                              </span>
                            </div>
                          )}
                          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                            <button onClick={() => m && setProfile(m)}>
                              <Avatar
                                member={
                                  m ?? { name: "Community", avatar: "", status: "offline" }
                                }
                                size={40}
                                showStatus={false}
                              />
                            </button>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <button
                                  onClick={() => m && setProfile(m)}
                                  className="font-semibold hover:underline"
                                >
                                  {m?.name ?? "Community"}
                                </button>
                                <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                                  COMMUNITY-MANAGED POST
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {timeAgo(p.time)}
                                </span>
                                <button
                                  onClick={() =>
                                    setReplyTo({ id: p.id, name: m?.name ?? "Community" })
                                  }
                                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                >
                                  Reply
                                </button>
                              </div>
                              {p.text && (
                                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
                                  {p.text}
                                </p>
                              )}
                              {p.sticker && (
                                <p className="mt-1 text-5xl leading-none">{p.sticker}</p>
                              )}
                              {p.image && (
                                <img
                                  src={p.image}
                                  alt="Community post attachment"
                                  loading="lazy"
                                  className="mt-2 max-h-80 rounded-lg object-cover"
                                />
                              )}
                              {p.video && (
                                <video
                                  src={p.video}
                                  controls
                                  className="mt-2 max-h-80 w-full rounded-lg"
                                />
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </div>
            )}

            {(view === "creators" || view === "live-now") && (
              <div className="space-y-4 px-4 py-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Creator directory
                  </p>
                  <h1 className="text-xl font-extrabold">
                    {view === "live-now" ? "Live & online now" : "Meet the community"}
                  </h1>
                </div>
                {view === "creators" && (
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search creators"
                    className="w-full rounded-md bg-input px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                )}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(view === "live-now" ? liveMembers : filtered).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setProfile(m)}
                      className="overflow-hidden rounded-xl bg-popover text-left transition-colors hover:bg-accent/40"
                    >
                      <div
                        className="h-16 bg-primary/50 bg-cover bg-center"
                        style={m.banner ? { backgroundImage: `url(${m.banner})` } : undefined}
                      />
                      <div className="-mt-6 p-4">
                        <div className="w-fit rounded-full border-4 border-popover">
                          <Avatar member={m} size={48} />
                        </div>
                        <p className="mt-2 truncate font-bold">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.handle}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {m.bio || "Community creator profile."}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="rounded bg-accent px-2 py-1 font-semibold">
                            {m.platform}
                          </span>
                          <span className="text-muted-foreground">Open profile →</span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {(view === "live-now" ? liveMembers : filtered).length === 0 && (
                    <p className="text-sm text-muted-foreground">No creators found.</p>
                  )}
                </div>
              </div>
            )}

            {view === "admin" && (
              <AdminView
                state={state}
                addMember={addMember}
                removeMember={removeMember}
                addPost={addPost}
                setStats={setStats}
                notify={setToast}
              />
            )}
          </div>
          {view === "general" && (
            <Composer
              authors={state.members}
              authorId={chatAuthor || state.members[0]?.id || ""}
              setAuthorId={setChatAuthor}
              replyTo={replyTo}
              clearReply={() => setReplyTo(null)}
              onSend={(post: PostInput) => addPost(post)}
            />
          )}
          </div>

          {/* Member list */}
          <aside
            className={`${membersOpen ? "block" : "hidden"} w-60 shrink-0 overflow-y-auto bg-sidebar p-3 max-md:fixed max-md:inset-y-12 max-md:right-0 max-md:z-40 max-md:w-64 max-md:shadow-elevated`}
          >
            <button
              onClick={() => setToast("Approval request sent to the owner")}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
            >
              Get your channel approved
            </button>
            <button
              onClick={() => setToast("Invite link copied")}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold hover:bg-accent/70"
            >
              + Invite members
            </button>

            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Admin — 1
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                OW
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                Community Owner
              </span>
              <span className="shrink-0 text-xs">👑</span>
            </div>

            <MemberGroup title={`Online — ${online.length}`} list={online} onPick={setProfile} />
            <MemberGroup
              title={`Offline — ${offline.length}`}
              list={offline}
              onPick={setProfile}
              dim
            />
          </aside>
        </div>
      </main>

      <ProfileModal member={profile} onClose={() => setProfile(null)} />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-popover px-4 py-2 text-sm font-semibold shadow-elevated">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, dot }: { value: string; label: string; dot?: boolean }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <p className="flex items-center justify-center gap-1.5 text-lg font-extrabold">
        {dot && <span className="h-2 w-2 rounded-full bg-online" />}
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function MemberGroup({
  title,
  list,
  onPick,
  dim,
}: {
  title: string;
  list: Member[];
  onPick: (m: Member) => void;
  dim?: boolean;
}) {
  if (!list.length) return null;
  return (
    <div className="mb-4">
      <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {list.map((m) => (
        <button
          key={m.id}
          onClick={() => onPick(m)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 ${dim ? "opacity-50" : ""}`}
        >
          <Avatar member={m} size={32} />
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {m.name}
          </span>
          {m.status === "live" && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor(m.status)}`} />
          )}
        </button>
      ))}
    </div>
  );
}
