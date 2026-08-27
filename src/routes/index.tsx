import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { timeAgo, useCommunity, type Member, type Post, type PostInput } from "@/lib/community";
import { Composer } from "@/components/community/Composer";
import { Avatar, ghostButtonClass, statusColor } from "@/components/community/Bits";
import { ProfileModal } from "@/components/community/ProfileModal";
import { ChannelDetails } from "@/components/community/ChannelDetails";
import { AdminView } from "@/components/community/Admin";
import { MembersCRM } from "@/components/community/MembersCRM";
import { ProfileEditor } from "@/components/community/ProfileEditor";
import { HomeDashboard } from "@/components/community/HomeDashboard";
import { RightStatsPanel } from "@/components/community/RightStatsPanel";
import { TrendingView } from "@/components/community/TrendingView";
import { LiveNowView } from "@/components/community/LiveNowView";
import { ClipsView } from "@/components/community/ClipsView";
import { accountToMember, removeFromCommunity, useAccounts, useSession, ROLE_META, topRole } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";
import { refreshTwitchStatuses } from "@/lib/twitch.functions";
import {
  Home as HomeIcon,
  Flame,
  Tv,
  Film,
  MessageSquare,
  HelpCircle,
  UserCheck,
  Coffee,
  Link2,
  Headphones,
  Users,
  Trophy,
  Star,
  Zap,
  Gem,
  Calendar,
  Megaphone,
  User as UserIcon,
  BarChart3,
  Bell,
  Mail,
  Compass,
  Shield,
  Puzzle,
  Search,
  Settings,
  ChevronDown,
  Plus,
  Disc,
  CreditCard,
  Menu,
  Moon,
  Sparkles,
} from "lucide-react";

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

type View =
  | "home"
  | "rules"
  | "general"
  | "support"
  | "intro"
  | "off-topic"
  | "collab"
  | "vc-lounge"
  | "creators"
  | "live-now"
  | "clips"
  | "trending"
  | "rankings"
  | "announcements"
  | "featured"
  | "rising"
  | "partners"
  | "events"
  | "analytics"
  | "notifications"
  | "messages"
  | "admin"
  | "moderation"
  | "integrations"
  | "me"
  | `channel:${string}`;

interface NavItem {
  id: View;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

interface NavGroup {
  group?: string;
  items: NavItem[];
}

function Index() {
  const { state, addMember, updateMember, removeMember, addPost, removePost, setStats, setCommunity, addChannel, removeChannel, toggleReaction } = useCommunity();
  const navigate = useNavigate();
  const { session } = useSession();
  const { accounts, refresh } = useAccounts();
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "home";
    const saved = localStorage.getItem("streamcore:last-view") as View | null;
    const migrated = (saved as string | null) === "general" ? ("home" as View) : saved;
    return migrated && (migrated === "home" || migrated === "rules" || migrated === "general" || migrated === "creators" || migrated === "live-now" || migrated === "clips" || migrated === "trending" || migrated === "rankings" || migrated === "announcements" || migrated === "featured" || migrated === "rising" || migrated === "partners" || migrated === "events" || migrated === "analytics" || migrated === "notifications" || migrated === "messages" || migrated === "admin" || migrated === "moderation" || migrated === "integrations" || migrated === "me" || migrated.startsWith("channel:")) ? migrated : "home";
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

  // Sidebar navigation structure matching the exact reference screenshot
  const navSections = useMemo((): NavGroup[] => {
    return [
      {
        items: [
          { id: "home", label: "Home", icon: <HomeIcon className="h-4 w-4" /> },
          { id: "trending", label: "Trending", icon: <Flame className="h-4 w-4" /> },
          { id: "live-now", label: "Live Now", icon: <Tv className="h-4 w-4" />, badge: "LIVE", badgeColor: "bg-rose-600 text-white" },
          { id: "clips", label: "Clips", icon: <Film className="h-4 w-4" /> },
        ],
      },
      {
        group: "COMMUNITY",
        items: [
          { id: "general", label: "General", icon: <MessageSquare className="h-4 w-4" /> },
          { id: "support", label: "Support", icon: <HelpCircle className="h-4 w-4" /> },
          { id: "intro", label: "Introduce Yourself", icon: <UserCheck className="h-4 w-4" /> },
          { id: "off-topic", label: "Off Topic", icon: <Coffee className="h-4 w-4" /> },
          { id: "collab", label: "Collaboration", icon: <Link2 className="h-4 w-4" /> },
          { id: "vc-lounge", label: "VC Lounge", icon: <Headphones className="h-4 w-4" /> },
        ],
      },
      {
        group: "CREATOR NETWORK",
        items: [
          { id: "creators", label: "Creator Directory", icon: <Users className="h-4 w-4" /> },
          { id: "rankings", label: "Creator Rankings", icon: <Trophy className="h-4 w-4" /> },
          { id: "featured", label: "Featured Creators", icon: <Star className="h-4 w-4" /> },
          { id: "rising", label: "Rising Creators", icon: <Zap className="h-4 w-4" /> },
          { id: "partners", label: "Partners", icon: <Gem className="h-4 w-4" /> },
          { id: "events", label: "Events", icon: <Calendar className="h-4 w-4" /> },
          { id: "announcements", label: "Announcements", icon: <Megaphone className="h-4 w-4" /> },
        ],
      },
      {
        group: "YOUR SPACE",
        items: [
          { id: "me", label: "My Profile", icon: <UserIcon className="h-4 w-4" /> },
          { id: "analytics", label: "Creator Analytics", icon: <BarChart3 className="h-4 w-4" /> },
          { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, badge: 12, badgeColor: "bg-rose-600 text-white" },
          { id: "messages", label: "Messages", icon: <Mail className="h-4 w-4" />, badge: 5, badgeColor: "bg-rose-600 text-white" },
        ],
      },
      {
        group: "ADMIN",
        items: [
          { id: "admin", label: "Creator Center", icon: <Compass className="h-4 w-4" /> },
          { id: "moderation", label: "Moderation", icon: <Shield className="h-4 w-4" /> },
          { id: "integrations", label: "Integrations", icon: <Puzzle className="h-4 w-4" /> },
        ],
      },
    ];
  }, []);

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
    setView("home");
    setToast("Signed out");
  }

  const handlePickCreator = (c: { name: string; avatar: string }) => {
    const m = allMembers.find((item) => item.name.toLowerCase() === c.name.toLowerCase()) ?? {
      id: c.name,
      name: c.name,
      handle: `@${c.name.toLowerCase()}`,
      avatar: c.avatar,
      status: "online" as const,
      platform: "Twitch",
      bio: "Featured creator on StreamCore network.",
      link: "https://twitch.tv",
      banner: "",
    };
    setProfile(m);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#0c0e17] text-white">
      {/* 1. Left Navigation Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0e17] transition-transform md:static md:flex md:translate-x-0 ${
          sidebarOpen ? "flex translate-x-0 shadow-2xl" : "flex -translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-md">
              <Disc className="h-4 w-4 text-white" />
            </div>
            <strong className="text-sm font-black tracking-wider text-white">
              STREAMCORE
            </strong>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3 scrollbar-none">
          {navSections.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {group.group && (
                <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {group.group}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#5c54e5] text-white shadow-md shadow-indigo-600/30"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={isActive ? "text-white" : "text-zinc-400"}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Sidebar Card & Create Post Button */}
        <div className="border-t border-white/[0.06] p-3 space-y-2.5 bg-[#0c0e17]">
          {/* Level 100 / XP Card */}
          <div className="rounded-xl border border-white/[0.06] bg-[#141727] p-2.5 shadow-inner">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-zinc-300">STREAMCORE</span>
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-black text-indigo-300">
                Lv. 100
              </span>
            </div>

            {/* Thumbnail artwork */}
            <div className="relative mt-2 h-14 w-full overflow-hidden rounded-lg bg-indigo-950/60">
              <img
                src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80"
                alt="Community Level"
                className="h-full w-full object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141727] via-transparent to-transparent" />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Community Power</span>
              <span className="font-bold text-zinc-200">1,250,000 XP</span>
            </div>
            {/* XP Bar */}
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
            </div>
          </div>

          {/* Create Post Button */}
          <button
            onClick={() => {
              if (myAccount) setView("general");
              else void navigate({ to: "/auth" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5c54e5] py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-[#6c64f5]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Post
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 md:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0c0e17]">
        {/* Top Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0e17] px-4">
          <div className="flex items-center gap-3">
            <button
              className="text-zinc-400 hover:text-white md:hidden"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search Bar */}
            <div className="relative hidden w-80 items-center sm:flex">
              <Search className="absolute left-3 h-3.5 w-3.5 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search creators, posts, clips, or communities..."
                className="w-full rounded-xl border border-white/[0.06] bg-[#121524] py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Right Action Icons & Profile Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("notifications")}
              className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[8px] font-bold text-white">
                12
              </span>
            </button>

            <button
              onClick={() => setView("messages")}
              className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
            >
              <Mail className="h-4 w-4" />
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[8px] font-bold text-white">
                3
              </span>
            </button>

            <button
              onClick={() => setView("admin")}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={() => setToast("Theme settings updated")}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white"
            >
              <Moon className="h-4 w-4" />
            </button>

            {/* Profile Dropdown Pill */}
            <button
              onClick={() => (myAccount ? setView("me") : void navigate({ to: "/auth" }))}
              className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#121524] px-2.5 py-1.5 transition-colors hover:bg-white/[0.08]"
            >
              <div className="relative">
                <img
                  src={myAccount?.avatar_url || "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100&auto=format&fit=crop&q=80"}
                  alt="Plutoforce"
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#121524] bg-emerald-500" />
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <p className="text-xs font-bold text-white">
                  {myAccount?.display_name || "Plutoforce"}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {myAccount ? ROLE_META[topRole(myAccount.roles)].label : "Owner"}
                </p>
              </div>
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
          </div>
        </header>

        {/* 3. Main Center + Right Widget Panels */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Center Feed Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {view === "home" && (
              <HomeDashboard
                onOpenView={(v) => setView(v as View)}
                onPickCreator={handlePickCreator}
              />
            )}

            {view === "trending" && (
              <TrendingView onPickCreator={handlePickCreator} />
            )}

            {view === "live-now" && (
              <LiveNowView onPickCreator={handlePickCreator} />
            )}

            {view === "clips" && (
              <ClipsView onPickCreator={handlePickCreator} />
            )}

            {view === "general" && (
              <div className="space-y-4 px-4 py-5 max-w-4xl mx-auto">
                <section
                  className="relative overflow-hidden rounded-2xl bg-[#121524] bg-cover bg-center p-6 border border-white/[0.06]"
                  style={state.community.banner ? { backgroundImage: `linear-gradient(rgba(24,25,28,.72), rgba(24,25,28,.88)), url(${state.community.banner})` } : undefined}
                >
                  <div className="relative z-10">
                    <p className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-400 border border-indigo-500/30">
                      {state.community.tagline}
                    </p>
                    <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white">
                      {state.community.name}.
                      <br />
                      Every creator.
                    </h1>
                    <p className="mt-2 text-sm text-zinc-400">
                      A community for streamers, creators, teams, and fans.
                    </p>
                  </div>
                </section>

                <div className="space-y-1">
                  {[...state.posts.filter((post) => !post.channel || post.channel === "general")]
                    .sort((a, b) => a.time - b.time)
                    .map((p) => {
                      const m = memberById.get(p.authorId);
                      return (
                        <article
                          key={p.id}
                          className="group rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex gap-3">
                            <button onClick={() => m && setProfile(m)}>
                              <Avatar
                                member={m ?? { name: "Community", avatar: "", status: "offline" }}
                                size={40}
                                showStatus={false}
                              />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => m && setProfile(m)}
                                  className="font-bold text-sm text-white hover:underline"
                                >
                                  {m?.name ?? "Community"}
                                </button>
                                {m?.role === "admin" && (
                                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400">
                                    👑 ADMIN
                                  </span>
                                )}
                                <span className="text-xs text-zinc-500">
                                  {new Date(p.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </span>
                              </div>
                              {p.text && (
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                                  {p.text}
                                </p>
                              )}
                              {p.image && (
                                <img
                                  src={p.image}
                                  alt="Community post attachment"
                                  loading="lazy"
                                  className="mt-2 max-h-80 rounded-xl object-cover"
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

            {view === "rules" && <RulesChannel rules={state.community.rules} onContinue={() => setView("general")} />}

            {(view === "creators" || view === "rankings" || view === "announcements" || view === "featured" || view === "rising" || view === "partners" || view === "events" || view === "analytics" || view === "notifications" || view === "messages" || view === "moderation" || view === "integrations" || view === "support" || view === "intro" || view === "off-topic" || view === "collab" || view === "vc-lounge") && (
              <div className="space-y-4 px-4 py-5 max-w-6xl mx-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                      STREAMCORE NETWORK
                    </p>
                    <h1 className="text-xl font-extrabold text-white capitalize">
                      {view.replaceAll("-", " ")}
                    </h1>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setProfile(m)}
                      className="overflow-hidden rounded-2xl bg-[#121524] border border-white/[0.06] text-left transition-all hover:border-indigo-500/50 hover:bg-[#161a2c]"
                    >
                      <div
                        className="h-16 bg-indigo-900/40 bg-cover bg-center"
                        style={m.banner ? { backgroundImage: `url(${m.banner})` } : undefined}
                      />
                      <div className="-mt-6 p-4">
                        <div className="w-fit rounded-full border-4 border-[#121524]">
                          <Avatar member={m} size={48} />
                        </div>
                        <p className="mt-2 truncate font-bold text-white">{m.name}</p>
                        <p className="truncate text-xs text-zinc-400">{m.handle}</p>
                        <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                          {m.bio || "Community creator profile."}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="rounded bg-white/[0.06] px-2 py-1 font-semibold text-zinc-300">
                            {m.platform}
                          </span>
                          <span className="text-indigo-400 font-semibold">Open profile →</span>
                        </div>
                      </div>
                    </button>
                  ))}
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

            {view === "general" && (
              <div className="p-4 max-w-4xl mx-auto">
                <Composer
                  authors={postingAuthors}
                  authorId={selectedChatAuthor}
                  setAuthorId={setChatAuthor}
                  replyTo={replyTo}
                  clearReply={() => setReplyTo(null)}
                  onSend={(post: PostInput) => addPost(post)}
                  onTyping={broadcastTyping}
                />
              </div>
            )}
          </div>

          {/* Right Widgets Panel - visible on Home view */}
          {view === "home" && (
            <div className="hidden xl:block">
              <RightStatsPanel
                onOpenView={(v) => setView(v as View)}
                onPickCreator={handlePickCreator}
              />
            </div>
          )}
        </div>
      </div>

      <ProfileModal member={profile} onClose={() => setProfile(null)} isAdmin={isAdmin} />
      {channelDetailsOpen && <ChannelDetails members={allMembers} posts={state.posts} onClose={() => setChannelDetailsOpen(false)} onPickMember={(member) => { setChannelDetailsOpen(false); setProfile(member); }} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function RulesChannel({ rules, onContinue }: { rules: string; onContinue: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <section className="rounded-2xl bg-[#121524] p-6 border border-white/[0.06]">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-indigo-600/20 text-3xl text-indigo-400">
          #
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-white">Welcome to #rules!</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Please read these rules before taking part in the community.
        </p>
      </section>
      <section className="space-y-3 rounded-2xl bg-[#121524] p-5 border border-white/[0.06]">
        <h2 className="font-bold text-white">Community rules</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
          {rules.split("\n").filter(Boolean).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <button
          onClick={onContinue}
          className="mt-2 rounded-xl bg-[#5c54e5] px-4 py-2 text-xs font-bold text-white hover:bg-[#6c64f5]"
        >
          I have read the rules — Continue to #general
        </button>
      </section>
    </div>
  );
}
