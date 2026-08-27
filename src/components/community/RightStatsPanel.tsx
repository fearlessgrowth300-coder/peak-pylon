import { StreamCoreStatsChart } from "./StreamCoreStatsChart";
import {
  STREAMCORE_STATS,
  ONLINE_CREATORS,
  UPCOMING_EVENTS,
  RECENT_ACTIVITY,
} from "@/lib/streamcore-data";
import { ChevronRight, Users, Sparkles, Trophy, Calendar, Flame } from "lucide-react";

interface RightStatsPanelProps {
  onOpenView?: (view: string) => void;
  onPickCreator?: (creator: { name: string; avatar: string }) => void;
}

export function RightStatsPanel({ onOpenView, onPickCreator }: RightStatsPanelProps) {
  return (
    <aside className="w-80 shrink-0 space-y-5 border-l border-white/[0.06] bg-[#0c0e17] p-4 text-white overflow-y-auto">
      {/* 1. STREAMCORE STATS */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-zinc-300">
            STREAMCORE STATS
          </span>
        </div>

        {/* Wave sparkline chart */}
        <StreamCoreStatsChart />

        {/* 2x2 Metrics Grid */}
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
          <div>
            <p className="text-lg font-extrabold text-white">{STREAMCORE_STATS.membersShort}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Total Members
            </p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-white">{STREAMCORE_STATS.onlineShort}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Online Now
            </p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-white">{STREAMCORE_STATS.liveStreamsShort}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Live Streams
            </p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-white">{STREAMCORE_STATS.postsTodayShort}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Posts Today
            </p>
          </div>
        </div>

        {/* View Full Analytics button */}
        <button
          onClick={() => onOpenView?.("analytics")}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#5c54e5]/20 py-2 text-xs font-bold text-[#a5b4fc] transition-colors hover:bg-[#5c54e5]/30 hover:text-white"
        >
          View Full Analytics
        </button>
      </div>

      {/* 2. WHO'S ONLINE */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-zinc-300">
            WHO'S ONLINE
          </span>
          <button
            onClick={() => onOpenView?.("live-now")}
            className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
          >
            View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {ONLINE_CREATORS.map((creator) => (
            <button
              key={creator.id}
              onClick={() => onPickCreator?.(creator)}
              className="flex w-full items-center gap-3 text-left transition-colors hover:opacity-80"
            >
              <div className="relative">
                <img
                  src={creator.avatar}
                  alt={creator.name}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-transparent"
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#121524] bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{creator.name}</p>
                <p className="truncate text-[11px] text-zinc-400">{creator.statusText}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 border-t border-white/[0.06] pt-3 text-center">
          <button
            onClick={() => onOpenView?.("creators")}
            className="text-xs font-medium text-zinc-400 hover:text-white"
          >
            And more... <span className="text-zinc-500 font-semibold">{STREAMCORE_STATS.totalOnlineExtra}</span>
          </button>
        </div>
      </div>

      {/* 3. UPCOMING EVENTS */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-zinc-300">
            UPCOMING EVENTS
          </span>
          <button
            onClick={() => onOpenView?.("events")}
            className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white"
          >
            View All <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {UPCOMING_EVENTS.map((event, index) => (
            <div
              key={event.id}
              className="rounded-xl bg-[#161a2c] p-3 border border-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br ${event.gradient} text-[10px] text-white`}>
                      {index === 0 ? <Trophy className="h-3 w-3" /> : index === 1 ? <Flame className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                    </span>
                    <p className="truncate text-xs font-bold text-white">{event.title}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">{event.dateTime}</p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.04] pt-2">
                <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                  <Users className="h-3 w-3 text-indigo-400" />
                  {event.attendees}
                </span>
                <button
                  onClick={() => alert(`Registered for ${event.title}!`)}
                  className="rounded-lg bg-[#5c54e5] px-3 py-1 text-[11px] font-bold text-white transition-all hover:bg-[#6c64f5]"
                >
                  Register
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. RECENT ACTIVITY */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#121524] p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-widest text-zinc-300">
            RECENT ACTIVITY
          </span>
        </div>

        <div className="space-y-3">
          {RECENT_ACTIVITY.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 text-left"
            >
              <img
                src={activity.creatorAvatar}
                alt={activity.creatorName}
                className="h-7 w-7 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-200">
                  <strong className="font-bold text-white">{activity.creatorName}</strong>{" "}
                  <span className="text-zinc-400">{activity.action}</span>
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-zinc-500">{activity.timeAgo}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => onOpenView?.("trending")}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-zinc-800/60 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          View All Activity
        </button>
      </div>
    </aside>
  );
}
