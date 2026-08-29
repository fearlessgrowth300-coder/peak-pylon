import { useState, useMemo } from "react";
import {
  Bell,
  AtSign,
  Heart,
  Users,
  Radio,
  Award,
  Sparkles,
  MessageSquare,
  Check,
  CheckCheck,
  Trash2,
  BellOff,
  Settings,
  ExternalLink,
  X,
  Volume2,
  VolumeX,
  Sliders,
} from "lucide-react";
import type { Member } from "@/lib/community";
import { Avatar } from "./Bits";

export type NotificationCategory = "all" | "mentions" | "social" | "community" | "system";

export interface SmartNotification {
  id: string;
  category: NotificationCategory;
  type: "mention" | "announcement" | "live" | "reply" | "rank" | "reaction";
  actorName: string;
  actorHandle?: string;
  actorAvatar?: string;
  title: string;
  body: string;
  timeAgo: string;
  read: boolean;
  muted?: boolean;
  deepLinkView?: string;
  deepLinkTargetId?: string;
  metadata?: {
    gameName?: string;
    viewers?: number;
    channel?: string;
    rankFrom?: number;
    rankTo?: number;
  };
}

const INITIAL_NOTIFICATIONS: SmartNotification[] = [
  {
    id: "notif-1",
    category: "mentions",
    type: "mention",
    actorName: "BigCreator",
    actorHandle: "@bigcreator",
    title: "@BigCreator mentioned you in #general",
    body: '"Let\'s run a stream together."',
    timeAgo: "2m",
    read: false,
    deepLinkView: "general",
  },
  {
    id: "notif-2",
    category: "community",
    type: "announcement",
    actorName: "StreamCore Staff",
    actorHandle: "@streamcore",
    title: "⭐ StreamCore Announcement",
    body: "Creator Challenge begins tomorrow. Complete your daily stream goals to win community badges!",
    timeAgo: "15m",
    read: false,
    deepLinkView: "announcements",
  },
  {
    id: "notif-3",
    category: "social",
    type: "live",
    actorName: "KyrieStream",
    actorHandle: "@kyrie",
    title: "🔴 KyrieStream is live",
    body: "Valorant • 4,821 viewers",
    timeAgo: "23m",
    read: false,
    deepLinkView: "live-now",
    metadata: { gameName: "Valorant", viewers: 4821 },
  },
  {
    id: "notif-4",
    category: "mentions",
    type: "reply",
    actorName: "NovaVibe",
    actorHandle: "@novavibe",
    title: "💬 NovaVibe replied to you",
    body: '"Yeah let\'s do it."',
    timeAgo: "1h",
    read: true,
    deepLinkView: "general",
  },
  {
    id: "notif-5",
    category: "system",
    type: "rank",
    actorName: "StreamCore Leaderboard",
    title: "🏆 YOU RANKED UP",
    body: "You moved from #21 to #17 in Rising Creators.",
    timeAgo: "2h",
    read: true,
    deepLinkView: "rankings",
    metadata: { rankFrom: 21, rankTo: 17 },
  },
  {
    id: "notif-6",
    category: "social",
    type: "reaction",
    actorName: "ZenithPlay",
    actorHandle: "@zenith",
    title: "🔥 ZenithPlay reacted to your clip",
    body: '"W CLIP honestly 🏆"',
    timeAgo: "3h",
    read: true,
    deepLinkView: "general",
  },
];

export function NotificationsView({
  onNavigate,
  onPickMember,
  members,
  setToast,
}: {
  onNavigate: (view: string, targetId?: string) => void;
  onPickMember?: (member: Member) => void;
  members: Member[];
  setToast?: (msg: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<NotificationCategory>("all");
  const [notifications, setNotifications] = useState<SmartNotification[]>(() => {
    if (typeof window === "undefined") return INITIAL_NOTIFICATIONS;
    try {
      const saved = localStorage.getItem("streamcore:smart-notifications");
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_NOTIFICATIONS;
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    mentions: true,
    streamerLive: true,
    announcements: true,
    rankUpdates: true,
    reactions: true,
    soundAlerts: true,
  });

  const saveNotificationsState = (updated: SmartNotification[]) => {
    setNotifications(updated);
    try {
      localStorage.setItem("streamcore:smart-notifications", JSON.stringify(updated));
    } catch {}
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveNotificationsState(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotificationsState(updated);
    setToast?.("All notifications marked as read");
  };

  const toggleMuteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.map((n) => (n.id === id ? { ...n, muted: !n.muted } : n));
    saveNotificationsState(updated);
    const target = updated.find((n) => n.id === id);
    setToast?.(target?.muted ? "Muted updates from this creator" : "Unmuted updates");
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    saveNotificationsState(updated);
    setToast?.("Notification deleted");
  };

  const handleNotificationClick = (item: SmartNotification) => {
    markAsRead(item.id);
    if (item.deepLinkView) {
      onNavigate(item.deepLinkView, item.deepLinkTargetId);
      setToast?.(`Navigated to ${item.deepLinkView}`);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => n.category === activeTab);
  }, [notifications, activeTab]);

  const unreadCountByTab = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      all: notifications.filter((n) => !n.read).length,
      mentions: notifications.filter((n) => n.category === "mentions" && !n.read).length,
      social: notifications.filter((n) => n.category === "social" && !n.read).length,
      community: notifications.filter((n) => n.category === "community" && !n.read).length,
      system: notifications.filter((n) => n.category === "system" && !n.read).length,
    };
    return counts;
  }, [notifications]);

  const tabs: Array<{ id: NotificationCategory; label: string; icon: any }> = [
    { id: "all", label: "All", icon: Bell },
    { id: "mentions", label: "Mentions", icon: AtSign },
    { id: "social", label: "Social", icon: Heart },
    { id: "community", label: "Community", icon: Users },
    { id: "system", label: "System", icon: Award },
  ];

  return (
    <div className="space-y-6 px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <Bell className="h-4 w-4" />
            </span>
            <p className="text-xs font-black uppercase tracking-wider text-sky-400">
              Smart Activity Stream
            </p>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
            Notifications
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Stay on top of live mentions, community replies, stream alerts, and ranking milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCountByTab.all > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition"
            >
              <CheckCheck className="h-4 w-4 text-emerald-400" />
              Mark all read
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition"
            title="Notification Settings"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-2 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const unread = unreadCountByTab[t.id];

          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
              {unread > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    active ? "bg-black text-white" : "bg-sky-500 text-black"
                  }`}
                >
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* NOTIFICATIONS LIST */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-2">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <h3 className="text-sm font-bold text-foreground">No notifications in this tab</h3>
            <p className="text-xs text-muted-foreground">You're completely caught up with all activity!</p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`group relative flex items-start justify-between gap-4 rounded-2xl border p-4 transition-all duration-150 cursor-pointer ${
                  !item.read
                    ? "border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 shadow-sm"
                    : "border-border/70 bg-card hover:bg-accent/40"
                }`}
              >
                {/* Left: Icon / Type indicator + content */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="relative mt-0.5">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-sm ${
                        item.type === "mention"
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          : item.type === "announcement"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : item.type === "live"
                              ? "bg-live/20 text-live border border-live/30 animate-pulse"
                              : item.type === "rank"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : item.type === "reply"
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                  : "bg-accent text-foreground"
                      }`}
                    >
                      {item.type === "mention" && <AtSign className="h-5 w-5" />}
                      {item.type === "announcement" && <Sparkles className="h-5 w-5" />}
                      {item.type === "live" && <Radio className="h-5 w-5" />}
                      {item.type === "rank" && <Award className="h-5 w-5" />}
                      {item.type === "reply" && <MessageSquare className="h-5 w-5" />}
                      {item.type === "reaction" && <Heart className="h-5 w-5" />}
                    </span>

                    {!item.read && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-sky-500 ring-2 ring-card" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-extrabold truncate ${
                          !item.read ? "text-foreground" : "text-foreground/90"
                        }`}
                      >
                        {item.title}
                      </h3>
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        {item.timeAgo}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {item.body}
                    </p>

                    {item.deepLinkView && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:underline pt-0.5">
                        Jump to {item.deepLinkView} <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Quick action buttons */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                  <button
                    onClick={(e) => toggleMuteNotification(item.id, e)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                    title={item.muted ? "Unmute creator" : "Mute creator alerts"}
                  >
                    {item.muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={(e) => deleteNotification(item.id, e)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition"
                    title="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* NOTIFICATION SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sky-400" />
                <h3 className="font-extrabold text-base">Notification Preferences</h3>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 divide-y divide-border/60">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-bold text-foreground">Mentions & Replies</p>
                  <p className="text-[11px] text-muted-foreground">Alert when someone @mentions or replies to you</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.mentions}
                  onChange={(e) =>
                    setNotificationSettings({ ...notificationSettings, mentions: e.target.checked })
                  }
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-bold text-foreground">Streamer Live Alerts</p>
                  <p className="text-[11px] text-muted-foreground">Alert when creators you follow start broadcasting</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.streamerLive}
                  onChange={(e) =>
                    setNotificationSettings({ ...notificationSettings, streamerLive: e.target.checked })
                  }
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-bold text-foreground">Community Announcements</p>
                  <p className="text-[11px] text-muted-foreground">Broadcast alerts from StreamCore leaders</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.announcements}
                  onChange={(e) =>
                    setNotificationSettings({ ...notificationSettings, announcements: e.target.checked })
                  }
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-bold text-foreground">Rank & Milestone Updates</p>
                  <p className="text-[11px] text-muted-foreground">Notify when you rank up or cross milestones</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.rankUpdates}
                  onChange={(e) =>
                    setNotificationSettings({ ...notificationSettings, rankUpdates: e.target.checked })
                  }
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  setToast?.("Notification preferences saved!");
                }}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground hover:bg-primary/90"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
