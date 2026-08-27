export interface LiveStreamItem {
  id: string;
  title: string;
  creatorName: string;
  creatorHandle: string;
  category: string;
  viewers: string;
  avatar: string;
  thumbnail: string;
  isLive: boolean;
}

export interface DiscussionItem {
  id: string;
  tag: "Discussion" | "Poll" | "Update";
  title: string;
  authorName: string;
  authorAvatar: string;
  timeAgo: string;
  replies: string;
  likes: string;
}

export interface ClipItem {
  id: string;
  title: string;
  creatorName: string;
  category: string;
  duration: string;
  views: string;
  thumbnail: string;
}

export interface FeaturedCreator {
  id: string;
  name: string;
  handle: string;
  role: string;
  followers: string;
  avatar: string;
  isSpotlight?: boolean;
}

export interface RisingCreator {
  id: string;
  name: string;
  followers: string;
  growth: string;
  avatar: string;
  platform: string;
}

export interface EventItem {
  id: string;
  title: string;
  dateTime: string;
  attendees: string;
  gradient: string;
}

export interface ActivityItem {
  id: string;
  creatorName: string;
  creatorAvatar: string;
  action: string;
  timeAgo: string;
}

export interface OnlineCreator {
  id: string;
  name: string;
  statusText: string;
  avatar: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  author: string;
  description: string;
  likes: string;
  iconBg: string;
}

export const STREAMCORE_STATS = {
  members: "42,381,492",
  membersShort: "42.3M",
  online: "86,421",
  onlineShort: "86.4K",
  liveStreams: "3,821",
  liveStreamsShort: "3.8K",
  postsToday: "18,421",
  postsTodayShort: "18.4K",
  totalOnlineExtra: "+ 86,415 online",
};

export const LIVE_STREAMS: LiveStreamItem[] = [
  {
    id: "live-1",
    title: "RANKED GRIND TO TOP...",
    creatorName: "Ninja",
    creatorHandle: "@ninja",
    category: "Fortnite",
    viewers: "12.4K viewers",
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80",
    thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80",
    isLive: true,
  },
  {
    id: "live-2",
    title: "GTA RP - NEW CITY...",
    creatorName: "TypicalGamer",
    creatorHandle: "@typicalgamer",
    category: "GTA V",
    viewers: "8.2K viewers",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80",
    isLive: true,
  },
  {
    id: "live-3",
    title: "CHILL VIBES & CHATTING",
    creatorName: "Pokimane",
    creatorHandle: "@pokimane",
    category: "Just Chatting",
    viewers: "6.7K viewers",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
    isLive: true,
  },
  {
    id: "live-4",
    title: "WARZONE PUSHING TOP 250",
    creatorName: "TimTheTatman",
    creatorHandle: "@timthetatman",
    category: "Call of Duty",
    viewers: "4.3K viewers",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    thumbnail: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=80",
    isLive: true,
  },
  {
    id: "live-5",
    title: "NEW UPDATE FIRST LOOK!",
    creatorName: "Shroud",
    creatorHandle: "@shroud",
    category: "Escape from Tarkov",
    viewers: "4.1K viewers",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    isLive: true,
  },
];

export const DISCUSSIONS: DiscussionItem[] = [
  {
    id: "disc-1",
    tag: "Discussion",
    title: "What game has the best community right now?",
    authorName: "CreatorHub",
    authorAvatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80",
    timeAgo: "2h ago",
    replies: "542 replies",
    likes: "1.2K",
  },
  {
    id: "disc-2",
    tag: "Poll",
    title: "Vote for upcoming Creator of the Month!",
    authorName: "StreamCore Staff",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    timeAgo: "5h ago",
    replies: "643 replies",
    likes: "987",
  },
  {
    id: "disc-3",
    tag: "Update",
    title: "New Partner Program Applications Open",
    authorName: "StreamCore Staff",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    timeAgo: "8h ago",
    replies: "1.5K replies",
    likes: "1.8K",
  },
];

export const CLIPS: ClipItem[] = [
  {
    id: "clip-1",
    title: "INSANE 1V4 CLUTCH!",
    creatorName: "Shroud",
    category: "Call of Duty",
    duration: "0:45",
    views: "12.6K views",
    thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "clip-2",
    title: "UNBELIEVABLE SNIPE!",
    creatorName: "Ninja",
    category: "Fortnite",
    duration: "0:30",
    views: "9.8K views",
    thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "clip-3",
    title: "FUNNIEST MOMENT 😭",
    creatorName: "Ludwig",
    category: "Just Chatting",
    duration: "0:22",
    views: "8.3K views",
    thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "clip-4",
    title: "200 IQ PLAY...",
    creatorName: "Tfue",
    category: "Warzone",
    duration: "0:25",
    views: "7.4K views",
    thumbnail: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "clip-5",
    title: "PERFECT TIMING!",
    creatorName: "CohhCarnage",
    category: "Elden Ring",
    duration: "0:40",
    views: "6.2K views",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=80",
  },
];

export const FEATURED_CREATORS: FeaturedCreator[] = [
  {
    id: "feat-1",
    name: "Ninja",
    handle: "@ninja",
    role: "Partner",
    followers: "1.2M followers",
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&auto=format&fit=crop&q=80",
    isSpotlight: true,
  },
  {
    id: "feat-2",
    name: "Pokimane",
    handle: "@pokimane",
    role: "Partner",
    followers: "980K followers",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "feat-3",
    name: "TimTheTatman",
    handle: "@timthetatman",
    role: "Partner",
    followers: "850K followers",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "feat-4",
    name: "Ludwig",
    handle: "@ludwig",
    role: "Partner",
    followers: "780K followers",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "feat-5",
    name: "Shroud",
    handle: "@shroud",
    role: "Partner",
    followers: "1.1M followers",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  },
];

export const RISING_CREATORS: RisingCreator[] = [
  {
    id: "rise-1",
    name: "KaiStreamz",
    followers: "2.1K followers",
    growth: "+42%",
    platform: "Twitch",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "rise-2",
    name: "LunaLive",
    followers: "1.8K followers",
    growth: "+37%",
    platform: "Twitch",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "rise-3",
    name: "CobraCast",
    followers: "1.2K followers",
    growth: "+31%",
    platform: "Kick",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "rise-4",
    name: "AyoItsVex",
    followers: "1.1K followers",
    growth: "+29%",
    platform: "YouTube",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
  },
];

export const ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "ann-1",
    title: "StreamCore Creator Challenge - Spring 2024",
    author: "StreamCore Staff • 2h ago",
    description: "Participate now and win amazing prizes!",
    likes: "732",
    iconBg: "from-rose-500 to-pink-600",
  },
  {
    id: "ann-2",
    title: "Partner Program Applications Open",
    author: "StreamCore Staff • 1d ago",
    description: "Apply now to become a StreamCore Partner!",
    likes: "1.2K",
    iconBg: "from-amber-500 to-orange-600",
  },
  {
    id: "ann-3",
    title: "Community Update - New Features",
    author: "StreamCore Staff • 3d ago",
    description: "Check out what's new on StreamCore",
    likes: "943",
    iconBg: "from-purple-500 to-indigo-600",
  },
];

export const ONLINE_CREATORS: OnlineCreator[] = [
  {
    id: "on-1",
    name: "Ninja",
    statusText: "Streaming Fortnite",
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "on-2",
    name: "Pokimane",
    statusText: "Just Chatting",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "on-3",
    name: "TimTheTatman",
    statusText: "Playing Warzone",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "on-4",
    name: "Ludwig",
    statusText: "Streaming Chess",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "on-5",
    name: "Shroud",
    statusText: "Playing EFT",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  },
];

export const UPCOMING_EVENTS: EventItem[] = [
  {
    id: "ev-1",
    title: "Creator Challenge Finals",
    dateTime: "May 25, 2024 • 7:00 PM",
    attendees: "1.2K going",
    gradient: "from-fuchsia-500 to-purple-600",
  },
  {
    id: "ev-2",
    title: "Collab Stream Marathon",
    dateTime: "May 28, 2024 • 12:00 PM",
    attendees: "842 going",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    id: "ev-3",
    title: "StreamCore Awards 2024",
    dateTime: "June 5, 2024 • 6:00 PM",
    attendees: "2.4K going",
    gradient: "from-amber-500 to-yellow-600",
  },
];

export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: "act-1",
    creatorName: "Ninja",
    creatorAvatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100&auto=format&fit=crop&q=80",
    action: "Posted a clip",
    timeAgo: "2m ago",
  },
  {
    id: "act-2",
    creatorName: "Pokimane",
    creatorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    action: "Went live",
    timeAgo: "15m ago",
  },
  {
    id: "act-3",
    creatorName: "TimTheTatman",
    creatorAvatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
    action: "Posted an update",
    timeAgo: "1h ago",
  },
  {
    id: "act-4",
    creatorName: "Ludwig",
    creatorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    action: "Reached 500K followers",
    timeAgo: "2h ago",
  },
  {
    id: "act-5",
    creatorName: "Shroud",
    creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    action: "Posted a clip",
    timeAgo: "3h ago",
  },
];
