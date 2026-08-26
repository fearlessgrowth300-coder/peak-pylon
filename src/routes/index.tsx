import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { timeAgo, useCommunity, type Member, type Post, type PostInput } from "@/lib/community";
import { Composer } from "@/components/community/Composer";
import { Avatar, ghostButtonClass, statusColor } from "@/components/community/Bits";
import { ProfileModal } from "@/components/community/ProfileModal";
import { ChannelDetails } from "@/components/community/ChannelDetails";
import { AdminView } from "@/components/community/Admin";
import { MembersCRM } from "@/components/community/MembersCRM";
import { ProfileEditor } from "@/components/community/ProfileEditor";
import { accountToMember, removeFromCommunity, useAccounts, useSession, ROLE_META, topRole } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";
import { refreshTwitchStatuses } from "@/lib/twitch.functions";

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

type View = "rules" | "general" | "creators" | "live-now" | "admin" | "me" | `channel:${string}`;

function Index() {
  const { state, addMember, updateMember, removeMember, addPost, removePost, setStats, setCommunity, addChannel, removeChannel, toggleReaction } = useCommunity();
  const navigate = useNavigate();
  const { session } = useSession();
  const { accounts, refresh } = useAccounts();
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "general";
    const saved = localStorage.getItem("streamcore:last-view") as View | null;
    return saved && (saved === "rules" || saved === "general" || saved === "creators" || saved === "live-now" || saved === "admin" || saved === "me" || saved.startsWith("channel:")) ? saved : "general";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [channelDetailsOpen, setChannelDetailsOpen] = useState(false);
  const [profile, setProfile] = useState<Member | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [chatAuthor, setChatAuthor] = useState("");
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userId = session?.user.id;
  const myAccount = useMemo(
    () => (userId ? (accounts.find((a) => a.id === userId) ?? null) : null),
    [userId, accounts],
  );
  const isAdmin = !!myAccount?.roles.includes("admin");

  // A real signed-in account always posts as itself. Only the owner may select
  // one of the community-managed showcase profiles for an editorial post.
  const postingAuthors = useMemo(() => {
    if (!myAccount) return [];
    const ownerProfile = accountToMember(myAccount);
    return isAdmin ? [ownerProfile, ...state.members] : [ownerProfile];
  }, [isAdmin, myAccount, state.members]);
  const selectedChatAuthor = postingAuthors.some((member) => member.id === chatAuthor)
    ? chatAuthor
    : (postingAuthors[0]?.id ?? "");

  useEffect(() => {
    const channel = supabase.channel("streamcore-typing");
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.userId !== userId) setTypingName(payload?.typing ? payload.name : null);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  function broadcastTyping(typing: boolean) {
    const author = postingAuthors.find((member) => member.id === selectedChatAuthor);
    if (!author || !userId) return;
    void supabase.channel("streamcore-typing").send({ type: "broadcast", event: "typing", payload: { userId, name: author.name, typing } });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (typing) typingTimer.current = window.setTimeout(() => broadcastTyping(false), 2500);
  }

  useEffect(() => {
    if (!userId) return;
    const heartbeat = () => void supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userId).then(() => void refresh());
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, userId]);

  const channels = useMemo(() => {
    const groups: { group: string; items: { id: View; label: string; icon: string }[] }[] = [
      {
        group: "Community",
        items: [
          { id: "rules", label: "rules", icon: "#" },
          { id: "general", label: "general", icon: "#" },
          { id: "creators", label: "creators", icon: "#" },
          { id: "live-now", label: "live-now", icon: "#" },
          ...state.channels.filter((channel) => channel.id !== "rules").map((channel) => ({ id: `channel:${channel.id}` as View, label: channel.name, icon: "#" })),
        ],
      },
    ];
    if (myAccount)
      groups.push({ group: "You", items: [{ id: "me", label: "my-profile", icon: "@" }] });
    if (isAdmin) {
      groups.push({ group: "Owner", items: [{ id: "admin", label: "control-center", icon: "⚙" }] });
    }
    return groups;
  }, [isAdmin, myAccount, state.channels]);

  useEffect(() => {
    if (localStorage.getItem("streamcore:open-rules") === "1") {
      localStorage.removeItem("streamcore:open-rules");
      setView("rules");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("streamcore:last-view", view);
  }, [view]);

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
  const adminMembers = allMembers.filter((m) => m.role === "admin");
  const online = allMembers.filter((m) => m.status !== "offline" && m.role !== "admin");
  const offline = allMembers.filter((m) => m.status === "offline" && m.role !== "admin");

  useEffect(() => {
    const twitchMembers = allMembers.filter((member) => member.platform === "Twitch" && member.link);
    if (!twitchMembers.length) return;
    let active = true;
    const refreshTwitch = async () => {
      try {
        const updates = await refreshTwitchStatuses({ data: { channels: twitchMembers.map((member) => ({ id: member.id, channelUrl: member.link })) } });
        if (!active) return;
        let realProfileChanged = false;
        updates.forEach((update) => {
          const member = twitchMembers.find((item) => item.id === update.id);
          if (!member) return;
          const nextStatus = update.status === "live" ? "live" : member.manualStatus ?? "offline";
          if (member.status === nextStatus && (!update.banner || member.banner === update.banner)) return;
          const realAccount = accounts.find((account) => account.id === member.id);
          if (realAccount) {
            realProfileChanged = true;
            void supabase.from("profiles").update({ status: update.status, ...(update.banner ? { banner_url: update.banner } : {}) }).eq("id", realAccount.id);
          } else updateMember(member.id, { status: nextStatus, ...(update.banner ? { banner: update.banner } : {}) });
        });
        if (realProfileChanged) void refresh();
      } catch { /* Keep the last known status if Twitch is temporarily unavailable. */ }
    };
    void refreshTwitch();
    const timer = window.setInterval(() => void refreshTwitch(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accounts, allMembers, refresh, state.members, updateMember]);

  async function signOut() {
    await supabase.auth.signOut();
    setView("general");
    setToast("Signed out");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Server rail */}
      <nav className="hidden w-[72px] shrink-0 flex-col items-center gap-2 bg-rail py-3 sm:flex">
        <CommunityMark community={state.community} size={48} />
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
          <div className="flex min-w-0 items-center gap-2"><CommunityMark community={state.community} size={26} /><strong className="truncate text-[15px]">{state.community.name}</strong></div>
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
          {channels.map((group) => (
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

        {myAccount ? (
          <button
            onClick={() => {
              setView("me");
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-2 bg-rail px-3 py-2 text-left hover:bg-rail/70"
          >
            <Avatar member={accountToMember(myAccount)} size={32} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{myAccount.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ROLE_META[topRole(myAccount.roles)].label}
              </p>
            </div>
          </button>
        ) : (
          <button
            onClick={() => void navigate({ to: "/auth" })}
            className="m-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
          >
            Sign in / Join community
          </button>
        )}
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
          <button onClick={() => view === "general" && setChannelDetailsOpen(true)} className="flex min-w-0 items-center gap-1.5 text-left disabled:cursor-default" disabled={view !== "general"} title={view === "general" ? "Open channel details" : undefined}>
            <span className="text-xl text-muted-foreground">#</span>
            <strong className="truncate">
               {view === "admin" ? "control-center" : view === "me" ? "my-profile" : view.startsWith("channel:") ? state.channels.find((channel) => `channel:${channel.id}` === view)?.name ?? "channel" : view}
            </strong>
          </button>
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
                <section
                  className="relative overflow-hidden rounded-xl bg-popover bg-cover bg-center p-5"
                  style={state.community.banner ? { backgroundImage: `linear-gradient(rgba(24,25,28,.72), rgba(24,25,28,.88)), url(${state.community.banner})` } : undefined}
                >
                  <div className="relative z-10">
                  <p className="inline-block rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                    {state.community.tagline}
                  </p>
                  <h1 className="mt-3 text-3xl font-extrabold leading-tight">
                    {state.community.name}.
                    <br />
                    Every creator.
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A community for streamers, creators, teams, and fans.
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat value={state.stats.members} label="Members" logo={state.community.logo} />
                    <Stat value={state.stats.online} label="Online" dot />
                    <Stat value={state.stats.rank} label="Rank by size" />
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    <strong className="text-foreground">
                      {realMembers.length.toLocaleString()}
                    </strong>{" "}
                    verified streamer accounts have joined with a real login.
                  </p>
                  </div>
                </section>

                <LiveStories members={liveMembers.filter((member) => member.status === "live")} onPick={setProfile} />

                <div className="space-y-0.5">
                  {[...state.posts.filter((post) => !post.channel || post.channel === "general")]
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
                                {m?.role === "admin" && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">👑 ADMIN</span>}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(p.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
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
                              <MessageActions post={p} member={m} isAdmin={isAdmin} onReply={() => setReplyTo({ id: p.id, name: m?.name ?? "Community" })} onReact={toggleReaction} onDelete={removePost} onRemoveMember={async () => { if (m?.real) await removeFromCommunity(m.id); else if (m) await removeMember(m.id); }} />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </div>
            )}

            {view === "rules" && <RulesChannel rules={state.community.rules} onContinue={() => setView("general")} />}

            {view.startsWith("channel:") && (() => {
              const channel = state.channels.find((item) => `channel:${item.id}` === view);
              return channel ? <CustomChannel name={channel.name} topic={channel.topic} posts={state.posts.filter((post) => post.channel === channel.id || post.channel === channel.name)} members={memberById} onReply={(post) => setReplyTo({ id: post.id, name: memberById.get(post.authorId)?.name ?? "Community" })} onReact={toggleReaction} /> : null;
            })()}

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

            {view === "me" && myAccount && (
              <ProfileEditor
                account={myAccount}
                refresh={refresh}
                notify={setToast}
                onSignOut={() => void signOut()}
              />
            )}

            {view === "admin" && isAdmin && (
              <AdminView
                state={state}
                addMember={addMember}
                removeMember={removeMember}
                addPost={addPost}
                setStats={setStats}
                setCommunity={setCommunity}
                updateMember={updateMember}
                notify={setToast}
                addChannel={addChannel}
                removeChannel={removeChannel}
                crm={
                  <MembersCRM
                    accounts={accounts}
                    isAdmin={isAdmin}
                    refresh={refresh}
                    notify={setToast}
                  />
                }
              />
            )}
          </div>
          {view === "general" && (
            <Composer
              authors={postingAuthors}
              authorId={selectedChatAuthor}
              setAuthorId={setChatAuthor}
              replyTo={replyTo}
              clearReply={() => setReplyTo(null)}
              onSend={(post: PostInput) => addPost(post)}
              onTyping={broadcastTyping}
            />
          )}
          {view.startsWith("channel:") && (() => { const channel = state.channels.find((item) => `channel:${item.id}` === view); return channel?.allowChat && postingAuthors.length ? <Composer authors={postingAuthors} authorId={selectedChatAuthor} setAuthorId={setChatAuthor} replyTo={replyTo} clearReply={() => setReplyTo(null)} onSend={(post: PostInput) => addPost({ ...post, channel: channel.name })} onTyping={broadcastTyping} channel={channel.name} /> : null; })()}
          {typingName && <div className="pointer-events-none absolute bottom-16 left-4 text-xs text-muted-foreground"><strong>{typingName}</strong> is typing…</div>}
          </div>

          {/* Member list */}
          <aside
            className={`${membersOpen ? "block" : "hidden"} w-60 shrink-0 overflow-y-auto bg-sidebar p-3 max-md:fixed max-md:inset-y-12 max-md:right-0 max-md:z-40 max-md:w-64 max-md:shadow-elevated`}
          >
            <button
              onClick={() =>
                myAccount ? setView("me") : void navigate({ to: "/auth" })
              }
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
            >
              {myAccount ? "Manage your channel" : "Get your channel approved"}
            </button>
            <button
              onClick={() => setToast("Invite link copied")}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold hover:bg-accent/70"
            >
              + Invite members
            </button>

            <MemberGroup title={`Admin — ${adminMembers.length}`} list={adminMembers} onPick={setProfile} admin />
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

      <ProfileModal member={profile} onClose={() => setProfile(null)} isAdmin={isAdmin} />
      {channelDetailsOpen && <ChannelDetails members={allMembers} posts={state.posts} onClose={() => setChannelDetailsOpen(false)} onPickMember={(member) => { setChannelDetailsOpen(false); setProfile(member); }} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-popover px-4 py-2 text-sm font-semibold shadow-elevated">
          {toast}
        </div>
      )}
    </div>
  );
}

function MessageActions({ post, member, isAdmin, onReply, onReact, onDelete, onRemoveMember }: { post: Post; member?: Member; isAdmin: boolean; onReply: () => void; onReact: (id: string, emoji: string) => void; onDelete: (id: string) => Promise<void>; onRemoveMember: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const hold = useRef<number | null>(null);
  const start = () => { hold.current = window.setTimeout(() => setOpen(true), 550); };
  const cancel = () => { if (hold.current) window.clearTimeout(hold.current); };
  return <div className="relative mt-2" onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onContextMenu={(event) => { event.preventDefault(); setOpen(true); }}>
    {open && <div className="absolute bottom-7 left-0 z-20 flex items-center gap-1 rounded-lg bg-popover p-1 shadow-elevated">
      {[["👍", "Like"], ["❤️", "Love"], ["😂", "Laugh"], ["😮", "Wow"], ["😢", "Sad"], ["😡", "Angry"]].map(([emoji, label]) => <button key={emoji} title={label} onClick={() => { onReact(post.id, emoji); setOpen(false); }} className="rounded px-2 py-1 text-lg hover:bg-accent">{emoji}</button>)}
      <button onClick={() => { onReply(); setOpen(false); }} className="rounded px-2 py-1 text-xs font-semibold hover:bg-accent">Reply</button>
      {isAdmin && <><button onClick={() => void onDelete(post.id).then(() => setOpen(false))} className="rounded px-2 py-1 text-xs font-semibold text-destructive hover:bg-accent">Delete</button>{member?.role !== "admin" && <button onClick={() => void onRemoveMember().then(() => setOpen(false))} className="rounded px-2 py-1 text-xs font-semibold text-destructive hover:bg-accent">Remove member</button>}</>}
    </div>}
    {Object.entries(post.reactions ?? {}).filter(([, count]) => count > 0).map(([emoji, count]) => <span key={emoji} className="mr-1 rounded bg-accent px-2 py-1 text-xs">{emoji} {count}</span>)}
  </div>;
}

function CommunityMark({ community, size }: { community: { name: string; logo: string }; size: number }) {
  return <div className="grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-xs font-extrabold text-primary-foreground" style={{ width: size, height: size }}>{community.logo ? <img src={community.logo} alt={`${community.name} logo`} className="h-full w-full object-cover" /> : community.name.slice(0, 2).toUpperCase()}</div>;
}

function RulesChannel({ rules, onContinue }: { rules: string; onContinue: () => void }) {
  return <div className="mx-auto max-w-2xl space-y-4 px-4 py-8"><section className="rounded-xl bg-popover p-6"><span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-3xl text-muted-foreground">#</span><h1 className="mt-4 text-2xl font-extrabold">Welcome to #rules!</h1><p className="mt-2 text-sm text-muted-foreground">Please read these rules before taking part in the community.</p></section><section className="space-y-3 rounded-xl bg-popover p-5"><h2 className="font-bold">Community rules</h2><ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">{rules.split("\n").filter(Boolean).map((rule) => <li key={rule}>{rule}</li>)}</ol><button onClick={onContinue} className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85">I have read the rules — Continue to #general</button></section></div>;
}

function CustomChannel({ name, topic, posts, members, onReply, onReact }: { name: string; topic: string; posts: Post[]; members: Map<string, Member>; onReply: (post: { id: string; authorId: string }) => void; onReact: (id: string, emoji: string) => void }) {
  return <div className="mx-auto max-w-2xl space-y-3 px-4 py-6"><section className="rounded-xl bg-popover p-5"><span className="text-3xl text-muted-foreground">#</span><h1 className="mt-2 text-2xl font-extrabold">Welcome to #{name}!</h1><p className="mt-1 text-sm text-muted-foreground">{topic}</p></section>{posts.map((post) => { const member = members.get(post.authorId); return <article key={post.id} className="rounded-lg px-2 py-3 hover:bg-accent/20"><div className="flex gap-3"><Avatar member={member ?? { name: "Community", avatar: "", status: "offline" }} size={36} showStatus={false} /><div className="min-w-0"><p className="text-sm font-semibold">{member?.name ?? "Community"} <span className="ml-1 text-xs font-normal text-muted-foreground">{post.time ? new Date(post.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</span></p>{post.text && <p className="mt-1 whitespace-pre-wrap text-sm">{post.text}</p>}{post.sticker && <p className="mt-1 text-4xl">{post.sticker}</p>}{post.image && <img src={post.image} alt="Channel attachment" className="mt-2 max-h-80 rounded-lg" />}<MessageActions post={post} member={member} isAdmin={false} onReact={onReact} onReply={() => onReply({ id: post.id, authorId: post.authorId })} onDelete={async () => {}} onRemoveMember={async () => {}} /></div></div></article>; })}</div>;
}

function LiveStories({ members, onPick }: { members: Member[]; onPick: (member: Member) => void }) {
  if (!members.length) return null;
  return <section className="rounded-xl bg-popover p-3"><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-live">Live now</p><div className="flex gap-3 overflow-x-auto pb-1">{members.map((member) => <button key={member.id} onClick={() => onPick(member)} className="group flex w-16 shrink-0 flex-col items-center gap-1"><span className="relative rounded-full border-2 border-live p-0.5"><Avatar member={member} size={50} showStatus={false} /><span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-live px-1 text-[8px] font-extrabold text-white">LIVE</span></span><span className="w-full truncate pt-1 text-xs font-semibold group-hover:underline">{member.name}</span></button>)}</div></section>;
}

function Stat({ value, label, dot, logo }: { value: string; label: string; dot?: boolean; logo?: string }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <p className="flex items-center justify-center gap-1.5 text-lg font-extrabold">
        {dot && <span className="h-2 w-2 rounded-full bg-online" />}
        {logo && <img src={logo} alt="" className="h-5 w-5 rounded-full object-cover" />}
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
  admin,
}: {
  title: string;
  list: Member[];
  onPick: (m: Member) => void;
  dim?: boolean;
  admin?: boolean;
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
          {admin && <span className="shrink-0 text-xs" title="Community admin">👑</span>}
        </button>
      ))}
    </div>
  );
}
