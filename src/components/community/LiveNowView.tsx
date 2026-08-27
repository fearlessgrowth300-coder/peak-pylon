import { useState } from "react";
import { LIVE_STREAMS, type LiveStreamItem } from "@/lib/streamcore-data";
import {
  Tv,
  Radio,
  Users,
  Play,
  Volume2,
  Maximize2,
  CheckCircle2,
  Heart,
  Share2,
  X,
  MessageSquare,
  Sparkles,
} from "lucide-react";

interface LiveNowViewProps {
  onPickCreator?: (creator: { name: string; avatar: string }) => void;
}

export function LiveNowView({ onPickCreator }: LiveNowViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeStreamModal, setActiveStreamModal] = useState<LiveStreamItem | null>(null);
  const [followedStreamers, setFollowedStreamers] = useState<Record<string, boolean>>({});

  const categories = [
    "All",
    "Fortnite",
    "GTA V",
    "Just Chatting",
    "Call of Duty",
    "Escape from Tarkov",
    "Valorant",
    "Minecraft",
    "Apex Legends",
  ];

  const filteredStreams = LIVE_STREAMS.filter((s) => {
    if (selectedCategory === "All") return true;
    return s.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const heroStream = LIVE_STREAMS[0];

  const toggleFollow = (id: string) => {
    setFollowedStreamers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 space-y-6">
      {/* Top Title & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md">
              <Tv className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              LIVE NOW
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              3,821 Streams Active
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Browse high-energy live broadcasts, esports tournaments, and interactive creator streams.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? "bg-[#5c54e5] text-white shadow-md shadow-indigo-600/30"
                  : "bg-[#121524] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Stream Hero Theater (when "All" or Fortnite is selected) */}
      {selectedCategory === "All" && heroStream && (
        <section className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#121524] shadow-2xl">
          <div className="grid lg:grid-cols-3">
            {/* Main Stream Canvas */}
            <div className="relative aspect-video w-full overflow-hidden bg-black lg:col-span-2 group">
              <img
                src={heroStream.thumbnail}
                alt={heroStream.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

              {/* Stream Badges Overlay */}
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
                <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                  {heroStream.viewers}
                </span>
                <span className="rounded bg-indigo-600/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                  {heroStream.category}
                </span>
              </div>

              {/* Player Controls simulation */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setActiveStreamModal(heroStream)}
                  className="flex items-center gap-2 rounded-xl bg-[#5c54e5] px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-[#6c64f5]"
                >
                  <Play className="h-3.5 w-3.5 fill-white" /> Watch Stream
                </button>
                <div className="flex items-center gap-2 text-white">
                  <Volume2 className="h-4 w-4" />
                  <Maximize2 className="h-4 w-4 cursor-pointer" onClick={() => setActiveStreamModal(heroStream)} />
                </div>
              </div>
            </div>

            {/* Featured Channel Meta & Mini Chat Preview */}
            <div className="flex flex-col justify-between border-t border-white/[0.06] p-5 lg:border-l lg:border-t-0 bg-[#0f111e]">
              <div>
                <div className="flex items-center justify-between">
                  <div
                    onClick={() =>
                      onPickCreator?.({ name: heroStream.creatorName, avatar: heroStream.avatar })
                    }
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <img
                      src={heroStream.avatar}
                      alt={heroStream.creatorName}
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-extrabold text-white">
                          {heroStream.creatorName}
                        </p>
                        <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                      </div>
                      <p className="text-xs text-zinc-400">{heroStream.creatorHandle}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleFollow(heroStream.id)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                      followedStreamers[heroStream.id]
                        ? "bg-zinc-700 text-white"
                        : "bg-[#5c54e5] text-white hover:bg-[#6c64f5]"
                    }`}
                  >
                    {followedStreamers[heroStream.id] ? "Following" : "Follow"}
                  </button>
                </div>

                <h3 className="mt-4 text-sm font-bold text-white">
                  {heroStream.title}
                </h3>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {heroStream.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-300"
                    >
                      #{tag}
                    </span>
                  ))}
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Uptime {heroStream.uptime}
                  </span>
                </div>
              </div>

              {/* Simulated Live Chat Bar */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#141727] p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                  <span>LIVE CHAT</span>
                  <span className="text-emerald-400">● 1.2K chatting</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <p className="truncate text-zinc-300">
                    <strong className="text-indigo-400">PixelMaya:</strong> WHAT A SHOT!! 🔥
                  </p>
                  <p className="truncate text-zinc-300">
                    <strong className="text-pink-400">GamerGuy99:</strong> top 250 today for sure!
                  </p>
                  <p className="truncate text-zinc-300">
                    <strong className="text-amber-400">KaiVertex:</strong> ggwp everyone in chat
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Streams Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-200">
            ALL LIVE STREAMS ({filteredStreams.length})
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStreams.map((stream) => (
            <div
              key={stream.id}
              onClick={() => setActiveStreamModal(stream)}
              className="group cursor-pointer rounded-2xl border border-white/[0.06] bg-[#121524] p-3 transition-all hover:border-indigo-500/50 hover:bg-[#15192c] hover:shadow-xl"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
                <img
                  src={stream.thumbnail}
                  alt={stream.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute left-2 top-2 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">
                  LIVE
                </span>
                <span className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur-xs">
                  {stream.viewers}
                </span>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5c54e5] text-white shadow-xl">
                    <Play className="h-4 w-4 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Title & Creator */}
              <div className="mt-3 flex gap-2.5">
                <img
                  src={stream.avatar}
                  alt={stream.creatorName}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white group-hover:text-indigo-400">
                    {stream.title}
                  </p>
                  <p className="text-[11px] font-semibold text-zinc-300">
                    {stream.creatorName}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {stream.category}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {stream.tags && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {stream.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Stream Player Modal */}
      {activeStreamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0f111e] shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setActiveStreamModal(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Video Canvas */}
            <div className="relative aspect-video w-full bg-black">
              <img
                src={activeStreamModal.thumbnail}
                alt={activeStreamModal.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center text-white space-y-2">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-xl animate-pulse">
                    <Play className="h-6 w-6 fill-white ml-1" />
                  </div>
                  <p className="text-sm font-bold">Connecting to Live Stream...</p>
                  <span className="inline-block rounded-full bg-rose-600 px-3 py-0.5 text-[10px] font-bold">
                    ● {activeStreamModal.viewers}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Info Bar */}
            <div className="flex items-center justify-between p-4 bg-[#121524]">
              <div className="flex items-center gap-3">
                <img
                  src={activeStreamModal.avatar}
                  alt={activeStreamModal.creatorName}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {activeStreamModal.title}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {activeStreamModal.creatorName} • {activeStreamModal.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFollow(activeStreamModal.id)}
                  className="rounded-xl bg-[#5c54e5] px-4 py-2 text-xs font-bold text-white hover:bg-[#6c64f5]"
                >
                  {followedStreamers[activeStreamModal.id] ? "Following" : "Follow"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
