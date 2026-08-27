import { useState } from "react";
import {
  STREAMCORE_STATS,
  LIVE_STREAMS,
  DISCUSSIONS,
  CLIPS,
  FEATURED_CREATORS,
  RISING_CREATORS,
  ANNOUNCEMENTS,
  type LiveStreamItem,
  type DiscussionItem,
  type ClipItem,
  type FeaturedCreator,
  type RisingCreator,
} from "@/lib/streamcore-data";
import { CategoryDonutChart } from "./CategoryDonutChart";
import {
  Users,
  Radio,
  PlaySquare,
  MessageSquare,
  Trophy,
  X,
  ChevronRight,
  Eye,
  Heart,
  MessageCircle,
  Sparkles,
  Globe,
  Moon,
  Disc,
} from "lucide-react";

interface HomeDashboardProps {
  onOpenView: (view: string) => void;
  onPickCreator: (creator: { name: string; avatar: string }) => void;
}

export function HomeDashboard({ onOpenView, onPickCreator }: HomeDashboardProps) {
  const [challengeDismissed, setChallengeDismissed] = useState(false);
  const [followed, setFollowed] = useState(false);

  const mainSpotlight = FEATURED_CREATORS[0]!;
  const otherFeatured = FEATURED_CREATORS.slice(1);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 lg:px-6">
      {/* 1. Welcome Greeting Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Welcome back, Plutoforce <span>✌️</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          The world's largest creator community.
        </p>
      </div>

      {/* 2. 4 Stat Cards in a row */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Card 1: Members */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600/30 text-indigo-400">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white sm:text-xl">
              {STREAMCORE_STATS.members}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Members
            </p>
          </div>
        </div>

        {/* Card 2: Online Now */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/25 text-emerald-400">
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white sm:text-xl">
              {STREAMCORE_STATS.online}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Online Now
            </p>
          </div>
        </div>

        {/* Card 3: Live Streams */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/25 text-rose-400">
            <PlaySquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white sm:text-xl">
              {STREAMCORE_STATS.liveStreams}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Live Streams
            </p>
          </div>
        </div>

        {/* Card 4: Posts Today */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/25 text-sky-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white sm:text-xl">
              {STREAMCORE_STATS.postsToday}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Posts Today
            </p>
          </div>
        </div>
      </div>

      {/* 3. Promo Banner: StreamCore Creator Challenge */}
      {!challengeDismissed && (
        <div className="relative flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-[#1d1838] via-[#16172e] to-[#121422] p-4 shadow-xl sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600/40 text-indigo-300 ring-4 ring-indigo-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                STREAMCORE CREATOR CHALLENGE
              </h3>
              <p className="text-xs text-zinc-400">
                Spring 2024 is live! Join now and win amazing prizes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => onOpenView("events")}
              className="rounded-xl bg-[#5c54e5] px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-[#6c64f5]"
            >
              Join Challenge
            </button>
            <button
              onClick={() => setChallengeDismissed(true)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. LIVE NOW Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">
              LIVE NOW
            </h2>
          </div>
          <button
            onClick={() => onOpenView("live-now")}
            className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
          >
            View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          {LIVE_STREAMS.map((stream) => (
            <div
              key={stream.id}
              onClick={() => onPickCreator({ name: stream.creatorName, avatar: stream.avatar })}
              className="group cursor-pointer space-y-2 rounded-xl bg-[#121524] p-2 border border-white/[0.04] transition-all hover:border-indigo-500/50 hover:bg-[#161a2c]"
            >
              {/* Thumbnail with LIVE and Viewers tags */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-900">
                <img
                  src={stream.thumbnail}
                  alt={stream.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute left-1.5 top-1.5 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                  LIVE
                </span>
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur-sm">
                  {stream.viewers}
                </span>
              </div>

              {/* Title & Streamer */}
              <div className="px-0.5">
                <p className="truncate text-xs font-bold text-white group-hover:text-indigo-400">
                  {stream.title}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <img
                    src={stream.avatar}
                    alt={stream.creatorName}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-zinc-200">
                      {stream.creatorName}
                    </p>
                    <p className="truncate text-[10px] text-zinc-400">
                      {stream.category}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. TRENDING COMMUNITY DISCUSSIONS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">
            TRENDING COMMUNITY DISCUSSIONS
          </h2>
          <button
            onClick={() => onOpenView("trending")}
            className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
          >
            View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {DISCUSSIONS.map((disc) => (
            <div
              key={disc.id}
              onClick={() => onOpenView("general")}
              className="group flex cursor-pointer flex-col justify-between gap-2 rounded-xl border border-white/[0.04] bg-[#121524] p-3.5 transition-all hover:border-indigo-500/40 hover:bg-[#161a2c] sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    disc.tag === "Discussion"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : disc.tag === "Poll"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                  }`}
                >
                  {disc.tag}
                </span>
                <p className="text-xs font-bold text-white group-hover:text-indigo-300 sm:text-sm">
                  {disc.title}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 text-xs text-zinc-400 sm:justify-end">
                <div className="flex items-center gap-2">
                  <img
                    src={disc.authorAvatar}
                    alt={disc.authorName}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                  <span>
                    {disc.authorName} • {disc.timeAgo}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-zinc-400" />
                    {disc.replies}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                    {disc.likes}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. TRENDING CLIPS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">
            TRENDING CLIPS
          </h2>
          <button
            onClick={() => onOpenView("clips")}
            className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
          >
            View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          {CLIPS.map((clip) => (
            <div
              key={clip.id}
              onClick={() => onOpenView("clips")}
              className="group cursor-pointer space-y-2 rounded-xl bg-[#121524] p-2 border border-white/[0.04] transition-all hover:border-indigo-500/50 hover:bg-[#161a2c]"
            >
              {/* Thumbnail with duration tag */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-900">
                <img
                  src={clip.thumbnail}
                  alt={clip.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                  {clip.duration}
                </span>
              </div>

              {/* Title, Creator, & Views */}
              <div className="px-0.5">
                <p className="truncate text-xs font-bold text-white group-hover:text-indigo-400">
                  {clip.title}
                </p>
                <p className="truncate text-[11px] text-zinc-400 mt-0.5">
                  {clip.creatorName} · {clip.category}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                  <Eye className="h-3 w-3 text-indigo-400" />
                  {clip.views}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. 2-Column: FEATURED CREATORS (Left) & RISING CREATORS (Right) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: FEATURED CREATORS */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">
              FEATURED CREATORS
            </h2>
            <button
              onClick={() => onOpenView("featured")}
              className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
            >
              View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>

          {/* Main Spotlight Creator */}
          <div className="flex items-center justify-between rounded-xl bg-[#161a2c] p-4 border border-indigo-500/20">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <img
                  src={mainSpotlight.avatar}
                  alt={mainSpotlight.name}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#161a2c]"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white">
                    {mainSpotlight.name}
                  </h3>
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                    {mainSpotlight.role}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {mainSpotlight.followers}
                </p>
              </div>
            </div>

            <button
              onClick={() => setFollowed((v) => !v)}
              className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                followed
                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                  : "bg-[#5c54e5] text-white hover:bg-[#6c64f5]"
              }`}
            >
              {followed ? "Following" : "Follow"}
            </button>
          </div>

          {/* Sub-row of other featured creators */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            {otherFeatured.map((creator) => (
              <button
                key={creator.id}
                onClick={() => onPickCreator({ name: creator.name, avatar: creator.avatar })}
                className="group flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-white/[0.04]"
              >
                <img
                  src={creator.avatar}
                  alt={creator.name}
                  className="h-10 w-10 rounded-full object-cover transition-transform group-hover:scale-105"
                />
                <p className="truncate text-xs font-bold text-zinc-200 group-hover:text-white">
                  {creator.name}
                </p>
                <span className="text-[10px] text-zinc-500">{creator.role}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Right: RISING CREATORS */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">
              RISING CREATORS
            </h2>
            <button
              onClick={() => onOpenView("rising")}
              className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
            >
              View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {RISING_CREATORS.map((rising) => (
              <div
                key={rising.id}
                onClick={() => onPickCreator({ name: rising.name, avatar: rising.avatar })}
                className="flex cursor-pointer items-center justify-between rounded-xl bg-[#161a2c] p-3 border border-white/[0.04] transition-all hover:border-indigo-500/30 hover:bg-[#1a1f35]"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={rising.avatar}
                    alt={rising.name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">{rising.name}</p>
                    <p className="text-[11px] text-zinc-400">
                      {rising.followers}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-extrabold text-emerald-400">
                  {rising.growth}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 8. 2-Column: TOP CATEGORIES & ANNOUNCEMENTS */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: TOP CATEGORIES */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#121524] p-5 shadow-lg space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">
            TOP CATEGORIES
          </h2>
          <CategoryDonutChart />
        </section>

        {/* Right: ANNOUNCEMENTS */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#121524] p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300">
              ANNOUNCEMENTS
            </h2>
            <button
              onClick={() => onOpenView("announcements")}
              className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
            >
              View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {ANNOUNCEMENTS.map((ann) => (
              <div
                key={ann.id}
                onClick={() => onOpenView("announcements")}
                className="group flex cursor-pointer items-start gap-3 rounded-xl bg-[#161a2c] p-3 border border-white/[0.04] transition-all hover:border-indigo-500/30 hover:bg-[#1a1f35]"
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${ann.iconBg} text-white`}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white group-hover:text-indigo-300">
                    {ann.title}
                  </p>
                  <p className="text-[10px] text-zinc-500">{ann.author}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {ann.description}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-zinc-500 self-end">
                  <Heart className="h-3 w-3 text-rose-400" />
                  {ann.likes}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 9. Bottom CTA Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-[#17142a] via-[#121422] to-[#1a1733] p-6 shadow-xl sm:flex sm:items-center sm:justify-between">
        <div className="relative z-10 max-w-xl">
          <h2 className="text-lg font-extrabold text-white sm:text-xl">
            Join the world's most active creator community
          </h2>
          <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
            Connect, collaborate, and grow together with millions of creators.
          </p>
          <button
            onClick={() => onOpenView("creators")}
            className="mt-4 rounded-xl bg-[#5c54e5] px-5 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-[#6c64f5]"
          >
            Invite Your Friends
          </button>
        </div>

        {/* Avatars Stack on right */}
        <div className="relative mt-4 flex items-center -space-x-3 sm:mt-0">
          {FEATURED_CREATORS.map((c, i) => (
            <img
              key={c.id}
              src={c.avatar}
              alt={c.name}
              className="h-10 w-10 rounded-full border-2 border-[#121422] object-cover ring-2 ring-indigo-500/20"
              style={{ zIndex: 10 - i }}
            />
          ))}
          <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#121422] bg-[#5c54e5] text-[10px] font-black text-white">
            +42M
          </div>
        </div>
      </section>

      {/* 10. Footer matching screenshot */}
      <footer className="space-y-6 border-t border-white/[0.06] pt-8 text-xs text-zinc-400">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand & Slogan */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-black tracking-wider text-white">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Disc className="h-4 w-4" />
              </div>
              STREAMCORE
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
              The world's largest creator community. Connect, collaborate, and grow together.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3 text-zinc-400">
              <span className="hover:text-white cursor-pointer font-bold">Discord</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer font-bold">𝕏</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer font-bold">YouTube</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer font-bold">Instagram</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer font-bold">TikTok</span>
            </div>
          </div>

          {/* Links 1: COMMUNITY */}
          <div className="space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-zinc-200">
              COMMUNITY
            </h4>
            <ul className="space-y-1.5">
              <li><button onClick={() => onOpenView("general")} className="hover:text-white">Guidelines</button></li>
              <li><button onClick={() => onOpenView("rules")} className="hover:text-white">Rules</button></li>
              <li><button onClick={() => onOpenView("general")} className="hover:text-white">Support</button></li>
              <li><button onClick={() => onOpenView("general")} className="hover:text-white">FAQ</button></li>
            </ul>
          </div>

          {/* Links 2: CREATOR */}
          <div className="space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-zinc-200">
              CREATOR
            </h4>
            <ul className="space-y-1.5">
              <li><button onClick={() => onOpenView("partners")} className="hover:text-white">Apply for Partner</button></li>
              <li><button onClick={() => onOpenView("creators")} className="hover:text-white">Creator Resources</button></li>
              <li><button onClick={() => onOpenView("creators")} className="hover:text-white">Brand Assets</button></li>
              <li><button onClick={() => onOpenView("analytics")} className="hover:text-white">Monetization</button></li>
            </ul>
          </div>

          {/* Links 3: LEGAL / COMPANY */}
          <div className="space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-zinc-200">
              LEGAL
            </h4>
            <ul className="space-y-1.5">
              <li><button onClick={() => onOpenView("rules")} className="hover:text-white">Terms of Service</button></li>
              <li><button onClick={() => onOpenView("rules")} className="hover:text-white">Privacy Policy</button></li>
              <li><button onClick={() => onOpenView("rules")} className="hover:text-white">Community Rules</button></li>
              <li><button onClick={() => onOpenView("rules")} className="hover:text-white">DMCA</button></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & selectors */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.04] pt-4 text-[11px] text-zinc-500 sm:flex-row">
          <p>© 2024 StreamCore. All rights reserved.</p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-zinc-400 hover:text-white cursor-pointer">
              <Globe className="h-3.5 w-3.5" />
              <span>English ⌄</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400 hover:text-white cursor-pointer">
              <Moon className="h-3.5 w-3.5" />
              <span>Dark ⌄</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
