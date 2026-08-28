import { useState, useMemo } from "react";
import { ChevronUp } from "lucide-react";
import { aggregateTopCategories, type CategoryTab } from "@/lib/categories";
import type { Member, Post } from "@/lib/community";

export function TopCategoriesWidget({
  members,
  posts,
  onOpenCategory,
}: {
  members: Member[];
  posts: Post[];
  onOpenCategory?: (categoryName: string) => void;
}) {
  const [tab, setTab] = useState<CategoryTab>("top");

  const categories = useMemo(() => {
    return aggregateTopCategories(members, posts, tab);
  }, [members, posts, tab]);

  const topCategory = categories[0];

  return (
    <div className="rounded-2xl border border-border bg-popover p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black tracking-widest text-primary flex items-center gap-1.5">
            <span>🔥</span> TOP CATEGORIES
          </p>
          <h2 className="mt-0.5 text-xl font-extrabold">Where the network is watching</h2>
        </div>
        <div className="flex gap-1 rounded-xl bg-background p-1 border border-border">
          <button
            onClick={() => setTab("top")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              tab === "top" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🔥 Top
          </button>
          <button
            onClick={() => setTab("rising")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              tab === "rising" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🚀 Rising
          </button>
          <button
            onClick={() => setTab("creators")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              tab === "creators" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            👥 Streamers
          </button>
          <button
            onClick={() => setTab("discussed")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
              tab === "discussed" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            💬 Discussed
          </button>
        </div>
      </div>

      {topCategory && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex items-start gap-3">
          <span className="text-xl shrink-0">🤖</span>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-extrabold text-foreground flex items-center gap-2">
              <span>{topCategory.aiTrend.badge}</span>
              <span className="text-muted-foreground font-normal">· AI Trend Pulse</span>
            </p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              {topCategory.aiTrend.summary}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {categories.slice(0, 5).map((cat, index) => (
          <div
            key={cat.id}
            className="group flex items-center justify-between gap-3 rounded-xl bg-background p-2.5 border border-border/70 hover:border-primary/50 transition-all cursor-pointer"
            onClick={() => onOpenCategory?.(cat.name)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`grid h-6 w-6 place-items-center rounded-lg text-xs font-black shrink-0 ${
                  index === 0
                    ? "bg-amber-500/20 text-amber-400"
                    : index === 1
                      ? "bg-zinc-400/20 text-zinc-300"
                      : index === 2
                        ? "bg-amber-700/20 text-amber-500"
                        : "bg-popover text-muted-foreground"
                }`}
              >
                #{index + 1}
              </span>

              {/* Twitch Box Art Thumbnail */}
              <div className="h-11 w-8 shrink-0 overflow-hidden rounded-md bg-accent border border-border/50">
                <img
                  src={cat.boxArtUrl}
                  alt={cat.name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                  <span>{cat.emoji}</span>
                  <span className="truncate">{cat.name}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {cat.creatorsLive.toLocaleString()} creators live · {(cat.totalViewers / 1000).toFixed(1)}K viewers
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="flex items-center justify-end text-xs font-black text-emerald-400">
                <ChevronUp className="h-3 w-3" />
                {cat.growthRate}%
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">
                {cat.score} score
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
