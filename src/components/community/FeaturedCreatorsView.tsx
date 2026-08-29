import { useMemo, useState } from "react";
import { Eye, Radio, Search, Star, Users } from "lucide-react";
import { type Member, type Post } from "@/lib/community";
import { Avatar } from "./Bits";
import { BrandIcon } from "./BrandIcon";

function engagementFor(memberId: string, posts: Post[]) {
  return posts
    .filter((post) => post.authorId === memberId)
    .reduce((sum, post) => {
      const reactions = Object.values(post.reactions ?? {}).reduce((total, count) => total + count, 0);
      return sum + reactions + (post.likes?.length ?? 0) + (post.comments?.length ?? 0) + (post.shares ?? 0);
    }, 0);
}

export function FeaturedCreatorsView({
  members,
  posts,
  onPick,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  isAdmin?: boolean;
  setToast?: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);

  const ranked = useMemo(() => {
    return members
      .map((member) => ({ member, engagement: engagementFor(member.id, posts) }))
      .sort((left, right) => {
        if (left.member.status === "live" && right.member.status !== "live") return -1;
        if (right.member.status === "live" && left.member.status !== "live") return 1;
        const followerDelta = (right.member.followers ?? 0) - (left.member.followers ?? 0);
        return followerDelta || right.engagement - left.engagement;
      });
  }, [members, posts]);

  const filtered = ranked.filter(({ member }) => {
    if (liveOnly && member.status !== "live") return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [member.name, member.handle, member.gameName, member.platform].some((value) => value?.toLowerCase().includes(query));
  });

  const hero = filtered[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400"><Star className="h-4 w-4" />Real creator discovery</p>
          <h1 className="mt-1 text-3xl font-black">Featured Creators</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ordered from current live status, synced Twitch followers and real StreamCore engagement.</p>
        </div>
        <div className="flex gap-2">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creators" className="rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none focus:border-primary" />
          </label>
          <button onClick={() => setLiveOnly((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${liveOnly ? "border-live bg-live/15 text-live" : "border-border bg-card"}`}>Live only</button>
        </div>
      </header>

      {hero && (
        <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-card">
          {hero.member.banner && <img src={hero.member.banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/95 to-card/60" />
          <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center">
            <Avatar member={hero.member} size={88} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black">{hero.member.name}</h2>
                {hero.member.status === "live" && <span className="rounded-full bg-live px-2 py-1 text-[10px] font-black text-white">LIVE</span>}
              </div>
              <p className="text-sm text-muted-foreground">{hero.member.handle}</p>
              {hero.member.streamTitle && <p className="mt-2 max-w-2xl text-sm font-semibold">{hero.member.streamTitle}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><BrandIcon platform={hero.member.platform} size={14} />{hero.member.platform}</span>
                <span>{hero.member.followers?.toLocaleString() ?? "Not synced"} followers</span>
                {hero.member.status === "live" && <span>{(hero.member.viewerCount ?? 0).toLocaleString()} viewers</span>}
                <span>{hero.engagement.toLocaleString()} community engagements</span>
              </div>
            </div>
            <button onClick={() => onPick(hero.member)} className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black hover:bg-amber-300">View profile</button>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(hero ? 1 : 0).map(({ member, engagement }) => (
          <button key={member.id} onClick={() => onPick(member)} className="overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:-translate-y-0.5 hover:border-primary/50">
            <div className="h-28 bg-accent bg-cover bg-center" style={member.banner ? { backgroundImage: `url(${member.banner})` } : undefined} />
            <div className="-mt-7 p-4">
              <Avatar member={member} size={56} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0"><h3 className="truncate font-black">{member.name}</h3><p className="truncate text-xs text-muted-foreground">{member.handle}</p></div>
                {member.status === "live" && <Radio className="h-4 w-4 text-live" />}
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{member.streamTitle || member.bio || "No creator description supplied."}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
                <span className="rounded-lg bg-background p-2"><Users className="mx-auto mb-1 h-3 w-3" />{member.followers?.toLocaleString() ?? "—"}</span>
                <span className="rounded-lg bg-background p-2"><Eye className="mx-auto mb-1 h-3 w-3" />{member.status === "live" ? (member.viewerCount ?? 0).toLocaleString() : "Offline"}</span>
                <span className="rounded-lg bg-background p-2"><Star className="mx-auto mb-1 h-3 w-3" />{engagement.toLocaleString()}</span>
              </div>
            </div>
          </button>
        ))}
      </section>

      {!filtered.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No real creators match this filter.</div>}
    </div>
  );
}
