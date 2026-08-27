import { useState } from "react";
import { DISCUSSIONS, TRENDING_TOPICS, FEATURED_CREATORS } from "@/lib/streamcore-data";
import type { Member, Post } from "@/lib/community";
import {
  Flame,
  MessageCircle,
  Heart,
  Share2,
  Bookmark,
  Sparkles,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
} from "lucide-react";

interface TrendingViewProps {
  onPickCreator?: (creator: { name: string; avatar: string }) => void;
  communityPosts?: Post[];
  members?: Map<string, Member>;
}

export function TrendingView({ onPickCreator, communityPosts = [], members = new Map() }: TrendingViewProps) {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});

  const filterTabs = ["All", "Discussions", "Guides & Setups", "Polls", "Updates"];

  const filteredDiscussions = DISCUSSIONS.filter((item) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Discussions") return item.tag === "Discussion";
    if (activeFilter === "Guides & Setups") return item.tag === "Guide" || item.tag === "Setup";
    if (activeFilter === "Polls") return item.tag === "Poll";
    if (activeFilter === "Updates") return item.tag === "Update";
    return true;
  });

  const toggleLike = (id: string) => {
    setLikedPosts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSave = (id: string) => {
    setSavedPosts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
      {/* Top Banner / Title */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-md">
              <Flame className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              TRENDING
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Top conversations, debates, and strategies happening across the creator network.
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

      {/* Main Grid: Left Posts Feed, Right Trending Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Posts Feed (2 cols) */}
        <div className="space-y-4 lg:col-span-2">
          {[...communityPosts].sort((a, b) => b.time - a.time).map((post) => {
            const author = members.get(post.authorId);
            return <article key={post.id} className="rounded-2xl border border-indigo-500/30 bg-[#121524] p-5 shadow-lg">
              <div className="flex items-center gap-3"><img src={author?.avatar || "https://api.dicebear.com/9.x/initials/svg?seed=StreamCore"} alt="" className="h-10 w-10 rounded-full object-cover" /><div><p className="text-sm font-bold text-white">{author?.name ?? "StreamCore"} <span className="ml-1 text-[10px] text-indigo-300">OWNER POST</span></p><p className="text-[11px] text-zinc-400">{new Date(post.time).toLocaleString()}</p></div><span className="ml-auto rounded-lg border border-indigo-500/30 bg-indigo-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-300">Update</span></div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{post.text}</p>{post.image && <img src={post.image} alt="Trending post attachment" className="mt-4 max-h-80 w-full rounded-xl object-cover" />}<div className="mt-4 flex gap-5 border-t border-white/[0.06] pt-3 text-xs text-zinc-400"><button className="flex items-center gap-1.5 hover:text-rose-400"><Heart className="h-4 w-4"/> Like</button><button className="flex items-center gap-1.5 hover:text-white"><MessageCircle className="h-4 w-4"/> Comment</button><button className="flex items-center gap-1.5 hover:text-white"><Share2 className="h-4 w-4"/> Share</button></div>
            </article>;
          })}
          {filteredDiscussions.map((post) => {
            const isLiked = !!likedPosts[post.id];
            const isSaved = !!savedPosts[post.id];

            return (
              <article
                key={post.id}
                className="rounded-2xl border border-white/[0.06] bg-[#121524] p-5 shadow-lg transition-all hover:border-indigo-500/40 hover:bg-[#14182b]"
              >
                {/* Author Info & Tag Badge */}
                <div className="flex items-center justify-between gap-3">
                  <div
                    onClick={() =>
                      onPickCreator?.({ name: post.authorName, avatar: post.authorAvatar })
                    }
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-500/20"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white hover:underline">
                          {post.authorName}
                        </span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {post.authorHandle || "@creator"} • {post.timeAgo}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      post.tag === "Discussion"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : post.tag === "Poll"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : post.tag === "Guide"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : post.tag === "Setup"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                    }`}
                  >
                    {post.tag}
                  </span>
                </div>

                {/* Post Title & Content */}
                <h3 className="mt-3.5 text-base font-extrabold text-white sm:text-lg">
                  {post.title}
                </h3>

                {post.content && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-300 sm:text-sm">
                    {post.content}
                  </p>
                )}

                {/* Post Attachment Image if available */}
                {post.image && (
                  <div className="mt-4 overflow-hidden rounded-xl bg-zinc-900 border border-white/[0.04]">
                    <img
                      src={post.image}
                      alt="Discussion attachment"
                      className="max-h-80 w-full object-cover"
                    />
                  </div>
                )}

                {/* Engagement Action Bar */}
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-xs text-zinc-400">
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1.5 transition-colors ${
                        isLiked ? "text-rose-400 font-bold" : "hover:text-white"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? "fill-rose-400" : ""}`} />
                      <span>{isLiked ? "Liked" : post.likes}</span>
                    </button>

                    <button className="flex items-center gap-1.5 transition-colors hover:text-white">
                      <MessageCircle className="h-4 w-4 text-zinc-400" />
                      <span>{post.replies}</span>
                    </button>

                    <button className="flex items-center gap-1.5 transition-colors hover:text-white">
                      <Share2 className="h-4 w-4 text-zinc-400" />
                      <span>{post.shares || "Share"}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => toggleSave(post.id)}
                    className={`transition-colors ${
                      isSaved ? "text-indigo-400" : "hover:text-white"
                    }`}
                    title="Bookmark"
                  >
                    <Bookmark className={`h-4 w-4 ${isSaved ? "fill-indigo-400" : ""}`} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Right Column: Trending Sidebar */}
        <div className="space-y-5">
          {/* Trending Topics Box */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#121524] p-5 shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-200">
                TRENDING TOPICS
              </h2>
            </div>

            <div className="mt-3 space-y-3">
              {TRENDING_TOPICS.map((topic, i) => (
                <div
                  key={topic.tag}
                  className="flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-extrabold text-white group-hover:text-indigo-400 transition-colors">
                      {topic.tag}
                    </p>
                    <p className="text-[10px] text-zinc-400">{topic.category}</p>
                  </div>
                  <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                    {topic.posts}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Most Active Creators */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#121524] p-5 shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-200">
                MOST ACTIVE CREATORS
              </h2>
            </div>

            <div className="mt-3 space-y-3">
              {FEATURED_CREATORS.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onPickCreator?.({ name: c.name, avatar: c.avatar })}
                  className="flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">{c.followers}</p>
                    </div>
                  </div>
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                    {c.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
