import { useState } from "react";
import { CLIPS, type ClipItem } from "@/lib/streamcore-data";
import {
  Film,
  Play,
  Eye,
  Heart,
  Share2,
  Bookmark,
  X,
  Volume2,
  Maximize2,
  Sparkles,
  TrendingUp,
  Clock,
} from "lucide-react";

interface ClipsViewProps {
  onPickCreator?: (creator: { name: string; avatar: string }) => void;
}

export function ClipsView({ onPickCreator }: ClipsViewProps) {
  const [activeFilter, setActiveFilter] = useState<string>("Trending");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeClipModal, setActiveClipModal] = useState<ClipItem | null>(null);
  const [likedClips, setLikedClips] = useState<Record<string, boolean>>({});

  const filterTabs = ["Trending", "Most Viewed", "Recent", "Top This Week"];
  const categories = [
    "All",
    "Call of Duty",
    "Fortnite",
    "Just Chatting",
    "Warzone",
    "Elden Ring",
    "Valorant",
    "GTA V",
  ];

  const filteredClips = CLIPS.filter((c) => {
    if (selectedCategory === "All") return true;
    return c.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const toggleLike = (id: string) => {
    setLikedClips((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6 space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white shadow-md">
              <Film className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              CLIPS
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Discover the best gaming highlights, clutches, and funny moments from community streamers.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/[0.06] bg-[#121524] p-1 shadow-sm">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeFilter === tab
                  ? "bg-[#5c54e5] text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
              selectedCategory === cat
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "bg-[#121524] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Clips Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-200">
            {selectedCategory === "All" ? "ALL CLIPS" : `${selectedCategory.toUpperCase()} CLIPS`} ({filteredClips.length})
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredClips.map((clip) => {
            const isLiked = !!likedClips[clip.id];

            return (
              <div
                key={clip.id}
                onClick={() => setActiveClipModal(clip)}
                className="group cursor-pointer rounded-2xl border border-white/[0.06] bg-[#121524] p-3 transition-all hover:border-indigo-500/50 hover:bg-[#15192c] hover:shadow-xl"
              >
                {/* Video Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
                  <img
                    src={clip.thumbnail}
                    alt={clip.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Duration Tag */}
                  <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                    {clip.duration}
                  </span>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5c54e5] text-white shadow-xl">
                      <Play className="h-5 w-5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Title & Creator */}
                <div className="mt-3 flex gap-2.5">
                  <img
                    src={clip.creatorAvatar}
                    alt={clip.creatorName}
                    className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white group-hover:text-indigo-400">
                      {clip.title}
                    </p>
                    <p className="text-[11px] font-semibold text-zinc-300 mt-0.5">
                      {clip.creatorName}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {clip.category}
                    </p>
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-2.5 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5 text-indigo-400" />
                    {clip.views}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(clip.id);
                      }}
                      className={`flex items-center gap-1 transition-colors ${
                        isLiked ? "text-rose-400 font-bold" : "hover:text-white"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-rose-400" : ""}`} />
                      <span>{isLiked ? "Liked" : clip.likes || "Like"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Clip Modal Player */}
      {activeClipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0f111e] shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setActiveClipModal(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Video Canvas Simulation */}
            <div className="relative aspect-video w-full bg-black">
              <img
                src={activeClipModal.thumbnail}
                alt={activeClipModal.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="text-center text-white space-y-2">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 shadow-2xl animate-pulse">
                    <Play className="h-7 w-7 fill-white ml-1" />
                  </div>
                  <p className="text-sm font-bold">Playing Clip ({activeClipModal.duration})</p>
                  <span className="inline-block rounded-full bg-black/70 px-3 py-0.5 text-[10px] text-zinc-300">
                    👁 {activeClipModal.views}
                  </span>
                </div>
              </div>
            </div>

            {/* Clip Details Bar */}
            <div className="flex items-center justify-between p-4 bg-[#121524]">
              <div className="flex items-center gap-3">
                <img
                  src={activeClipModal.creatorAvatar}
                  alt={activeClipModal.creatorName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-500"
                />
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {activeClipModal.title}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Clipped from {activeClipModal.creatorName} • {activeClipModal.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleLike(activeClipModal.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    likedClips[activeClipModal.id]
                      ? "bg-rose-600 text-white"
                      : "bg-white/[0.08] text-white hover:bg-white/[0.12]"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${likedClips[activeClipModal.id] ? "fill-white" : ""}`} />
                  {likedClips[activeClipModal.id] ? "Liked" : "Like"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
