import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { timeAgo, uploadCommunityMedia, useCommunity, uid, type Member, type Post, type PostInput } from "@/lib/community";
import { Composer } from "@/components/community/Composer";
import { Avatar, ghostButtonClass, statusColor, ErrorBoundary } from "@/components/community/Bits";
import { ProfileModal } from "@/components/community/ProfileModal";
import { ChannelDetails } from "@/components/community/ChannelDetails";
import { AdminView } from "@/components/community/Admin";
import { MembersCRM } from "@/components/community/MembersCRM";
import { ProfileEditor } from "@/components/community/ProfileEditor";
import { CreatorRankingsView } from "@/components/community/CreatorRankingsView";
import { CreatorDirectoryView } from "@/components/community/CreatorDirectoryView";
import { FeaturedCreatorsView } from "@/components/community/FeaturedCreatorsView";
import { PartnersView } from "@/components/community/PartnersView";
import { CreatorAnalyticsView } from "@/components/community/CreatorAnalyticsView";
import { CommunityAnalyticsView } from "@/components/community/CommunityAnalyticsView";
import { NotificationsView } from "@/components/community/NotificationsView";
import { TopCategoriesWidget } from "@/components/community/TopCategoriesWidget";
import { accountToMember, removeFromCommunity, useAccounts, useSession, ROLE_META, topRole } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";
import { getTwitchClips, refreshTwitchStatuses } from "@/lib/twitch.functions";
import { dispatchReplyNotification, dispatchResendNotification } from "@/lib/resend.functions";
import { type CommunityInvite, getInviteByCode, createCommunityInvite, claimInviteOnSignup } from "@/lib/invites";
import { InviteLandingModal } from "@/components/community/InviteLandingModal";
import { MandatoryOnboardingModal } from "@/components/community/MandatoryOnboardingModal";
import { PendingApprovalGateBanner } from "@/components/community/PendingApprovalGateBanner";
import { isStickerSaved, saveCustomSticker } from "@/lib/stickers";
import { triggerStreamerReactionsToPost } from "@/lib/streamer-reactions";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
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

type View = "home" | "rules" | "general" | "creators" | "live-now" | "trending" | "rankings" | "announcements" | "featured" | "rising" | "partners" | "events" | "analytics" | "community-analytics" | "notifications" | "messages" | "admin" | "moderation" | "integrations" | "me" | `channel:${string}`;

const SAVED_VIEW_KEY = "streamcore:last-view";
const STANDARD_VIEWS = new Set<string>([
  "home", "rules", "general", "creators", "live-now", "trending", "rankings",
  "announcements", "featured", "rising", "partners", "events", "analytics",
  "community-analytics", "notifications", "messages", "admin", "moderation",
  "integrations", "me",
]);
const ADMIN_VIEWS = new Set<string>(["admin", "community-analytics", "moderation", "integrations"]);
const ACCOUNT_VIEWS = new Set<string>(["analytics", "notifications", "messages", "me"]);

function isSavedView(value: string | null): value is View {
  return Boolean(
    value &&
      (STANDARD_VIEWS.has(value) ||
        (value.startsWith("channel:") && value.length > "channel:".length)),
  );
}

function Index() {
  const inviteSearch = Route.useSearch();
  const { state, addMember, updateMember, removeMember, addPost, updatePost, removePost, setStats, setCommunity, addChannel, removeChannel, toggleReaction, applyMemberSnapshots, loadOlderPosts, hasOlderPosts, loadingOlderPosts } = useCommunity();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { accounts, loading: accountsLoading, refresh } = useAccounts();
  // Keep the SSR and browser's first render identical. View changes happen only
  // from real user navigation after React has hydrated.
  const [view, setView] = useState<View>("home");
  const [viewRestored, setViewRestored] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [channelDetailsOpen, setChannelDetailsOpen] = useState(false);
  const [profile, setProfile] = useState<Member | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [chatAuthor, setChatAuthor] = useState("");
  const [typingName, setTypingName] = useState<string | null>(null);
  const [twitchStatusReady, setTwitchStatusReady] = useState(false);
  const typingTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Remove credentials and the retired artificial-chat flag left by older builds.
    localStorage.removeItem("streamcore:gemini-api-key");
    localStorage.removeItem("streamcore:gemini-api-keys");
    localStorage.removeItem("streamcore:gemini-model");
    localStorage.removeItem("streamcore:active-chat-config");
    try {
      const key = "streamcore:resend-notification-config";
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if ("apiKey" in parsed) {
          delete parsed["apiKey"];
          localStorage.setItem(key, JSON.stringify(parsed));
        }
      }
    } catch {
      localStorage.removeItem("streamcore:resend-notification-config");
    }
  }, []);

  const userId = session?.user.id;
  const myAccount = useMemo(
    () => (userId ? (accounts.find((a) => a.id === userId) ?? null) : null),
    [userId, accounts],
  );
  const isAdmin = !!myAccount?.roles.includes("admin");

  const [activeInvite, setActiveInvite] = useState<CommunityInvite | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingPromptReady, setOnboardingPromptReady] = useState(false);

  // Detect invite link / code from URL: Show Community Preview Screen immediately, with 5s transition to signup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const codeParam =
      inviteSearch.invite ||
      inviteSearch.code ||
      (window.location.pathname.startsWith("/join/")
        ? window.location.pathname.replace("/join/", "")
        : null);

    if (codeParam) {
      getInviteByCode(codeParam).then(async (inv) => {
        if (inv) {
          setActiveInvite(inv);
          const pendingOAuthCode = localStorage.getItem("streamcore:pending-invite-code");
          if (session?.user && pendingOAuthCode === inv.code) {
            const metadata = session.user.user_metadata ?? {};
            await claimInviteOnSignup(
              inv.code,
              session.user.id,
              String(metadata.display_name || metadata.full_name || session.user.email?.split("@")[0] || "Creator"),
              String(metadata.handle || `@${session.user.email?.split("@")[0] || "creator"}`),
            );
            localStorage.removeItem("streamcore:pending-invite-code");
            setToast("🎉 Invitation accepted. Welcome to StreamCore!");
            refresh();
            return;
          }
          setShowInviteModal(true);
        }
      });
    }
  }, [inviteSearch.code, inviteSearch.invite, refresh, session?.user]);

  // Let new members experience the community before requesting their required
  // rules acknowledgement and streamer profile authorization. The owner/admin
  // manages the community and must never be blocked by creator onboarding.
  const onboardingRequired = Boolean(
    myAccount &&
    !isAdmin &&
    (!myAccount.channel_authorized || !myAccount.rules_acknowledged)
  );

  useEffect(() => {
    setOnboardingPromptReady(false);
    if (!onboardingRequired || onboardingDismissed) return;

    const timer = window.setTimeout(() => setOnboardingPromptReady(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [onboardingRequired, onboardingDismissed, userId]);

  const needsOnboarding = onboardingRequired && !onboardingDismissed && onboardingPromptReady;

  const clientIdRef = useRef<string>(Math.random().toString(36).slice(2, 9));
  const typingChannelRef = useRef<any>(null);

  useEffect(() => {
    const currentClientId = userId || clientIdRef.current;
    const channel = supabase.channel("streamcore-typing", {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload && payload.senderId !== currentClientId) {
        setTypingName(payload.typing ? payload.name : null);
        if (payload.typing) {
          if (typingTimer.current) window.clearTimeout(typingTimer.current);
          typingTimer.current = window.setTimeout(() => setTypingName(null), 3500);
        }
      }
    }).subscribe();

    typingChannelRef.current = channel;

    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  function broadcastTyping(typing: boolean) {
    const author = postingAuthors.find((member) => member.id === selectedChatAuthor);
    const authorName = author?.name || myAccount?.display_name || "Community member";
    const senderId = userId || clientIdRef.current;
    const channel = typingChannelRef.current;

    if (channel) {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { senderId, name: authorName, typing },
      });
    }

    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (typing) {
      typingTimer.current = window.setTimeout(() => broadcastTyping(false), 2500);
    }
  }

  useEffect(() => {
    if (!userId) return;
    const heartbeat = () => void supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", userId);
    heartbeat();
    const timer = window.setInterval(heartbeat, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, userId]);

  const channels = useMemo(() => {
    const groups: { group: string; items: { id: View; label: string; icon: string }[] }[] = [
      {
        group: "Explore",
        items: [
          { id: "home", label: "Home", icon: "⌂" },
          { id: "trending", label: "Trending", icon: "🔥" },
          { id: "live-now", label: "Live now", icon: "●" },
          { id: "creators", label: "Creator directory", icon: "✦" },
          { id: "rankings", label: "Creator rankings", icon: "🏆" },
          { id: "announcements", label: "Announcements", icon: "📣" },
        ],
      },
      {
        group: "Creator network",
        items: [
          { id: "featured", label: "Featured creators", icon: "⭐" },
          { id: "rising", label: "Rising creators", icon: "🚀" },
          { id: "partners", label: "Partners", icon: "💎" },
          { id: "events", label: "Events", icon: "📅" },
        ],
      },
      {
        group: "Community spaces",
        items: [
          { id: "rules", label: "rules", icon: "#" },
          { id: "general", label: "general", icon: "#" },
          ...state.channels.filter((channel) => channel.id !== "rules").map((channel) => ({ id: `channel:${channel.id}` as View, label: channel.name, icon: "#" })),
        ],
      },
    ];
    if (myAccount)
      groups.push({ group: "Your space", items: [{ id: "me", label: "My profile", icon: "@" }, { id: "analytics", label: "My analytics", icon: "📊" }, { id: "notifications", label: "Notifications", icon: "🔔" }, { id: "messages", label: "Messages", icon: "✉" }] });
    if (isAdmin) {
      groups.push({ group: "Admin / Owner", items: [{ id: "admin", label: "Control center", icon: "⚙" }, { id: "community-analytics", label: "Community analytics", icon: "🌎" }, { id: "moderation", label: "Moderation", icon: "🛡" }, { id: "integrations", label: "Integrations", icon: "⌁" }] });
    }
    return groups;
  }, [isAdmin, myAccount, state.channels]);

  useEffect(() => {
    if (viewRestored || sessionLoading || accountsLoading) return;

    if (localStorage.getItem("streamcore:open-rules") === "1") {
      localStorage.removeItem("streamcore:open-rules");
      setView("rules");
      setViewRestored(true);
      return;
    }

    const savedView = localStorage.getItem(SAVED_VIEW_KEY);
    if (isSavedView(savedView)) {
      const requiresAdmin = ADMIN_VIEWS.has(savedView);
      const requiresAccount = ACCOUNT_VIEWS.has(savedView);
      if ((!requiresAdmin || isAdmin) && (!requiresAccount || Boolean(myAccount))) {
        setView(savedView);
      } else {
        localStorage.removeItem(SAVED_VIEW_KEY);
      }
    }
    setViewRestored(true);
  }, [accountsLoading, isAdmin, myAccount, sessionLoading, viewRestored]);

  useEffect(() => {
    if (!viewRestored) return;
    localStorage.setItem(SAVED_VIEW_KEY, view);
  }, [view, viewRestored]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (view !== "general" && !view.startsWith("channel:")) return;
    const scrollToBottom = () => {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    };
    scrollToBottom();
    const t1 = setTimeout(scrollToBottom, 50);
    const t2 = setTimeout(scrollToBottom, 200);
    const t3 = setTimeout(scrollToBottom, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [view, state.posts.length]);

  const realMembers = useMemo(
    () => accounts.filter((a) => !a.is_banned).map(accountToMember),
    [accounts],
  );
  const allMembers = useMemo(() => {
    const list: Member[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const seenHandles = new Set<string>();
    const seenLinks = new Set<string>();

    for (const m of realMembers) {
      const matchingStateMember = state.members.find(
        (sm) => (sm.id && m.id && sm.id.toLowerCase() === m.id.toLowerCase()) ||
                (sm.handle && m.handle && sm.handle.replace(/^@/, "").toLowerCase() === m.handle.replace(/^@/, "").toLowerCase()) ||
                (sm.link && m.link && sm.link.trim().toLowerCase() === m.link.trim().toLowerCase())
      );

      const mergedMember: Member = {
        ...m,
        status: matchingStateMember?.status ?? m.status,
        avatar: matchingStateMember?.avatar || m.avatar,
        banner: matchingStateMember?.banner || m.banner,
        bio: matchingStateMember?.bio || m.bio,
        followers: matchingStateMember?.followers ?? m.followers,
        viewerCount: matchingStateMember?.viewerCount ?? m.viewerCount,
        gameName: matchingStateMember?.gameName ?? m.gameName,
        gameImage: matchingStateMember?.gameImage ?? m.gameImage,
        streamTitle: matchingStateMember?.streamTitle ?? m.streamTitle,
      };

      const idKey = m.id?.toLowerCase() || "";
      const nameKey = m.name ? m.name.trim().toLowerCase() : "";
      const handleKey = m.handle ? m.handle.replace(/^@/, "").trim().toLowerCase() : "";
      const linkKey = m.link ? m.link.trim().toLowerCase() : "";

      if (idKey) seenIds.add(idKey);
      if (nameKey) seenNames.add(nameKey);
      if (handleKey) seenHandles.add(handleKey);
      if (linkKey) seenLinks.add(linkKey);
      list.push(mergedMember);
    }

    for (const m of state.members) {
      const idKey = m.id?.toLowerCase() || "";
      const nameKey = m.name ? m.name.trim().toLowerCase() : "";
      const handleKey = m.handle ? m.handle.replace(/^@/, "").trim().toLowerCase() : "";
      const linkKey = m.link ? m.link.trim().toLowerCase() : "";

      if (
        (idKey && seenIds.has(idKey)) ||
        (nameKey && seenNames.has(nameKey)) ||
        (handleKey && seenHandles.has(handleKey)) ||
        (linkKey && seenLinks.has(linkKey))
      ) {
        continue;
      }

      if (idKey) seenIds.add(idKey);
      if (nameKey) seenNames.add(nameKey);
      if (handleKey) seenHandles.add(handleKey);
      if (linkKey) seenLinks.add(linkKey);
      list.push(m);
    }

    return list;
  }, [realMembers, state.members]);

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of allMembers) {
      if (m.id) {
        map.set(m.id, m);
        map.set(m.id.toLowerCase(), m);
      }
      if (m.handle) {
        map.set(m.handle, m);
        map.set(m.handle.toLowerCase(), m);
        map.set(m.handle.replace(/^@/, "").toLowerCase(), m);
      }
      if (m.name) {
        map.set(m.name, m);
        map.set(m.name.toLowerCase(), m);
      }
    }
    return map;
  }, [allMembers]);

  const allMembersRef = useRef(allMembers);
  allMembersRef.current = allMembers;
  const twitchChannelKey = useMemo(
    () =>
      allMembers
        .filter(
          (member) =>
            (member.platform?.toLowerCase() === "twitch" || member.link?.includes("twitch.tv")) &&
            Boolean(member.link?.trim()),
        )
        .map((member) => `${member.id}:${member.link.trim().toLowerCase()}`)
        .sort()
        .join("|"),
    [allMembers],
  );

  const postingAuthors = useMemo(() => {
    if (!myAccount) return [];
    const ownerProfile = accountToMember(myAccount);
    if (!isAdmin) return [ownerProfile];
    const map = new Map<string, Member>();
    map.set(ownerProfile.id, ownerProfile);
    for (const m of allMembers) {
      map.set(m.id, m);
    }
    return Array.from(map.values());
  }, [isAdmin, myAccount, allMembers]);

  const selectedChatAuthor = postingAuthors.some((member) => member.id === chatAuthor)
    ? chatAuthor
    : (postingAuthors[0]?.id ?? "");

  const filtered = allMembers.filter((m) =>
    `${m.name} ${m.handle} ${m.platform} ${m.bio}`.toLowerCase().includes(query.toLowerCase()),
  );
  const liveMembers = twitchStatusReady ? allMembers.filter((m) => m.status === "live") : [];
  const adminMembers = allMembers.filter((m) => m.role === "admin");
  const online = allMembers.filter((m) => m.status !== "offline" && m.role !== "admin");
  const offline = allMembers.filter((m) => m.status === "offline" && m.role !== "admin");

  const [pinnedStreamerIds, setPinnedStreamerIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const fetchPinned = async () => {
      try {
        const { data, error } = await supabase
          .from("integration_settings")
          .select("setting_value")
          .eq("setting_name", "community_pinned_streamers")
          .maybeSingle();
        if (!error && data?.setting_value && Array.isArray(data.setting_value) && data.setting_value.length > 0) {
          if (active) setPinnedStreamerIds(data.setting_value as string[]);
        } else {
          const saved = localStorage.getItem("streamcore:pinned-streamers");
          if (saved) {
            const parsed: unknown = JSON.parse(saved);
            if (Array.isArray(parsed) && active && parsed.length > 0) {
              setPinnedStreamerIds(parsed as string[]);
            }
          }
        }
      } catch {
        // fallback
      }
    };
    void fetchPinned();

    const channel = supabase
      .channel("streamcore-pinned-streamers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "integration_settings", filter: "setting_name=eq.community_pinned_streamers" },
        (payload: any) => {
          if (payload.new?.setting_value && Array.isArray(payload.new.setting_value)) {
            setPinnedStreamerIds(payload.new.setting_value);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinSearch, setPinSearch] = useState("");

  const effectivePinnedIds = useMemo(() => {
    // 1. Direct synced pinned IDs from Supabase integration_settings
    if (pinnedStreamerIds.length > 0) return pinnedStreamerIds;

    // 2. Members with isPinned flag
    const dbPinned = allMembers.filter((m) => m.isPinned).map((m) => m.id);
    if (dbPinned.length > 0) return dbPinned;

    // 3. Fallback to prominent admin-managed creators
    const adminManaged = allMembers.filter((m) => m.managedByAdmin || m.role === "admin" || m.role === "partner").map((m) => m.id);
    if (adminManaged.length > 0) return adminManaged.slice(0, 7);

    return allMembers.slice(0, 6).map((m) => m.id);
  }, [pinnedStreamerIds, allMembers]);

  const togglePinStreamer = async (id: string) => {
    if (!isAdmin) return;
    const current = effectivePinnedIds.includes(id)
      ? effectivePinnedIds.filter((x) => x !== id)
      : [...effectivePinnedIds, id];

    setPinnedStreamerIds(current);
    try {
      localStorage.setItem("streamcore:pinned-streamers", JSON.stringify(current));
    } catch {}

    const target = allMembers.find((m) => m.id === id);
    const isNowPinned = current.includes(id);

    try {
      await Promise.all([
        updateMember(id, { isPinned: isNowPinned }),
        supabase.from("integration_settings").upsert(
          {
            setting_name: "community_pinned_streamers",
            setting_value: current,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_name" }
        ),
      ]);
      setToast(isNowPinned ? `📌 ${target?.name ?? "Streamer"} pinned to left rail for all visitors!` : `${target?.name ?? "Streamer"} unpinned from left rail`);
    } catch (err) {
      console.error("Save pin error", err);
      setToast("Pinned locally");
    }
  };

  useEffect(() => {
    let active = true;
    const refreshTwitch = async () => {
      const currentAll = allMembersRef.current;
      const twitchMembers = currentAll.filter(
        (member) => (member.platform?.toLowerCase() === "twitch" || member.link?.includes("twitch.tv")) && Boolean(member.link?.trim())
      );
      if (!twitchMembers.length) return;
      try {
        const batches: typeof twitchMembers[] = [];
        for (let index = 0; index < twitchMembers.length; index += 100) {
          batches.push(twitchMembers.slice(index, index + 100));
        }
        const updates = (
          await Promise.all(
            batches.map((batch) =>
              refreshTwitchStatuses({
                data: {
                  channels: batch.map((member) => ({
                    id: member.id,
                    channelUrl: member.link,
                    followers: member.followers,
                  })),
                },
              }),
            ),
          )
        ).flat();
        if (!active) return;
        applyMemberSnapshots(
          updates.map((update) => ({
            id: update.id,
            patch: {
              status: update.status,
              banner: update.banner,
              avatar: update.avatar,
              bio: update.bio,
              viewerCount: update.viewerCount,
              gameName: update.gameName,
              gameImage: update.gameImage,
              streamTitle: update.title,
              ...(typeof update.followers === "number" && update.followers > 0
                ? { followers: update.followers }
                : {}),
            },
          })),
        );
        setTwitchStatusReady(true);
      } catch (error) {
        console.error("Twitch status refresh failed", error);
        /* Keep the last known status if Twitch is temporarily unavailable. */
      }
    };

    void refreshTwitch();
    // Shared server caching means every visitor sees the same real Helix
    // snapshot without each browser creating a separate high-frequency poll.
    const timer = window.setInterval(() => void refreshTwitch(), 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [applyMemberSnapshots, twitchChannelKey]);

  // 24/7 AI Community Activity Engine Heartbeat
  useEffect(() => {
    let intervalId: number | null = null;

    const checkAndRunAutopilot = async () => {
      try {
        const { data: settingRow } = await (supabase as any)
          .from("integration_settings")
          .select("setting_value")
          .eq("setting_name", "ai_autopilot")
          .maybeSingle();

        const config = settingRow?.setting_value;
        if (!config || !config.active) return;

        const intervalSec = Math.max(8, Math.round((config.intervalMinutes || 10) * 60));
        const lastRunMs = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
        const nowMs = Date.now();

        if (nowMs - lastRunMs >= intervalSec * 1000) {
          // 1. Show realistic typing indicator 2s before message lands
          const membersList = allMembersRef.current.filter((m) => m.role !== "admin" && m.id !== "community");
          const typingStreamer = membersList[Math.floor(Math.random() * membersList.length)] || allMembersRef.current[0];
          if (typingStreamer) {
            setTypingName(typingStreamer.name);
          }

          setTimeout(async () => {
            const { data: result } = await (supabase as any).rpc("run_streamcore_ai_autopilot", { force_run: false });
            setTypingName(null);
            if (result?.created && result?.postId) {
              setTimeout(() => {
                void triggerStreamerReactionsToPost(
                  result.postId,
                  result.text || "",
                  result.authorId || "streamer",
                  allMembersRef.current
                );
              }, 2500);
            }
          }, 2000);
        }
      } catch (err) {
        // Autopilot heartbeat tick
      }
    };

    const initTimer = window.setTimeout(() => {
      void checkAndRunAutopilot();
    }, 2000);

    intervalId = window.setInterval(() => {
      void checkAndRunAutopilot();
    }, 8000);

    return () => {
      window.clearTimeout(initTimer);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setView("home");
    setToast("Signed out");
  }

  async function copyInviteUrl(inviteUrl: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      return true;
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = inviteUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        return copied;
      } catch {
        return false;
      }
    }
  }

  async function createAndCopyInvite() {
    if (!isAdmin || !myAccount || inviteBusy) return;

    setInviteBusy(true);
    try {
      const result = await createCommunityInvite(
        myAccount.id,
        myAccount.display_name,
        myAccount.handle || "@admin",
        "sidebar_share",
      );
      if (!result.success || !result.code) {
        setToast(result.error || "Invite generation failed. No link was copied.");
        return;
      }

      const inviteUrl = `${window.location.origin}/join/${result.code}`;
      const copied = await copyInviteUrl(inviteUrl);
      setToast(
        copied
          ? `🔗 Invite copied: ${inviteUrl}`
          : `Invite created: ${inviteUrl}`,
      );
    } finally {
      setInviteBusy(false);
    }
  }

  async function sendCommunityPost(post: PostInput) {
    await addPost(post);

    setTimeout(() => {
      const latestPost = state.posts[0];
      if (latestPost) {
        void triggerStreamerReactionsToPost(
          latestPost.id,
          post.text || "",
          post.authorId,
          allMembersRef.current,
          latestPost.reactions,
          latestPost.likes
        );
      }
    }, 2500);

    if (!post.replyToId || !session?.access_token) return;
    const author = memberById.get(post.authorId);
    try {
      await dispatchReplyNotification({ data: {
        accessToken: session.access_token,
        parentPostId: post.replyToId,
        replyAuthorId: post.authorId,
        replyAuthorName: author?.name || "Community member",
        replyText: post.text || "Shared an attachment",
      } });
    } catch (error) {
      console.error("Reply email notification failed", error);
    }
  }

  async function generateManagedMemberClips(
    member: Member,
    amount = 6,
    engagement?: { likes?: number; comments?: number; shares?: number },
  ) {
    if (!member.link) return;
    try {
      const clips = await getTwitchClips({ data: { channelUrl: member.link, first: amount } });
      if (!clips.length) {
        setToast(`No recent public clips found for ${member.name}.`);
        return;
      }

      const likesCount = engagement?.likes ?? 0;
      const commentsCount = engagement?.comments ?? 0;
      const sharesCount = engagement?.shares ?? 0;

      const defaultComments = [
        "insane clip 🔥",
        "W stream moment 🙌",
        "chat was going wild here 😂",
        "peak gameplay right there",
        "clip of the day 👑",
        "nah that reaction was priceless 💀",
      ];

      for (const clip of clips) {
        const existing = state.posts.find((p) => (p.text && p.text.includes(clip.url)) || p.image === clip.thumbnail_url);
        
        const clipComments = Array.from({ length: commentsCount }, (_, i) => ({
          id: uid(),
          authorId: (allMembers && allMembers[(i + 1) % allMembers.length]?.id) || state.members[(i + 1) % (state.members.length || 1)]?.id || "member",
          text: defaultComments[i % defaultComments.length],
          time: Date.now() - (i + 1) * 60_000,
        }));

        if (existing) {
          await updatePost(existing.id, {
            reactions: likesCount > 0 ? { "❤️": likesCount, "🔥": Math.max(1, Math.floor(likesCount / 2)) } : {},
            likes: Array.from({ length: likesCount }, (_, i) => `user-${i + 1}`),
            shares: sharesCount,
            comments: clipComments,
          });
        } else {
          await addPost({
            authorId: member.id,
            channel: "clips",
            text: `${clip.title}\n${clip.url}\n👁 ${clip.view_count.toLocaleString()} views`,
            image: clip.thumbnail_url,
            reactions: likesCount > 0 ? { "❤️": likesCount, "🔥": Math.max(1, Math.floor(likesCount / 2)) } : {},
            likes: Array.from({ length: likesCount }, (_, i) => `user-${i + 1}`),
            shares: sharesCount,
            comments: clipComments,
          });
        }
      }
      if (session?.access_token) {
        await dispatchResendNotification({
          data: {
            accessToken: session.access_token,
            kind: "clip",
            dedupeKey: `clips:${member.id}:${clips.map((clip) => clip.id).join("-")}`,
            subject: `🎬 ${clips.length} new ${member.name} clip${clips.length === 1 ? "" : "s"} on StreamCore`,
            text: `${clips.length} real Twitch clip${clips.length === 1 ? " was" : "s were"} added for ${member.name}.`,
            html: `<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#8b5cf6">New Twitch clips from ${member.name.replace(/[<>&\"']/g, "")}</h2><p>${clips.length} real clip${clips.length === 1 ? " was" : "s were"} added to #clips.</p><a href="https://peak-pylon.vercel.app" style="color:#a78bfa">Open StreamCore →</a></div>`,
          },
        });
      }
      setToast(`Generated ${clips.length} clips for ${member.name} with ${likesCount} likes, ${commentsCount} comments & ${sharesCount} shares.`);
    } catch (error) {
      console.error("Clip generation error", error);
      setToast(`Could not generate clips: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Server rail */}
      <nav className="hidden w-[72px] shrink-0 flex-col items-center gap-2.5 bg-rail py-3 sm:flex overflow-y-auto">
        <button onClick={() => setView("home")} title="StreamCore Home" className="transition-transform hover:scale-105">
          <CommunityMark community={state.community} size={48} />
        </button>
        <div className="h-0.5 w-8 rounded bg-border/80" />

        {/* Pinned Streamers */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          {effectivePinnedIds.map((id) => {
            const m = memberById.get(id) || allMembers.find((x) => x.id === id);
            if (!m) return null;
            const isLive = m.status === "live";
            const isOnline = m.status === "online";

            return (
              <div key={m.id} className="group relative flex items-center justify-center">
                <span className={`absolute -left-3 w-1 rounded-r transition-all duration-200 ${
                  isLive ? "h-8 bg-live shadow-[0_0_8px_rgba(239,68,68,0.8)]" : isOnline ? "h-5 bg-online" : "h-0 bg-transparent group-hover:h-3"
                }`} />

                <button
                  onClick={() => setProfile(m)}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-3xl transition-all duration-200 hover:rounded-2xl ${
                    isLive
                      ? "ring-2 ring-live ring-offset-2 ring-offset-rail shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                      : isOnline
                        ? "hover:ring-2 hover:ring-online hover:ring-offset-2 hover:ring-offset-rail"
                        : "hover:ring-2 hover:ring-primary/60 hover:ring-offset-2 hover:ring-offset-rail"
                  }`}
                  title={`${m.name} (@${m.handle.replace(/^@/, '')}) - ${m.status.toUpperCase()}`}
                >
                  <Avatar member={m} size={48} showStatus={false} />

                  <span
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-rail ${
                      isLive
                        ? "bg-live animate-ping"
                        : isOnline
                          ? "bg-online"
                          : "bg-muted-foreground/60"
                    }`}
                  />
                  <span
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-rail ${
                      isLive
                        ? "bg-live"
                        : isOnline
                          ? "bg-online"
                          : "bg-muted-foreground/60"
                    }`}
                  />
                </button>

                {/* Floating tooltip */}
                <div className="pointer-events-none absolute left-16 z-50 hidden whitespace-nowrap rounded-lg bg-popover px-3 py-1.5 text-xs font-bold text-popover-foreground shadow-xl border border-border/80 group-hover:block">
                  <div className="flex items-center gap-1.5">
                    <span>{m.name}</span>
                    {isLive && <span className="rounded bg-live px-1 py-0.2 text-[9px] text-white font-extrabold uppercase">LIVE</span>}
                    {!isLive && isOnline && <span className="text-[10px] text-online font-semibold">● Online</span>}
                  </div>
                  <div className="text-[10px] font-normal text-muted-foreground">{m.handle} · {m.platform}</div>
                </div>
              </div>
            );
          })}

          {/* Add / Manage Pinned Streamers button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={() => setPinModalOpen(true)}
              className="grid h-12 w-12 place-items-center rounded-3xl bg-accent text-sm font-bold text-muted-foreground transition-all hover:rounded-2xl hover:bg-primary hover:text-primary-foreground hover:shadow-md"
              title="Pin / Manage Streamers in Rail (Admin)"
            >
              +
            </button>
          )}
        </div>
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

        {isAdmin && <div className="p-3">
          <button
            type="button"
            onClick={() => void createAndCopyInvite()}
            disabled={inviteBusy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold hover:bg-accent/70"
          >
            {inviteBusy ? "Creating invite..." : "Invite"}
          </button>
        </div>}

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
          {view !== "home" && <button onClick={() => view === "general" && setChannelDetailsOpen(true)} className="flex min-w-0 items-center gap-1.5 text-left disabled:cursor-default" disabled={view !== "general"} title={view === "general" ? "Open channel details" : undefined}>
            <span className="text-xl text-muted-foreground">#</span>
            <strong className="truncate">
               {view === "admin" ? "control-center" : view === "me" ? "my-profile" : view.startsWith("channel:") ? state.channels.find((channel) => `channel:${channel.id}` === view)?.name ?? "channel" : view.replaceAll("-", " ")}
            </strong>
          </button>}
          {view === "home" && <div className="hidden min-w-0 max-w-md flex-1 items-center rounded-lg border border-border bg-input/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex"><span className="mr-2 text-sm">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search creators, posts, clips, or communities..." className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" /></div>}
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
            {view === "home" && <HomeDashboard state={state} liveMembers={liveMembers} members={allMembers} posts={state.posts} onPick={setProfile} onOpen={setView} />}
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
                    <Stat value={allMembers.length.toLocaleString()} label="Members" logo={state.community.logo} />
                    <Stat value={allMembers.filter((m) => m.status !== "offline").length.toLocaleString()} label="Online" dot />
                    <Stat value={`#${Math.min(1, allMembers.length)}`} label="Rank by size" />
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    <strong className="text-foreground">
                      {allMembers.length.toLocaleString()}
                    </strong>{" "}
                    verified streamer accounts in the community.
                  </p>
                  </div>
                </section>

                <LiveStories members={liveMembers.filter((member) => member.status === "live")} onPick={setProfile} />

                {myAccount && (myAccount.approval_status === "pending" || !myAccount.channel_authorized) && (
                  <PendingApprovalGateBanner
                    account={myAccount}
                    onOpenMessageAdmin={() => {
                      setView("messages");
                      setToast("Contact your Inviter or Admin to verify your PV Token");
                    }}
                  />
                )}

                <div className="space-y-0.5">
                  {hasOlderPosts && (
                    <button
                      onClick={() => void loadOlderPosts()}
                      disabled={loadingOlderPosts}
                      className="mx-auto mb-3 block rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-60"
                    >
                      {loadingOlderPosts ? "Loading messages…" : "Load earlier messages"}
                    </button>
                  )}
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
                                {parent.text ? parent.text.replace(/https?:\/\/[^\s]+(?:\.gif|\.png|\.webp|\.svg|giphy\.com|twemoji)[^\s]*/gi, "").trim() || (parent.sticker ? "sticker" : "attachment") : parent.sticker ? "sticker" : "attachment"}
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
                              {p.text && (() => {
                                const displayText = p.text
                                  .replace(/\[?StreamCore AI here\]?[:\s\-]*/gi, "")
                                  .replace(/\[?StreamCore AI\]?[:\s\-]*/gi, "")
                                  .replace(/^Hey everyone!?\s*\[?StreamCore AI here\]?[:\s\-]*/gi, "")
                                  .replace(/^Hey everyone!?\s*/gi, "")
                                  .replace(/As an AI[^:.]*[:.]\s*/gi, "")
                                  .replace(/https?:\/\/[^\s]+(?:\.gif|\.png|\.webp|\.svg|giphy\.com|twemoji)[^\s]*/gi, "")
                                  .trim();
                                return displayText ? (
                                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
                                    {displayText}
                                  </p>
                                ) : null;
                              })()}
                              {p.sticker && (
                                <StickerDisplay sticker={p.sticker} onToast={setToast} />
                              )}
                              {(() => {
                                const twitchMatch = p.text?.match(/https?:\/\/(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)/i);
                                const isLiveAnnouncement = Boolean(
                                  twitchMatch ||
                                  p.text?.toLowerCase().includes("live now") ||
                                  p.text?.toLowerCase().includes("streaming now") ||
                                  p.text?.toLowerCase().includes("going live") ||
                                  p.text?.toLowerCase().includes("twitch.tv")
                                );
                                const streamChannel = twitchMatch?.[1] || (m?.status === "live" && isLiveAnnouncement ? m?.handle?.replace(/^@/, "") : null);
                                if (streamChannel && !p.image && !p.sticker) {
                                  const liveThumb = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${streamChannel.toLowerCase()}-640x360.jpg`;
                                  return (
                                    <div className="mt-2.5 max-w-md overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-b from-popover to-background shadow-lg">
                                      <div className="relative aspect-video w-full overflow-hidden bg-accent/40 flex items-center justify-center">
                                        <img
                                          src={m?.banner || liveThumb}
                                          alt={`${streamChannel} stream preview`}
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=640&q=80";
                                          }}
                                          className="h-full w-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-destructive px-2 py-0.5 text-[10px] font-black text-white shadow-md">
                                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                                          LIVE NOW
                                        </div>
                                        <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-bold text-[#a78bfa] backdrop-blur-sm border border-purple-500/30">
                                          Twitch Live
                                        </div>
                                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2">
                                          <Avatar member={m ?? { name: streamChannel, avatar: "", status: "live" }} size={32} showStatus={false} />
                                          <div className="min-w-0">
                                            <p className="text-xs font-bold text-white drop-shadow truncate">{m?.name || streamChannel}</p>
                                            <p className="text-[10px] text-purple-200 drop-shadow truncate">{m?.gameName || "Live Stream"}</p>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between p-3 bg-popover">
                                        <div className="min-w-0 pr-2">
                                          <p className="truncate text-xs font-bold text-foreground">{m?.streamTitle || `${m?.name || streamChannel} is LIVE on Twitch`}</p>
                                          <p className="truncate text-[11px] text-muted-foreground">{m?.gameName ? `Playing ${m.gameName}` : "Join the live stream & chat"}</p>
                                        </div>
                                        <a
                                          href={`https://www.twitch.tv/${streamChannel}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-black text-primary-foreground shadow hover:scale-105 transition-transform"
                                        >
                                          Watch Stream ↗
                                        </a>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {p.image && (
                                <img
                                  src={p.image}
                                  alt="Community post attachment"
                                  loading="lazy"
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                  className="mt-2 max-h-80 rounded-lg object-cover"
                                />
                              )}
                              {p.video && (p.video.endsWith(".mp4") || p.video.endsWith(".webm") || p.video.startsWith("data:video") || p.video.startsWith("blob:")) && (
                                <video
                                  src={p.video}
                                  controls
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                  className="mt-2 max-h-80 w-full rounded-lg"
                                />
                              )}
                              <MessageActions post={p} member={m} isAdmin={isAdmin} currentUserId={myAccount?.id} onReply={() => setReplyTo({ id: p.id, name: m?.name ?? "Community" })} onReact={(id, emoji) => toggleReaction(id, emoji, myAccount?.id || "user")} onDelete={removePost} onRemoveMember={async () => { if (m?.real) await removeFromCommunity(m.id); else if (m) await removeMember(m.id); }} />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                </div>
              </div>
            )}

            {view === "rules" && <RulesChannel rules={state.community.rules} onContinue={() => setView("general")} />}

            {view === "live-now" && <LiveNowCommunityView members={liveMembers} onPick={setProfile} />}

            {view === "trending" && (
              <TrendingCommunityView
                title="🔥 TRENDING"
                subtitle="Official community announcements, featured updates, and creator highlights."
                formLabel="Create Trending Post · Admin Only"
                posts={state.posts
                  .filter((post) => post.channel === "trending" || post.channel === "announcements")
                  .sort((a, b) => (b.time || 0) - (a.time || 0))}
                members={memberById}
                allMemberList={allMembers}
                isAdmin={isAdmin}
                currentUserId={myAccount?.id}
                onCreate={async (post) => {
                  const authorId = myAccount?.id ?? adminMembers[0]?.id;
                  if (authorId) {
                    await addPost({ ...post, authorId, channel: "trending" });
                    if (session?.access_token) {
                      await dispatchResendNotification({ data: {
                        accessToken: session.access_token,
                        kind: "announcement",
                        dedupeKey: `trending:${authorId}:${post.time ?? Date.now()}`,
                        subject: `📢 ${post.text.split("\n")[0]?.slice(0, 140) || "New StreamCore update"}`,
                        text: post.text.slice(0, 4000),
                        html: `<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#f59e0b">Official StreamCore update</h2><p style="white-space:pre-wrap">${post.text.replace(/[<>&\"']/g, "")}</p><a href="https://peak-pylon.vercel.app" style="color:#fbbf24">Read on StreamCore →</a></div>`,
                      } });
                    }
                  }
                }}
                onUpdate={updatePost}
                onDelete={removePost}
                onPick={setProfile}
                setToast={setToast}
              />
            )}

            {view === "announcements" && (
              <TrendingCommunityView
                title="📣 ANNOUNCEMENTS"
                subtitle="Important community announcements, updates, and milestones broadcast by community leaders."
                formLabel="Broadcast Announcement · Admin Only"
                posts={state.posts
                  .filter((post) => post.channel === "announcements" || post.channel === "trending")
                  .sort((a, b) => (b.time || 0) - (a.time || 0))}
                members={memberById}
                allMemberList={allMembers}
                isAdmin={isAdmin}
                currentUserId={myAccount?.id}
                onCreate={async (post) => {
                  const authorId = myAccount?.id ?? adminMembers[0]?.id;
                  if (authorId) {
                    await addPost({ ...post, authorId, channel: "announcements" });
                    if (session?.access_token) {
                      await dispatchResendNotification({ data: {
                        accessToken: session.access_token,
                        kind: "announcement",
                        dedupeKey: `announcement:${authorId}:${post.time ?? Date.now()}`,
                        subject: `📢 ${post.text.split("\n")[0]?.slice(0, 140) || "New StreamCore announcement"}`,
                        text: post.text.slice(0, 4000),
                        html: `<div style="font-family:sans-serif;background:#0d0e12;color:#fff;padding:24px;border-radius:12px"><h2 style="color:#f59e0b">Official StreamCore announcement</h2><p style="white-space:pre-wrap">${post.text.replace(/[<>&\"']/g, "")}</p><a href="https://peak-pylon.vercel.app" style="color:#fbbf24">Read on StreamCore →</a></div>`,
                      } });
                    }
                  }
                }}
                onUpdate={updatePost}
                onDelete={removePost}
                onPick={setProfile}
                setToast={setToast}
              />
            )}

            {view === "events" && (
              <EventsCommunityView
                posts={state.posts
                  .filter((post) => post.channel === "events")
                  .sort((a, b) => (b.time || 0) - (a.time || 0))}
                members={memberById}
                allMemberList={allMembers}
                isAdmin={isAdmin}
                currentUserId={myAccount?.id}
                onCreate={async (post) => {
                  const authorId = myAccount?.id ?? adminMembers[0]?.id;
                  if (authorId) await addPost({ ...post, authorId, channel: "events" });
                }}
                onUpdate={updatePost}
                onDelete={removePost}
                onPick={setProfile}
                setToast={setToast}
              />
            )}

            {view === "rankings" && (
              <CreatorRankingsView
                members={allMembers}
                posts={state.posts}
                onPick={setProfile}
                initialCategory="overall"
                isAdmin={isAdmin}
                accessToken={session?.access_token}
              />
            )}

            {view === "rising" && (
              <CreatorRankingsView
                members={allMembers}
                posts={state.posts}
                onPick={setProfile}
                initialCategory="rising"
                isAdmin={isAdmin}
                accessToken={session?.access_token}
              />
            )}

            {view.startsWith("channel:") && (() => {
              const channel = state.channels.find((item) => `channel:${item.id}` === view);
              return channel ? (
                <CustomChannel
                  name={channel.name}
                  topic={channel.topic}
                  posts={state.posts.filter((post) => post.channel === channel.id || post.channel === channel.name)}
                  members={memberById}
                  allMemberList={allMembers}
                  onReply={(post) => setReplyTo({ id: post.id, name: memberById.get(post.authorId)?.name ?? "Community" })}
                  onReact={(id, emoji) => toggleReaction(id, emoji, myAccount?.id || "user")}
                  isAdmin={isAdmin}
                  currentUserId={myAccount?.id}
                  onDelete={removePost}
                  onUpdate={updatePost}
                  onToast={setToast}
                />
              ) : null;
            })()}

            {view === "featured" && (
              <FeaturedCreatorsView
                members={allMembers}
                posts={state.posts}
                onPick={setProfile}
                isAdmin={isAdmin}
                setToast={setToast}
              />
            )}

            {view === "partners" && (
              <PartnersView
                members={allMembers}
                posts={state.posts}
                onPick={setProfile}
                isAdmin={isAdmin}
                currentUserId={myAccount?.id}
                onCreate={addPost}
                setToast={setToast}
                onSendMessage={(m) => {
                  setProfile(m);
                  setToast(`Opened profile for ${m.name}`);
                }}
              />
            )}

            {view === "analytics" && (
              <CreatorAnalyticsView
                myMember={myAccount ? accountToMember(myAccount) : allMembers[0]}
                posts={state.posts}
                setToast={setToast}
              />
            )}

            {view === "community-analytics" && (
              <CommunityAnalyticsView
                members={allMembers}
                posts={state.posts}
                setToast={setToast}
              />
            )}

            {view === "notifications" && (
              <NotificationsView
                onNavigate={(v) => {
                  setView(v as View);
                }}
                onPickMember={setProfile}
                members={allMembers}
                posts={state.posts}
                currentUserId={myAccount?.id}
                setToast={setToast}
              />
            )}

            {(view === "creators" || view === "rising") && (
              <CreatorDirectoryView
                members={allMembers}
                posts={state.posts}
                onPick={setProfile}
                setToast={setToast}
                initialFilter={
                  view === "rising"
                    ? "rising"
                    : "all"
                }
              />
            )}

            {(view === "messages" || view === "moderation" || view === "integrations") && (
              <div className="space-y-3 px-4 py-8">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">StreamCore</p>
                <h1 className="text-2xl font-black">{view.replaceAll("-", " ")}</h1>
                <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                  No connected data source is configured for this section yet. Nothing simulated is being displayed.
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
              <ErrorBoundary fallbackTitle="Control Center error">
                <AdminView
                  state={state}
                  allMembers={allMembers}
                  accessToken={session.access_token}
                  addMember={addMember}
                  removeMember={removeMember}
                  addPost={addPost}
                  setStats={setStats}
                  setCommunity={setCommunity}
                  updateMember={updateMember}
                  notify={setToast}
                  addChannel={addChannel}
                  removeChannel={removeChannel}
                  generateClips={generateManagedMemberClips}
                  crm={
                    <MembersCRM
                      accounts={accounts}
                      isAdmin={isAdmin}
                      refresh={refresh}
                      notify={setToast}
                    />
                  }
                />
              </ErrorBoundary>
            )}
          </div>
          {typingName && (view === "general" || view.startsWith("channel:")) && (
            <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground bg-background/95 border-t border-border/40 backdrop-blur-md transition-all">
              <span className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
              </span>
              <span>
                <strong className="text-foreground">{typingName}</strong> is typing…
              </span>
            </div>
          )}
          {view === "general" && (
            <Composer
              authors={postingAuthors}
              authorId={selectedChatAuthor}
              setAuthorId={setChatAuthor}
              replyTo={replyTo}
              clearReply={() => setReplyTo(null)}
              onSend={async (post: PostInput) => {
                await sendCommunityPost(post);
              }}
              onTyping={broadcastTyping}
            />
          )}
          {view.startsWith("channel:") && (() => { const channel = state.channels.find((item) => `channel:${item.id}` === view); return channel?.allowChat && postingAuthors.length ? <Composer authors={postingAuthors} authorId={selectedChatAuthor} setAuthorId={setChatAuthor} replyTo={replyTo} clearReply={() => setReplyTo(null)} onSend={async (post: PostInput) => { await sendCommunityPost({ ...post, channel: channel.name }); }} onTyping={broadcastTyping} channel={channel.name} /> : null; })()}
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
            {isAdmin && <button
              type="button"
              onClick={() => void createAndCopyInvite()}
              disabled={inviteBusy}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold hover:bg-accent/70"
            >
              {inviteBusy ? "Creating invite..." : "+ Invite members 🔗"}
            </button>}

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

      <ProfileModal
        member={profile}
        onClose={() => setProfile(null)}
        isAdmin={isAdmin}
        isPinned={profile ? effectivePinnedIds.includes(profile.id) : false}
        onTogglePin={isAdmin ? togglePinStreamer : undefined}
      />
      {pinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPinModalOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-popover p-5 shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-lg font-black flex items-center gap-2">
                  <span>📌</span> Pin Streamers to Left Rail
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pin your favorite creators for quick 1-click access and live status indicators.
                </p>
              </div>
              <button
                onClick={() => setPinModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm hover:bg-accent/80 font-bold"
              >
                ×
              </button>
            </div>

            <div className="py-3">
              <input
                value={pinSearch}
                onChange={(e) => setPinSearch(e.target.value)}
                placeholder="Search creators by name, handle, or platform..."
                className="w-full rounded-xl bg-input px-3.5 py-2 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-96">
              {allMembers
                .filter((m) =>
                  `${m.name} ${m.handle} ${m.platform}`.toLowerCase().includes(pinSearch.toLowerCase())
                )
                .map((m) => {
                  const isPinned = effectivePinnedIds.includes(m.id);
                  const isLive = m.status === "live";
                  const isOnline = m.status === "online";

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-background p-2.5 border border-border/50 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <Avatar member={m} size={40} showStatus={false} />
                          <span
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                              isLive ? "bg-live animate-ping" : isOnline ? "bg-online" : "bg-muted-foreground/60"
                            }`}
                          />
                          <span
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                              isLive ? "bg-live" : isOnline ? "bg-online" : "bg-muted-foreground/60"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <strong className="text-sm font-bold truncate">{m.name}</strong>
                            {isLive && (
                              <span className="rounded bg-live px-1.5 py-0.2 text-[9px] font-extrabold text-white uppercase">
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{m.handle} · {m.platform}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => togglePinStreamer(m.id)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          isPinned
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-accent text-foreground hover:bg-accent/80"
                        }`}
                      >
                        {isPinned ? "✓ Pinned" : "📌 Pin"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      {channelDetailsOpen && <ChannelDetails members={allMembers} posts={state.posts} onClose={() => setChannelDetailsOpen(false)} onPickMember={(member) => { setChannelDetailsOpen(false); setProfile(member); }} />}

      {/* Community Invite Preview Screen & 5s Delayed Signup Modal */}
      {showInviteModal && (
        <InviteLandingModal
          invite={activeInvite}
          allMembers={allMembers}
          onNavigateView={(targetView) => {
            setView(targetView as View);
            setShowInviteModal(false);
          }}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            refresh();
            setToast("🎉 Welcome to StreamCore!");
          }}
          isAuthenticated={Boolean(session?.user)}
        />
      )}

      {/* Mandatory Onboarding Flow: Rules -> Profile Setup -> Channel Authorization */}
      {needsOnboarding && userId && (
        <MandatoryOnboardingModal
          userId={userId}
          initialName={myAccount?.display_name || ""}
          initialHandle={myAccount?.handle || ""}
          communityRules={state.community.rules}
          allMembers={allMembers}
          onCompleted={() => {
            setOnboardingDismissed(true);
            refresh();
            setView("general");
            setToast("🎉 Channel connected! Welcome announcement posted in #general.");
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-popover px-4 py-2 text-sm font-semibold shadow-elevated">
          {toast}
        </div>
      )}
    </div>
  );
}

function HomeDashboard({ state, liveMembers, members, posts, onPick, onOpen }: { state: ReturnType<typeof useCommunity>["state"]; liveMembers: Member[]; members: Member[]; posts: Post[]; onPick: (member: Member) => void; onOpen: (view: View) => void }) {
  const trending = posts.filter((post) => post.channel === "trending").sort((a, b) => b.time - a.time).slice(0, 3);
  const announcements = posts.filter((post) => post.channel === "announcements").sort((a, b) => b.time - a.time).slice(0, 3);
  const clips = posts.filter((post) => post.channel === "clips").sort((a, b) => b.time - a.time).slice(0, 4);
  const creatorActivity = members
    .map((member) => ({
      member,
      posts: posts.filter((post) => post.authorId === member.id).length,
    }))
    .sort((left, right) => {
      if (left.member.status === "live" && right.member.status !== "live") return -1;
      if (right.member.status === "live" && left.member.status !== "live") return 1;
      return (right.member.followers ?? 0) - (left.member.followers ?? 0) || right.posts - left.posts;
    })
    .slice(0, 3);
  const onlineMembers = members.filter((member) => member.status === "online" || member.status === "live").length;
  const partnerCount = members.filter((member) => member.role === "partner").length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 lg:px-7">
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-[radial-gradient(circle_at_top_right,_oklch(0.577_0.209_273.9_/_0.42),_transparent_44%),linear-gradient(135deg,_oklch(0.25_0.018_270),_oklch(0.17_0.015_270))] p-6 lg:p-9">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-black tracking-[0.25em] text-primary">STREAMCORE</p>
          <h1 className="mt-3 text-4xl font-black leading-[.95] sm:text-6xl">One network.<br />Real creators.</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">The established StreamCore experience, powered by current Twitch streams, real community posts and creator clips.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onOpen("creators")} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-elevated">Explore creators</button>
            <button onClick={() => onOpen("live-now")} className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm font-bold backdrop-blur hover:bg-accent">Watch live now</button>
          </div>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
          {[
            [members.length.toLocaleString(), "Members"],
            [onlineMembers.toLocaleString(), "Online now"],
            [liveMembers.length.toLocaleString(), "Streams live"],
            [posts.length.toLocaleString(), "Recent posts"],
          ].map(([value, label]) => <div key={label} className="bg-background/45 px-4 py-4"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</p></div>)}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-popover p-4">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black tracking-widest text-live">● LIVE NOW</p><h2 className="text-xl font-extrabold">Streamers live in the network</h2></div><button onClick={() => onOpen("live-now")} className="text-sm font-bold text-primary">View all →</button></div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {liveMembers.slice(0, 6).map((member) => <button key={member.id} onClick={() => onPick(member)} className="w-44 shrink-0 overflow-hidden rounded-xl bg-background text-left hover:ring-2 hover:ring-primary"><div className="h-20 bg-accent bg-cover bg-center" style={member.banner ? { backgroundImage: `url(${member.banner})` } : undefined} /><div className="-mt-5 px-3 pb-3"><Avatar member={member} size={42} showStatus={false} /><p className="mt-2 truncate text-sm font-bold">{member.name}</p><p className="truncate text-xs text-live">● {(member.viewerCount ?? 0).toLocaleString()} viewers · {member.gameName || member.platform}</p></div></button>)}
          {!liveMembers.length && <p className="px-2 py-6 text-sm text-muted-foreground">No connected creator is live right now.</p>}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <section className="rounded-2xl border border-border bg-popover p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black tracking-widest text-orange-400">🔥 TRENDING</p><h2 className="text-xl font-extrabold">Admin trending posts</h2></div><button onClick={() => onOpen("trending")} className="text-sm font-bold text-primary">Open feed →</button></div>
          <div className="space-y-2">{trending.map((post) => { const author=members.find((member)=>member.id===post.authorId); const reactions=Object.values(post.reactions??{}).reduce((sum,count)=>sum+count,0)+(post.likes?.length??0); return <article key={post.id} className="rounded-xl bg-background p-3"><div className="flex gap-3"><Avatar member={author??{name:"StreamCore",avatar:"",status:"offline"}} size={36} showStatus={false}/><div className="min-w-0"><p className="text-sm font-bold">{post.text.split("\n")[0] || "Trending post"}</p><p className="mt-1 text-xs text-muted-foreground">{author?.name??"StreamCore"} · {timeAgo(post.time)} · {reactions} reactions</p></div></div></article>; })}{!trending.length&&<p className="rounded-xl bg-background p-5 text-sm text-muted-foreground">No real trending posts yet.</p>}</div>
        </section>
        <section className="rounded-2xl border border-border bg-popover p-4">
          <p className="text-xs font-black tracking-widest text-primary">CREATOR ACTIVITY</p><h2 className="mt-1 text-xl font-extrabold">Current network leaders</h2><p className="mt-1 text-xs text-muted-foreground">Sorted only by live state, synced followers and real post counts.</p>
          <div className="mt-3 space-y-2">{creatorActivity.map(({member,posts:postCount},index)=><button key={member.id} onClick={()=>onPick(member)} className="flex w-full items-center gap-3 rounded-xl bg-background p-3 text-left hover:bg-accent"><span className="text-xs font-black">#{index+1}</span><Avatar member={member} size={36}/><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{member.name}</strong><span className="block truncate text-xs text-muted-foreground">{member.followers?.toLocaleString()??"Not synced"} followers · {postCount} posts</span></span></button>)}{!creatorActivity.length&&<p className="text-sm text-muted-foreground">No creators loaded.</p>}</div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-popover p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black tracking-widest text-pink-400">🎬 CLIPS</p><h2 className="text-xl font-extrabold">Real Twitch and member clips</h2></div><button onClick={()=>onOpen("channel:clips")} className="text-sm font-bold text-primary">Browse clips →</button></div><div className="mt-3 grid grid-cols-2 gap-2">{clips.map((post)=><div key={post.id} className="aspect-video overflow-hidden rounded-xl bg-accent">{post.image?<img src={post.image} alt="Creator clip" className="h-full w-full object-cover"/>:post.video?<video src={post.video} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-xs text-muted-foreground">Clip link</div>}</div>)}{!clips.length&&<div className="col-span-2 rounded-xl bg-background p-5 text-sm text-muted-foreground">No real clips have been posted yet.</div>}</div></section>
        <section className="rounded-2xl border border-border bg-popover p-5"><p className="text-xs font-black tracking-widest text-emerald-400">NETWORK DATA</p><h2 className="mt-1 text-xl font-extrabold">Connected community totals</h2><div className="mt-5 grid grid-cols-2 gap-3"><Metric value={members.length.toLocaleString()} label="Creators"/><Metric value={partnerCount.toLocaleString()} label="Partners"/><Metric value={clips.length.toLocaleString()} label="Recent clips"/><Metric value={liveMembers.length.toLocaleString()} label="Live now"/></div></section>
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <TopCategoriesWidget members={members} posts={posts}/>
        <div className="rounded-2xl border border-border bg-popover p-5"><p className="text-xs font-black tracking-widest text-live">📣 ANNOUNCEMENTS</p><h2 className="mt-1 text-xl font-extrabold">Published by StreamCore</h2><div className="mt-4 space-y-2">{announcements.map((post)=><button key={post.id} onClick={()=>onOpen("announcements")} className="flex w-full items-center gap-3 rounded-xl bg-background p-3 text-left text-sm font-semibold hover:bg-accent"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/20 text-primary">✦</span><span className="min-w-0 flex-1 truncate">{post.text.split("\n")[0]||"Announcement"}<small className="mt-1 block text-xs font-normal text-muted-foreground">{timeAgo(post.time)}</small></span><span>→</span></button>)}{!announcements.length&&<p className="rounded-xl bg-background p-5 text-sm text-muted-foreground">No announcements have been published.</p>}</div></div>
      </section>

      <section className="rounded-2xl border border-primary/30 bg-[radial-gradient(circle_at_90%_50%,_oklch(0.577_0.209_273.9_/_0.18),_transparent_35%),_oklch(0.14_0.025_255)] p-6 sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold">The StreamCore design, connected to live data</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse {members.length.toLocaleString()} connected creators without demo totals or duplicate category art.</p>
        </div>
        <button onClick={() => onOpen("creators")} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground sm:mt-0">Explore the network</button>
      </section>

      <footer className="grid gap-6 border-t border-border pt-6 text-xs text-muted-foreground sm:grid-cols-4">
        <div><p className="font-black tracking-widest text-foreground">◈ STREAMCORE</p><p className="mt-2">A creator community for live discovery, conversations and collaboration.</p></div>
        <div><p className="font-bold text-foreground">COMMUNITY</p><p className="mt-2">Guidelines</p><p>Rules</p><p>Support</p></div>
        <div><p className="font-bold text-foreground">CREATORS</p><p className="mt-2">Directory</p><p>Live now</p><p>Clips</p></div>
        <div><p className="font-bold text-foreground">DATA</p><p className="mt-2">Twitch Helix</p><p>Supabase Realtime</p><p>Secure AI host</p></div>
      </footer>
    </div>
  );
}

function LiveNowCommunityView({ members, onPick }: { members: Member[]; onPick: (member: Member) => void }) {
  const [activeMember, setActiveMember] = useState<Member | null>(() => members[0] ?? null);

  useEffect(() => {
    if (members.length > 0 && (!activeMember || !members.some((m) => m.id === activeMember.id))) {
      setActiveMember(members[0] ?? null);
    }
  }, [members, activeMember]);

  const featured = activeMember ?? members[0] ?? null;

  return (
    <div className="space-y-6 px-4 py-6">
      <header>
        <h1 className="text-3xl font-black">🔴 LIVE NOW</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creators currently live from your community. Streams begin automatically muted.
        </p>
      </header>

      {featured && (
        <section className="overflow-hidden rounded-2xl border border-primary/40 bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-background/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-destructive px-2 py-0.5 text-xs font-black text-white shadow animate-pulse">
                🔴 LIVE
              </span>
              <span className="rounded bg-accent px-2 py-0.5 text-xs font-bold text-foreground">
                {featured.platform}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Playing live for community
              </span>
            </div>
            <span className="text-xs font-bold text-primary">
              Auto-Playing Muted
            </span>
          </div>
          <div className="aspect-video w-full bg-black">
            <LiveStreamEmbed key={featured.id} member={featured} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3.5">
              <Avatar member={featured} size={48} />
              <div>
                <h2 className="text-lg font-black text-foreground">{featured.name}</h2>
                <p className="text-xs text-muted-foreground">{featured.handle}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {featured.link && (
                <a
                  href={featured.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold hover:bg-accent"
                >
                  Open on {featured.platform} ↗
                </a>
              )}
              <button
                onClick={() => onPick(featured)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                View Profile
              </button>
            </div>
          </div>
        </section>
      )}

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          All Live Creators ({members.length})
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const isCurrent = featured?.id === member.id;
            return (
              <article
                key={member.id}
                onClick={() => setActiveMember(member)}
                className={`group cursor-pointer overflow-hidden rounded-2xl border bg-popover transition-all hover:border-primary ${
                  isCurrent ? "ring-2 ring-primary border-primary shadow-elevated" : "border-border"
                }`}
              >
                <div
                  className="relative h-36 bg-accent bg-cover bg-center"
                  style={member.banner ? { backgroundImage: `url(${member.banner})` } : undefined}
                >
                  <span className="absolute left-3 top-3 rounded bg-destructive px-2 py-0.5 text-[10px] font-black text-white shadow">
                    LIVE
                  </span>
                  {isCurrent && (
                    <span className="absolute right-3 top-3 rounded bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground shadow">
                      NOW PLAYING
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar member={member} size={40} />
                      <div>
                        <p className="font-bold text-foreground group-hover:text-primary">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.handle}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPick(member);
                      }}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
                    >
                      Profile
                    </button>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {member.bio || "Live community creator"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {!members.length && (
        <p className="text-sm text-muted-foreground">No community creators are live right now.</p>
      )}
    </div>
  );
}

function LiveStreamEmbed({ member }: { member: Member }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const login = (member.handle || "").replace(/^@/, "").trim().toLowerCase() ||
    (member.link ? member.link.split("/").filter(Boolean).pop()?.toLowerCase() : "");

  const platform = (member.platform || "").toLowerCase();

  const hostname = typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost";
  const parentDomains = Array.from(
    new Set([hostname, "localhost", "127.0.0.1", "peak-pylon.vercel.app"])
  ).filter(Boolean);

  useEffect(() => {
    if (platform !== "twitch" || !login || !containerRef.current) return;
    let isDisposed = false;

    const setupTwitch = () => {
      const Twitch = (window as any).Twitch;
      if (!Twitch?.Player || !containerRef.current || isDisposed) return;

      containerRef.current.replaceChildren();
      const mount = document.createElement("div");
      mount.id = `twitch-player-${login}`;
      mount.className = "h-full w-full";
      containerRef.current.appendChild(mount);

      try {
        const player = new Twitch.Player(mount.id, {
          channel: login,
          parent: parentDomains,
          width: "100%",
          height: "100%",
          autoplay: true,
          muted: true,
          playsinline: true,
        });
        playerRef.current = player;

        const triggerPlay = () => {
          if (isDisposed) return;
          try {
            player.setMuted(true);
            player.setVolume(0);
            player.play();
            setIsPlaying(true);
          } catch {
            // ignore
          }
        };

        player.addEventListener?.(Twitch.Player.READY, () => {
          triggerPlay();
          setTimeout(triggerPlay, 300);
          setTimeout(triggerPlay, 1000);
        });

        player.addEventListener?.(Twitch.Player.PLAYING, () => {
          setIsPlaying(true);
        });
      } catch (err) {
        console.error("Twitch SDK mount error", err);
      }
    };

    if ((window as any).Twitch?.Player) {
      setupTwitch();
    } else {
      const scriptId = "twitch-player-sdk";
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://player.twitch.tv/js/embed/v1.js";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", setupTwitch, { once: true });
    }

    return () => {
      isDisposed = true;
    };
  }, [login, platform, hostname]);

  if (platform === "youtube") {
    const ytVideoId = member.link?.match(/(?:v=|youtu\.be\/|\/live\/)([a-zA-Z0-9_-]+)/)?.[1] || "";
    return (
      <iframe
        src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&mute=1&playsinline=1`}
        title={`${member.name} Live Stream`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    );
  }

  if (platform === "kick") {
    return (
      <iframe
        src={`https://player.kick.com/${encodeURIComponent(login)}?autoplay=true&muted=true`}
        title={`${member.name} Live Stream`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    );
  }

  const twitchIframeSrc = `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${parentDomains.join("&parent=")}&autoplay=true&muted=true`;

  return (
    <div
      ref={containerRef}
      onClick={() => {
        try {
          playerRef.current?.setMuted(false);
          playerRef.current?.play();
        } catch {
          // ignore
        }
      }}
      className="relative h-full w-full bg-black [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full cursor-pointer"
    >
      <iframe
        src={twitchIframeSrc}
        title={`${member.name} Twitch Live Stream`}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}


function TrendingCommunityView({
  posts,
  members,
  allMemberList,
  onPick,
  isAdmin,
  currentUserId,
  onCreate,
  onUpdate,
  onDelete,
  setToast,
  title,
  subtitle,
  formLabel,
}: {
  posts: Post[];
  members: Map<string, Member>;
  allMemberList: Member[];
  onPick: (member: Member) => void;
  isAdmin: boolean;
  currentUserId?: string | undefined;
  onCreate: (post: Pick<PostInput, "text" | "image" | "time">) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Post>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  setToast: (msg: string) => void;
  title?: string;
  subtitle?: string;
  formLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const [postHeadline, setPostHeadline] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [publishedAt, setPublishedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const insert = (value: string) => {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? draft.length;
    const end = editor?.selectionEnd ?? start;
    setDraft(`${draft.slice(0, start)}${value}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      if (editor) {
        editor.focus();
        editor.setSelectionRange(start + value.length, start + value.length);
      }
    });
  };

  const wrap = (left: string, right: string) => {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? draft.length;
    const end = editor?.selectionEnd ?? start;
    const selected = draft.slice(start, end) || "text";
    const value = `${left}${selected}${right}`;
    setDraft(`${draft.slice(0, start)}${value}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      if (editor) {
        editor.focus();
        editor.setSelectionRange(start + left.length, start + left.length + selected.length);
      }
    });
  };


  const toggleLike = async (post: Post) => {
    const userKey = currentUserId || "guest-user";
    const currentLikes = post.likes ?? [];
    const hasLiked = currentLikes.includes(userKey);
    const updatedLikes = hasLiked
      ? currentLikes.filter((id) => id !== userKey)
      : [...currentLikes, userKey];

    await onUpdate(post.id, { likes: updatedLikes });
  };

  const handleShare = async (post: Post) => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Post link copied to clipboard!");
    } catch {
      setToast("Shared post link!");
    }
    await onUpdate(post.id, { shares: (post.shares ?? 0) + 1 });
  };

  const handleAddComment = async (postId: string) => {
    const text = commentDrafts[postId]?.trim();
    if (!text) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const authorId = currentUserId || allMemberList[0]?.id || "community-user";
    const newComment = {
      id: Math.random().toString(36).slice(2, 9),
      authorId,
      text,
      time: Date.now(),
    };

    await onUpdate(postId, {
      comments: [...(post.comments ?? []), newComment],
    });

    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    setToast("Comment added!");
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const updated = (post.comments ?? []).filter((c) => c.id !== commentId);
    await onUpdate(postId, { comments: updated });
    setToast("Comment removed");
  };

  return (
    <div className="space-y-6 px-4 py-6">
      <header>
        <h1 className="text-3xl font-black">{title || "🔥 TRENDING"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {subtitle || "Admin announcements, featured creator updates, and community discussions."}
        </p>
      </header>

      {isAdmin && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!postHeadline.trim() && !draft.trim()) return;
            setBusy(true);
            try {
              const uploaded = attachment ? await uploadCommunityMedia(attachment) : "";
              await onCreate({
                text: postHeadline.trim() ? `${postHeadline.trim()}\n\n${draft.trim()}` : draft.trim(),
                image: uploaded,
                time: publishedAt ? new Date(publishedAt).getTime() : Date.now(),
              });
              setPostHeadline("");
              setDraft("");
              setAttachment(null);
              setPublishedAt("");
              setToast("Post published successfully!");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-2xl border border-primary/40 bg-popover p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {formLabel || "Create trending post · Admin Only"}
            </p>
          </div>
          <input
            value={postHeadline}
            onChange={(event) => setPostHeadline(event.target.value)}
            className="mb-2 w-full rounded-xl bg-input px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
            placeholder="Post headline / title..."
          />
          <div className="mb-2 flex flex-wrap gap-1.5 border-y border-border py-2">
            <button
              type="button"
              onClick={() => wrap("**", "**")}
              className="rounded px-2.5 py-1 text-xs font-black hover:bg-accent"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => wrap("*", "*")}
              className="rounded px-2.5 py-1 text-xs italic hover:bg-accent"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => insert("## ")}
              className="rounded px-2.5 py-1 text-xs font-bold hover:bg-accent"
            >
              H
            </button>
            <button
              type="button"
              onClick={() => {
                const url = window.prompt("Link URL");
                if (url) insert(url);
              }}
              className="rounded px-2.5 py-1 text-xs hover:bg-accent"
            >
              🔗 Link
            </button>
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              className="rounded px-2.5 py-1 text-xs font-semibold hover:bg-accent"
            >
              🖼 Add inline image
            </button>
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const url = await uploadCommunityMedia(file);
                  insert(`\n![image](${url})\n`);
                } finally {
                  setBusy(false);
                  event.target.value = "";
                }
              }}
            />
          </div>
          <textarea
            ref={editorRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={6}
            className="w-full rounded-xl bg-input p-3 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary"
            placeholder="Write the announcement or discussion text. Use Add image to place images inline..."
          />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-xs font-medium text-muted-foreground">
                Published Date & Time
                <input
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(event) => setPublishedAt(event.target.value)}
                  className="mt-1 block rounded-lg bg-input px-2.5 py-1.5 text-xs text-foreground outline-none"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Featured Cover Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                  className="mt-1 block text-xs"
                />
              </label>
            </div>
            <button
              disabled={busy}
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? "Publishing…" : "Publish Post"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {posts.map((post) => {
          const author = members.get(post.authorId);
          const isLikedByMe = (post.likes ?? []).includes(currentUserId || "guest-user");
          const totalLikes = (post.likes?.length ?? 0) + Object.values(post.reactions ?? {}).reduce((a, b) => a + b, 0);
          const totalShares = post.shares ?? 0;
          const totalComments = post.comments?.length ?? 0;
          const isCommentsOpen = !!expandedComments[post.id];

          return (
            <article
              key={post.id}
              className="rounded-2xl border border-border bg-popover p-6 shadow-sm transition-all hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  onClick={() => author && onPick(author)}
                  className="flex items-center gap-3 text-left"
                >
                  <Avatar
                    member={author ?? { name: "Community Admin", avatar: "", status: "online" }}
                    size={46}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-foreground hover:underline">
                        {author?.name ?? "Community Admin"}
                      </strong>
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
                        ADMIN
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.time).toLocaleString(undefined, {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </button>

                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingPost(post)}
                      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to delete this trending post?")) {
                          await onDelete(post.id);
                          setToast("Post deleted successfully");
                        }
                      }}
                      className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <RichPostContent text={post.text} />
                {post.image && (
                  <img
                    src={post.image}
                    alt="Trending attachment"
                    className="mt-4 max-h-[32rem] w-full rounded-2xl object-cover shadow-sm"
                  />
                )}
              </div>

              {/* Engagement Stats and Actions */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleLike(post)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      isLikedByMe
                        ? "bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/40"
                        : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span>{isLikedByMe ? "❤️" : "♡"}</span>
                    <span>{totalLikes} {totalLikes === 1 ? "Like" : "Likes"}</span>
                  </button>

                  <button
                    onClick={() =>
                      setExpandedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                    }
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                      isCommentsOpen
                        ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                        : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span>💬</span>
                    <span>{totalComments} {totalComments === 1 ? "Comment" : "Comments"}</span>
                  </button>

                  <button
                    onClick={() => handleShare(post)}
                    className="flex items-center gap-1.5 rounded-xl bg-background px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <span>↗</span>
                    <span>{totalShares} {totalShares === 1 ? "Share" : "Shares"}</span>
                  </button>
                </div>

                {post.likes && post.likes.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="flex -space-x-1.5 overflow-hidden">
                      {post.likes.slice(0, 4).map((memberId, idx) => {
                        const m = members.get(memberId);
                        return (
                          <span
                            key={`${memberId}-${idx}`}
                            className="inline-block h-5 w-5 rounded-full ring-2 ring-popover"
                          >
                            <Avatar
                              member={m ?? { name: "Creator", avatar: "", status: "online" }}
                              size={20}
                              showStatus={false}
                            />
                          </span>
                        );
                      })}
                    </span>
                    <span className="ml-1 text-[11px]">
                      Liked by {post.likes.length} creators
                    </span>
                  </div>
                )}
              </div>

              {/* Comments Thread Section */}
              {isCommentsOpen && (
                <div className="mt-4 rounded-xl border border-border/80 bg-background/50 p-4">
                  <h4 className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Comments ({totalComments})
                  </h4>

                  <div className="space-y-3">
                    {(post.comments ?? []).map((comment) => {
                      const commentAuthor = members.get(comment.authorId);
                      return (
                        <div
                          key={comment.id}
                          className="flex items-start justify-between gap-3 rounded-lg bg-popover p-3 text-xs shadow-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <Avatar
                              member={
                                commentAuthor ?? { name: "Community Member", avatar: "", status: "online" }
                              }
                              size={28}
                              showStatus={false}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">
                                  {commentAuthor?.name ?? "Community Creator"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {timeAgo(comment.time)}
                                </span>
                              </div>
                              <p className="mt-1 text-foreground/90">{comment.text}</p>
                            </div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteComment(post.id, comment.id)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Delete comment"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!post.comments?.length && (
                      <p className="py-2 text-xs text-muted-foreground">
                        No comments yet. Start the conversation!
                      </p>
                    )}
                  </div>

                  {/* Add Comment Input */}
                  <div className="mt-3.5 flex gap-2">
                    <input
                      value={commentDrafts[post.id] || ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleAddComment(post.id);
                        }
                      }}
                      placeholder="Write a comment as creator or admin..."
                      className="w-full rounded-xl bg-input px-3.5 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!posts.length && <p className="text-sm text-muted-foreground">No trending posts yet.</p>}

      {/* Edit Trending Post Modal */}
      {editingPost && (
        <EditTrendingPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={async (patch) => {
            await onUpdate(editingPost.id, patch);
            setEditingPost(null);
            setToast("Post updated successfully!");
          }}
        />
      )}

    </div>
  );
}

function EditTrendingPostModal({
  post,
  onClose,
  onSave,
}: {
  post: Post;
  onClose: () => void;
  onSave: (patch: Partial<Post>) => Promise<void>;
}) {
  const [text, setText] = useState(post.text);
  const [timeStr, setTimeStr] = useState(() => {
    const d = new Date(post.time);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [imageUrl, setImageUrl] = useState(post.image || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-popover p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-black text-foreground">✏️ Edit Trending Post</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Post Content / Body (Markdown)
            </label>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1.5 w-full rounded-xl bg-input p-3 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                📅 Change Published Date & Time
              </label>
              <input
                type="datetime-local"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-input px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Modifies the display timestamp on the post.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                🖼 Featured Image URL
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-input px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-bold hover:bg-accent/80"
                >
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const url = await uploadCommunityMedia(file);
                      setImageUrl(url);
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {imageUrl && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Image Preview:</p>
              <img
                src={imageUrl}
                alt="Preview"
                className="mt-1 max-h-48 rounded-xl object-cover"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || uploading}
            onClick={async () => {
              setSaving(true);
              try {
                const newTimestamp = timeStr ? new Date(timeStr).getTime() : post.time;
                await onSave({
                  text: text.trim(),
                  image: imageUrl.trim(),
                  time: newTimestamp,
                });
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}


type CommunityEvent = {
  isEvent: true;
  title: string;
  category: string;
  eventDate: number;
  hostId: string;
  streamUrl: string;
  description: string;
};

function parseCommunityEvent(post: Post): CommunityEvent {
  try {
    if (post.text.startsWith("{") && post.text.includes('"isEvent"')) {
      const parsed = JSON.parse(post.text);
      return {
        isEvent: true,
        title: parsed.title || "Community Event",
        category: parsed.category || "Community Event",
        eventDate: parsed.eventDate || post.time || Date.now(),
        hostId: parsed.hostId || post.authorId,
        streamUrl: parsed.streamUrl || "",
        description: parsed.description || "",
      };
    }
  } catch {}

  const lines = post.text.split("\n");
  const firstLine = lines[0] || "Community Event";
  return {
    isEvent: true,
    title: firstLine.replace(/^#+\s*/, ""),
    category: "Special Event",
    eventDate: post.time || Date.now(),
    hostId: post.authorId,
    streamUrl: "",
    description: lines.slice(1).join("\n").trim() || post.text,
  };
}

function EventsCommunityView({
  posts,
  members,
  allMemberList,
  onPick,
  isAdmin,
  currentUserId,
  onCreate,
  onUpdate,
  onDelete,
  setToast,
}: {
  posts: Post[];
  members: Map<string, Member>;
  allMemberList: Member[];
  onPick: (member: Member) => void;
  isAdmin: boolean;
  currentUserId?: string | undefined;
  onCreate: (post: Pick<PostInput, "text" | "image" | "time">) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Post>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  setToast: (msg: string) => void;
}) {
  const [eventTitle, setEventTitle] = useState("");
  const [eventDateStr, setEventDateStr] = useState(() => {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    next.setMinutes(0, 0, 0);
    return next.toISOString().slice(0, 16);
  });
  const [hostId, setHostId] = useState(allMemberList[0]?.id || "");
  const [category, setCategory] = useState("🎮 Tournament");
  const [streamUrl, setStreamUrl] = useState("");
  const [description, setDescription] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "upcoming">("all");

  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return setToast("Please enter an event title");
    setBusy(true);
    try {
      const bannerUrl = posterFile ? await uploadCommunityMedia(posterFile) : "";
      const chosenHostId = hostId || allMemberList[0]?.id || "community-admin";
      const eventTimestamp = eventDateStr ? new Date(eventDateStr).getTime() : Date.now();

      const eventPayload: CommunityEvent = {
        isEvent: true,
        title: eventTitle.trim(),
        category,
        eventDate: eventTimestamp,
        hostId: chosenHostId,
        streamUrl: streamUrl.trim(),
        description: description.trim(),
      };

      await onCreate({
        text: JSON.stringify(eventPayload),
        image: bannerUrl,
        time: eventTimestamp,
      });

      setEventTitle("");
      setDescription("");
      setStreamUrl("");
      setPosterFile(null);
      setToast("🎉 Community Event published successfully!");
    } finally {
      setBusy(false);
    }
  };

  const toggleRsvp = async (post: Post) => {
    const userKey = currentUserId || "guest-user";
    const currentLikes = post.likes ?? [];
    const hasRsvped = currentLikes.includes(userKey);
    const updated = hasRsvped
      ? currentLikes.filter((id) => id !== userKey)
      : [...currentLikes, userKey];

    await onUpdate(post.id, { likes: updated });
    setToast(hasRsvped ? "RSVP cancelled" : "🎉 You're going to this event!");
  };

  return (
    <div className="space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">📅 COMMUNITY EVENTS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tournaments, collab raid trains, creator stages, and live gaming showdowns.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-popover hover:bg-accent text-muted-foreground"
            }`}
          >
            All Events ({posts.length})
          </button>
          <button
            onClick={() => setActiveFilter("upcoming")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeFilter === "upcoming" ? "bg-primary text-primary-foreground" : "bg-popover hover:bg-accent text-muted-foreground"
            }`}
          >
            ⏳ Upcoming
          </button>
        </div>
      </header>

      {isAdmin && (
        <form onSubmit={submitEvent} className="rounded-2xl border border-primary/40 bg-popover p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Create Community Event · Admin Only
            </p>
            <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-primary">
              LIVE BROADCAST TOOL
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Event Title *
              </label>
              <input
                required
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="e.g. 🏆 Apex Legends 3v3 Creator Scrims"
                className="w-full rounded-xl bg-input px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Event Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-input px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="🎮 Tournament">🎮 Tournament</option>
                <option value="🚂 Raid Train">🚂 Raid Train</option>
                <option value="🎙️ Creator Podcast">🎙️ Creator Podcast</option>
                <option value="⭐ Community Game Night">⭐ Community Game Night</option>
                <option value="🏆 Championship">🏆 Championship</option>
                <option value="🎉 Special Event">🎉 Special Event</option>
                <option value="📺 Watch Party">📺 Watch Party</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={eventDateStr}
                onChange={(e) => setEventDateStr(e.target.value)}
                className="w-full rounded-xl bg-input px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Featured Host Creator
              </label>
              <select
                value={hostId}
                onChange={(e) => setHostId(e.target.value)}
                className="w-full rounded-xl bg-input px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
              >
                {allMemberList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (@{m.handle.replace(/^@/, "")})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Stream / Room Link
              </label>
              <input
                type="url"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://twitch.tv/..."
                className="w-full rounded-xl bg-input px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Event Description & Schedule
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details about the tournament format, rules, prizes, and schedule..."
              className="w-full rounded-xl bg-input p-3 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
            <label className="text-xs font-medium text-muted-foreground">
              Event Cover Banner
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
                className="mt-1 block text-xs"
              />
            </label>
            <button
              disabled={busy}
              type="submit"
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? "Publishing Event…" : "📅 Publish Community Event"}
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      <div className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => {
          const evt = parseCommunityEvent(post);
          const host = members.get(evt.hostId) || allMemberList.find((m) => m.id === evt.hostId);
          const rsvps = post.likes ?? [];
          const isGoing = rsvps.includes(currentUserId || "guest-user");
          const isLiveNow = host?.status === "live" || (Date.now() >= evt.eventDate && Date.now() <= evt.eventDate + 3 * 3600 * 1000);
          const dateObj = new Date(evt.eventDate);
          const dateFormatted = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

          return (
            <article
              key={post.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-sm hover:border-primary/50 transition-all"
            >
              {post.image ? (
                <div className="relative h-44 w-full overflow-hidden bg-accent">
                  <img src={post.image} alt={evt.title} className="h-full w-full object-cover" />
                  <span className="absolute top-3 left-3 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-extrabold text-white backdrop-blur-sm">
                    {evt.category}
                  </span>
                  {isLiveNow ? (
                    <span className="absolute top-3 right-3 rounded-lg bg-live px-2.5 py-1 text-[10px] font-black text-white uppercase tracking-wider animate-pulse">
                      ● LIVE EVENT NOW
                    </span>
                  ) : (
                    <span className="absolute top-3 right-3 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                      📅 {dateFormatted}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-between bg-gradient-to-r from-primary/30 via-accent to-popover px-5">
                  <span className="rounded-lg bg-background/80 px-2.5 py-1 text-xs font-bold text-foreground">
                    {evt.category}
                  </span>
                  {isLiveNow ? (
                    <span className="rounded-lg bg-live px-2.5 py-1 text-[10px] font-black text-white uppercase tracking-wider animate-pulse">
                      ● LIVE EVENT NOW
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">
                      📅 {dateFormatted}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                <div>
                  <h2 className="text-lg font-black text-foreground">{evt.title}</h2>
                  {evt.description && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                      {evt.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  {host ? (
                    <button
                      onClick={() => onPick(host)}
                      className="flex items-center gap-2 text-left hover:opacity-85"
                    >
                      <Avatar member={host} size={32} showStatus={true} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{host.name}</p>
                        <p className="text-[10px] text-muted-foreground">Host · {host.platform}</p>
                      </div>
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">StreamCore Community</span>
                  )}

                  <div className="flex items-center gap-2">
                    {evt.streamUrl || host?.link ? (
                      <a
                        href={evt.streamUrl || host?.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-foreground hover:bg-accent/80 transition-colors"
                      >
                        Watch Stream ↗
                      </a>
                    ) : null}

                    <button
                      onClick={() => toggleRsvp(post)}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                        isGoing
                          ? "bg-primary text-primary-foreground shadow"
                          : "bg-background border border-border text-foreground hover:bg-accent"
                      }`}
                    >
                      <span>{isGoing ? "✓ Going" : "+ RSVP"}</span>
                      {rsvps.length > 0 && (
                        <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${isGoing ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                          {rsvps.length}
                        </span>
                      )}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={async () => {
                          if (window.confirm("Delete this event?")) {
                            await onDelete(post.id);
                            setToast("Event removed");
                          }
                        }}
                        className="rounded-xl p-1.5 text-xs text-destructive hover:bg-destructive/10"
                        title="Delete event"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!posts.length && (
        <div className="rounded-2xl border border-dashed border-border bg-popover/50 p-12 text-center">
          <p className="text-4xl">📅</p>
          <h3 className="mt-3 text-lg font-bold text-foreground">No community events scheduled yet</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {isAdmin
              ? "Use the event builder above to schedule and broadcast upcoming tournaments, raid trains, or game nights."
              : "Upcoming tournaments and creator raid trains will appear here when scheduled."}
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-xl bg-background p-3"><p className="text-lg font-black">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div>; }

function RichPostContent({ text }: { text: string }) {
  return <div className="mt-4 space-y-3 text-base leading-relaxed">{text.split("\n").map((line, index) => {
    const image = line.trim().match(/^!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/);
    if (image) return <img key={`${line}-${index}`} src={image[1]!} alt="Inline post image" className="max-h-[36rem] w-full rounded-xl object-cover" />;
    const parts = line.split(/(https?:\/\/[^\s]+)/g);
    return <p key={`${line}-${index}`} className={line ? "min-h-5 whitespace-pre-wrap" : "h-2"}>{parts.map((part, partIndex) => /^https?:\/\//.test(part) ? <a key={partIndex} href={part} target="_blank" rel="noreferrer" className="break-all text-primary underline">{part}</a> : part)}</p>;
  })}</div>;
}


function StickerDisplay({
  sticker,
  onToast,
}: {
  sticker: string;
  onToast?: ((msg: string) => void) | undefined;
}) {
  const isImage = sticker.startsWith("http") || sticker.startsWith("data:image");
  const [saved, setSaved] = useState(() => isStickerSaved(sticker));

  if (!isImage) {
    return <p className="mt-1 text-5xl leading-none">{sticker}</p>;
  }

  return (
    <div className="group/sticker relative mt-2 inline-block">
      <img
        src={sticker}
        alt="Community sticker"
        loading="lazy"
        className="max-h-36 max-w-36 rounded-xl object-contain drop-shadow-md transition-transform hover:scale-105"
      />
      <button
        type="button"
        onClick={() => {
          saveCustomSticker("Saved Sticker", sticker);
          setSaved(true);
          onToast?.("Sticker added to your collection!");
        }}
        className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full border border-border bg-popover/95 px-2 py-0.5 text-[10px] font-bold text-foreground opacity-90 shadow-md transition-opacity hover:opacity-100 hover:bg-accent"
        title="Save this sticker to your stickers"
      >
        {saved ? "✓ In Stickers" : "⭐ Add to Stickers"}
      </button>
    </div>
  );
}

function MessageActions({
  post,
  member,
  isAdmin,
  currentUserId,
  onReply,
  onReact,
  onDelete,
  onRemoveMember,
}: {
  post: Post;
  member?: Member | undefined;
  isAdmin: boolean;
  currentUserId?: string | undefined;
  onReply: () => void;
  onReact: (id: string, emoji: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRemoveMember: () => Promise<void>;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const canDelete = isAdmin || post.authorId === currentUserId || !post.authorId || post.authorId === "community";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {/* Existing Reactions (excluding ❤️ which is handled by the dedicated Like counter) */}
      {Object.entries(post.reactions ?? {})
        .filter(([emoji, count]) => count > 0 && emoji !== "❤️" && emoji !== "💖")
        .map(([emoji, count]) => (
          <button
            key={emoji}
            onClick={() => onReact(post.id, emoji)}
            className="flex items-center gap-1 rounded-lg border border-border/60 bg-accent/40 px-2 py-0.5 text-xs font-semibold hover:bg-accent"
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        ))}

      {/* Quick Action Toolbar */}
      <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 flex-wrap">
        {/* Like Button */}
        <button
          type="button"
          onClick={() => onReact(post.id, "❤️")}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-pink-400 transition"
          title="Like post"
        >
          <span>❤️</span>
          <span className="font-bold">{post.likes?.length || (post.reactions?.["❤️"] ?? 0) || ""}</span>
        </button>

        {/* Comment / Reply Button */}
        <button
          type="button"
          onClick={onReply}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition"
          title="Reply or Comment"
        >
          <span>💬</span>
          <span className="font-bold">{post.comments?.length || "Reply"}</span>
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(`${window.location.origin}/#${post.id}`);
            }
            onReact(post.id, "🔥");
          }}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-cyan-400 transition"
          title="Share post"
        >
          <span>🔄</span>
          <span className="font-bold">{post.shares || "Share"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Add reaction"
        >
          😀+
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={() => void onDelete(post.id)}
            className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-destructive/80 hover:bg-destructive/15 hover:text-destructive"
            title="Delete post"
          >
            Delete
          </button>
        )}

        {isAdmin && member && member.role !== "admin" && (
          <button
            type="button"
            onClick={() => void onRemoveMember()}
            className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-destructive/60 hover:bg-destructive/15 hover:text-destructive"
            title="Remove member"
          >
            Remove
          </button>
        )}
      </div>

      {/* Popup Emoji Picker */}
      {showEmojiPicker && (
        <div className="flex items-center gap-1 rounded-xl border border-border bg-popover p-1 shadow-lg">
          {["👍", "❤️", "😂", "🔥", "😮", "👑", "🎮", "💀"].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(post.id, emoji);
                setShowEmojiPicker(false);
              }}
              className="rounded-lg px-1.5 py-1 text-base hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunityMark({ community, size }: { community: { name: string; logo: string }; size: number }) {
  return <div className="grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-xs font-extrabold text-primary-foreground" style={{ width: size, height: size }}>{community.logo ? <img src={community.logo} alt={`${community.name} logo`} className="h-full w-full object-cover" /> : community.name.slice(0, 2).toUpperCase()}</div>;
}

function RulesChannel({ rules, onContinue }: { rules: string; onContinue: () => void }) {
  return <div className="mx-auto max-w-2xl space-y-4 px-4 py-8"><section className="rounded-xl bg-popover p-6"><span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-3xl text-muted-foreground">#</span><h1 className="mt-4 text-2xl font-extrabold">Welcome to #rules!</h1><p className="mt-2 text-sm text-muted-foreground">Please read these rules before taking part in the community.</p></section><section className="space-y-3 rounded-xl bg-popover p-5"><h2 className="font-bold">Community rules</h2><ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">{rules.split("\n").filter(Boolean).map((rule) => <li key={rule}>{rule}</li>)}</ol><button onClick={onContinue} className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85">I have read the rules — Continue to #general</button></section></div>;
}

function CustomChannel({
  name,
  topic,
  posts,
  members,
  allMemberList,
  onReply,
  onReact,
  isAdmin,
  currentUserId,
  onDelete,
  onUpdate,
  onToast,
}: {
  name: string;
  topic: string;
  posts: Post[];
  members: Map<string, Member>;
  allMemberList?: Member[];
  onReply: (post: { id: string; authorId: string }) => void;
  onReact: (id: string, emoji: string) => void;
  isAdmin: boolean;
  currentUserId?: string | undefined;
  onDelete: (id: string) => Promise<void>;
  onUpdate?: (id: string, patch: Partial<Post>) => Promise<void>;
  onToast?: ((msg: string) => void) | undefined;
}) {
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (name === "clips") {
      // By default in #clips, show comments so it never feels dry
      posts.forEach((p) => {
        initial[p.id] = true;
      });
    }
    return initial;
  });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const toggleLike = async (post: Post) => {
    if (!onUpdate) return;
    const userKey = currentUserId || "guest-user";
    const currentLikes = post.likes ?? [];
    const hasLiked = currentLikes.includes(userKey);
    const updatedLikes = hasLiked
      ? currentLikes.filter((id) => id !== userKey)
      : [...currentLikes, userKey];

    await onUpdate(post.id, { likes: updatedLikes });
  };

  const handleAddComment = async (postId: string) => {
    if (!onUpdate) return;
    const text = commentDrafts[postId]?.trim();
    if (!text) return;

    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const newComment = {
      id: Math.random().toString(36).slice(2, 9),
      authorId: currentUserId || "guest-user",
      text,
      time: Date.now(),
    };

    const currentComments = targetPost.comments ?? [];
    await onUpdate(postId, {
      comments: [...currentComments, newComment],
    });

    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    setExpandedComments((prev) => ({ ...prev, [postId]: true }));
    onToast?.("Comment added!");
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!onUpdate) return;
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const updatedComments = (targetPost.comments ?? []).filter((c) => c.id !== commentId);
    await onUpdate(postId, { comments: updatedComments });
    onToast?.("Comment deleted");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <section className="rounded-2xl border border-border bg-popover p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black text-primary">#</span>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Welcome to #{name}!</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{topic}</p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {posts.map((post) => {
          const member = members.get(post.authorId);
          const segments = (post.text || "").split(/(https?:\/\/[^\s]+)/g);
          const likesList = post.likes ?? [];
          const userKey = currentUserId || "guest-user";
          const isLikedByMe = likesList.includes(userKey);
          const isCommentsOpen = !!expandedComments[post.id];
          const commentsList = post.comments ?? [];

          return (
            <article
              key={post.id}
              className="rounded-2xl border border-border/80 bg-popover p-4 shadow-sm transition-all hover:border-border"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  member={member ?? { name: "Community", avatar: "", status: "offline" }}
                  size={42}
                  showStatus={true}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {member?.name ?? "Community Creator"}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {member?.handle || ""}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {post.time ? timeAgo(post.time) : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MessageActions
                        post={post}
                        member={member}
                        isAdmin={isAdmin}
                        currentUserId={currentUserId}
                        onReact={onReact}
                        onReply={() => onReply({ id: post.id, authorId: post.authorId })}
                        onDelete={onDelete}
                        onRemoveMember={async () => {}}
                      />
                    </div>
                  </div>

                  {post.text && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {segments.map((segment, index) =>
                        /^https?:\/\//.test(segment) ? (
                          <a
                            key={index}
                            href={segment}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-semibold text-primary underline hover:text-primary/80"
                          >
                            {segment}
                          </a>
                        ) : (
                          segment
                        )
                      )}
                    </p>
                  )}

                  {post.sticker && <StickerDisplay sticker={post.sticker} onToast={onToast} />}

                  {post.image && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
                      <img
                        src={post.image}
                        alt="Clip thumbnail or attachment"
                        className="max-h-96 w-full object-cover transition-transform hover:scale-[1.01]"
                      />
                    </div>
                  )}

                  {/* Engagement Bar (Likes, Comments, Shares) */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      {/* Like button */}
                      <button
                        onClick={() => toggleLike(post)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                          isLikedByMe
                            ? "bg-destructive/15 text-destructive"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        <span>{isLikedByMe ? "❤️" : "🤍"}</span>
                        <span>{likesList.length}</span>
                      </button>

                      {/* Comment toggle button */}
                      <button
                        onClick={() =>
                          setExpandedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                        }
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                          isCommentsOpen
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        <span>💬</span>
                        <span>{commentsList.length} Comments</span>
                      </button>

                      {/* Shares */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span>↗</span>
                        <span>{post.shares ?? 0} Shares</span>
                      </div>
                    </div>

                    {/* Likers Avatars Tooltip / List */}
                    {likesList.length > 0 && (
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {likesList.slice(0, 5).map((userId) => {
                          const liker = members.get(userId);
                          if (!liker) return null;
                          return (
                            <div
                              key={userId}
                              className="rounded-full ring-2 ring-popover"
                              title={liker.name}
                            >
                              <Avatar member={liker} size={20} showStatus={false} />
                            </div>
                          );
                        })}
                        {likesList.length > 5 && (
                          <span className="pl-2 text-[10px] font-bold text-muted-foreground">
                            +{likesList.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expandable Live Chat & Comments Thread */}
                  {isCommentsOpen && (
                    <div className="mt-3.5 space-y-3 rounded-xl border border-border/80 bg-background/80 p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Stream Chat & Creator Comments ({commentsList.length})
                      </p>

                      <div className="space-y-2.5">
                        {commentsList.map((comment) => {
                          const commentAuthor = members.get(comment.authorId);
                          return (
                            <div
                              key={comment.id}
                              className="flex items-start justify-between gap-2.5 rounded-lg bg-popover p-2.5 text-xs shadow-xs"
                            >
                              <div className="flex items-start gap-2.5">
                                <Avatar
                                  member={
                                    commentAuthor ?? {
                                      name: "Community Member",
                                      avatar: "",
                                      status: "online",
                                    }
                                  }
                                  size={26}
                                  showStatus={false}
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">
                                      {commentAuthor?.name ?? "Community Chatter"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {timeAgo(comment.time)}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-foreground/90">{comment.text}</p>
                                </div>
                              </div>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteComment(post.id, comment.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                  title="Delete comment"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {!commentsList.length && (
                          <p className="py-1 text-xs text-muted-foreground">
                            No chat reactions yet. Be the first to comment!
                          </p>
                        )}
                      </div>

                      {/* Add Comment Input */}
                      <div className="mt-2.5 flex gap-2">
                        <input
                          value={commentDrafts[post.id] || ""}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void handleAddComment(post.id);
                            }
                          }}
                          placeholder="Write a comment as creator or admin..."
                          className="w-full rounded-xl bg-input px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="shrink-0 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
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
