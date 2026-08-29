import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Eye, Radio, Search, Users } from "lucide-react";
import { type Member, type Post } from "@/lib/community";
import { calculateCreatorMetrics } from "@/lib/rankings";
import { Avatar } from "./Bits";
import { BrandIcon } from "./BrandIcon";

export type DirectoryQuickFilter = "all" | "live" | "rising" | "featured" | "partners" | "verified" | "collabs" | "new";
type Sort = "followers" | "viewers" | "activity" | "recent";

export function CreatorDirectoryView({
  members,
  posts,
  onPick,
  initialFilter,
}: {
  members: Member[];
  posts: Post[];
  onPick: (member: Member) => void;
  setToast?: (message: string) => void;
  initialFilter?: DirectoryQuickFilter;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DirectoryQuickFilter>(initialFilter ?? "all");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState<Sort>("followers");

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  const rows = useMemo(() => members.map((member) => ({
    member,
    metrics: calculateCreatorMetrics(member, posts),
  })), [members, posts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = rows.filter(({ member, metrics }) => {
      if (platform !== "all" && member.platform.toLowerCase() !== platform) return false;
      if (filter === "live" && member.status !== "live") return false;
      if (filter === "partners" && member.role !== "partner") return false;
      if (filter === "verified" && member.role !== "verified" && member.role !== "partner" && !member.real) return false;
      if (filter === "rising" && member.role !== "rising") return false;
      if (filter === "new" && (!member.joined || member.joined < Date.now() - 30 * 86_400_000)) return false;
      if (filter === "featured" && member.role !== "partner" && member.status !== "live") return false;
      if (filter === "collabs") return false;
      return !query || [member.name, member.handle, member.platform, member.bio, member.gameName, member.streamTitle]
        .some((value) => value?.toLowerCase().includes(query));
    });

    result.sort((left, right) => {
      if (sort === "viewers") return right.metrics.currentViewers - left.metrics.currentViewers;
      if (sort === "activity") return right.metrics.communityPosts + right.metrics.communityReactions - left.metrics.communityPosts - left.metrics.communityReactions;
      if (sort === "recent") return (right.member.joined ?? 0) - (left.member.joined ?? 0);
      return right.metrics.followers - left.metrics.followers;
    });
    return result;
  }, [filter, platform, rows, search, sort]);

  const platforms = [...new Set(members.map((member) => member.platform).filter(Boolean))];

  return (
    <div className="space-y-6 px-4 py-6">
      <header>
        <p className="text-xs font-black uppercase tracking-widest text-primary">Supabase members + Twitch fields</p>
        <h1 className="mt-1 text-3xl font-black">{filter === "rising" ? "Rising Creators" : "Creator Directory"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every number shown is currently stored in StreamCore or returned by Twitch.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {([
          ["all", "All"],
          ["live", "Live now"],
          ["partners", "Partners"],
          ["verified", "Verified"],
          ["rising", "Rising role"],
          ["new", "New members"],
        ] as Array<[DirectoryQuickFilter, string]>).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`rounded-xl px-3 py-2 text-xs font-bold ${filter === id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}>{label}</button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search real creator fields" className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none" /></label>
        <select value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs"><option value="all">All platforms</option>{platforms.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs"><option value="followers">Most followers</option><option value="viewers">Current viewers</option><option value="activity">Community activity</option><option value="recent">Recently joined</option></select>
      </div>

      <p className="text-xs font-bold text-muted-foreground">Showing {filtered.length} of {members.length} creators</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(({ member, metrics }) => (
          <article key={member.id} onClick={() => onPick(member)} className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/50">
            <div className="relative h-28 bg-accent bg-cover bg-center" style={member.banner ? { backgroundImage: `url(${member.banner})` } : undefined}>
              {member.status === "live" && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-live px-2 py-1 text-[10px] font-black text-white"><Radio className="h-3 w-3" />LIVE</span>}
            </div>
            <div className="-mt-7 p-4">
              <Avatar member={member} size={56} />
              <div className="mt-2 flex items-center gap-1.5"><h2 className="truncate font-black">{member.name}</h2>{(member.role === "verified" || member.role === "partner") && <CheckCircle className="h-4 w-4 text-primary" />}</div>
              <p className="truncate text-xs text-muted-foreground">{member.handle}</p>
              <p className="mt-3 line-clamp-2 min-h-8 text-xs text-muted-foreground">{member.status === "live" ? member.streamTitle || member.bio : member.bio || "No biography supplied."}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><BrandIcon platform={member.platform} size={13} />{member.platform}</span>{member.gameName && <span>{member.gameName}</span>}<span>{member.role || "member"}</span></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <DataPoint icon={<Users className="h-3 w-3" />} value={metrics.followers.toLocaleString()} label="Followers" />
                <DataPoint icon={<Eye className="h-3 w-3" />} value={member.status === "live" ? metrics.currentViewers.toLocaleString() : "Offline"} label="Viewers" />
                <DataPoint value={metrics.communityPosts.toLocaleString()} label="Posts" />
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No creators match this real-data filter.</div>}
    </div>
  );
}

function DataPoint({ icon, value, label }: { icon?: React.ReactNode; value: string; label: string }) {
  return <div className="rounded-lg bg-background p-2"><p className="flex items-center justify-center gap-1 text-xs font-black">{icon}{value}</p><p className="mt-1 text-[9px] uppercase text-muted-foreground">{label}</p></div>;
}
