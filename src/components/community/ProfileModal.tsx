import { ExternalLink, MessageSquare, PhoneCall, UserPlus, Radio, Pin } from "lucide-react";
import { useState } from "react";
import { formatDate, type Connection, type Member } from "@/lib/community";
import { Avatar } from "./Bits";
import { BrandIcon, VerifiedCheck } from "./BrandIcon";

function memberConnections(member: Member): Connection[] {
  const source = member.connections?.length
    ? member.connections
    : member.link
      ? [
      {
        id: "primary",
        platform: member.platform,
        label: member.handle.replace(/^@/, ""),
        url: member.link,
        verified: true,
      },
    ]
      : [];

  const primaryUrl = normalizeConnectionUrl(member.link);
  const unique = new Map<string, Connection>();
  for (const connection of source) {
    const normalizedUrl = normalizeConnectionUrl(connection.url);
    const key = normalizedUrl || `${connection.platform}:${connection.label}`.toLowerCase();
    const verified = connection.verified || (
      member.platform.toLowerCase() === "twitch" &&
      connection.platform.toLowerCase() === "twitch" &&
      Boolean(primaryUrl) &&
      normalizedUrl === primaryUrl
    );
    const existing = unique.get(key);
    unique.set(key, existing
      ? { ...existing, verified: existing.verified || verified }
      : { ...connection, verified });
  }
  return [...unique.values()];
}

function normalizeConnectionUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

function channelName(member: Member) {
  const fallback = member.handle.replace(/^@/, "") || "—";
  if (!member.link) return fallback;
  try {
    const path = new URL(member.link).pathname.split("/").filter(Boolean);
    return path.at(-1) || fallback;
  } catch {
    return fallback;
  }
}

export function ProfileModal({
  member,
  onClose,
  isAdmin = false,
  isPinned = false,
  onTogglePin,
}: {
  member: Member | null;
  onClose: () => void;
  isAdmin?: boolean;
  isPinned?: boolean;
  onTogglePin?: (id: string) => void;
}) {
  const [notice, setNotice] = useState("");
  if (!member) return null;
  const connections = memberConnections(member);
  const statusLabel =
    member.status === "live"
      ? "LIVE NOW"
      : member.status === "online"
        ? "Online"
        : "Offline";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-popover shadow-elevated sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/40 sm:hidden" />

        <div
          className="relative h-40 bg-primary/60 bg-cover bg-center"
          style={member.banner ? { backgroundImage: `url(${member.banner})` } : undefined}
        >
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-foreground"
          >
            ×
          </button>
        </div>

        <div className="-mt-14 px-4 pb-8">
          <div className="w-fit rounded-full border-[6px] border-popover">
            <Avatar member={member} size={84} />
          </div>

          <div className="mt-3">
            <h2 className="flex items-center gap-1 truncate text-2xl font-extrabold">{member.name} {(connections.some((connection) => connection.verified) || member.platform === "Twitch") && <VerifiedCheck />}</h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {member.handle}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  member.status === "live"
                    ? "bg-live/20 text-live"
                    : member.status === "online"
                      ? "bg-online/20 text-online"
                      : "bg-accent text-muted-foreground"
                }`}
              >
                {statusLabel}
              </span>
            </p>
          </div>

          <div className={`mt-4 grid gap-2 ${member.status === "live" ? "grid-cols-2" : "grid-cols-[minmax(0,1fr)_auto_auto]"}`}>
            {member.status === "live" && member.link ? <a href={member.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-live px-3 py-2.5 text-sm font-bold text-white hover:bg-live/85"><Radio className="h-4 w-4"/>Watch stream</a> : null}
            <button onClick={() => setNotice("Friends are available only to verified Twitch or Kick Partners.")} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85"><UserPlus className="h-4 w-4" /> Add Friend</button>
            <button onClick={() => setNotice("Private messages are available only to verified Twitch or Kick Partners.")} aria-label="Message" className="grid h-10 w-10 place-items-center rounded-lg bg-accent hover:bg-accent/70"><MessageSquare className="h-4 w-4" /></button>
            <button onClick={() => setNotice("Private calls are available only to verified Twitch or Kick Partners.")} aria-label="Call" className="grid h-10 w-10 place-items-center rounded-lg bg-accent hover:bg-accent/70"><PhoneCall className="h-4 w-4" /></button>
          </div>
          {onTogglePin && (
            <button
              onClick={() => onTogglePin(member.id)}
              className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition-all ${
                isPinned
                  ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25"
                  : "border-border bg-accent/40 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? "rotate-45 fill-primary text-primary" : ""}`} />
              <span>{isPinned ? "Pinned to Left Rail (Click to Unpin)" : "📌 Pin Creator to Left Rail"}</span>
            </button>
          )}
          {notice && <p className="mt-2 rounded-lg bg-accent/60 px-3 py-2 text-xs text-muted-foreground">{notice}</p>}

          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-border bg-background"><div className="p-3 text-center"><p className="text-base font-black">{member.status === "live" ? "LIVE" : "—"}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Stream status</p></div><div className="border-x border-border p-3 text-center"><p className="text-base font-black">{connections.length}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Channels</p></div><div className="p-3 text-center"><p className="text-base font-black">{member.real ? "Verified" : "Creator"}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Network role</p></div></div>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            About me
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            {member.bio || "Community creator profile."}
          </p>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Member since
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
              S
            </span>
            {formatDate(member.joined)}
          </p>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Connections
          </p>
          {connections.length ? (
            <div className="mt-2 overflow-hidden rounded-xl bg-background">
              {connections.map((c, i) => (
                <a
                  key={c.id || `${c.platform}-${i}`}
                  href={c.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/40 ${
                    i ? "border-t border-border" : ""
                  }`}
                >
                  <BrandIcon platform={c.platform} size={28} />
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {c.label || c.platform}
                    </span>
                    {c.verified && <VerifiedCheck />}
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No channels linked yet.</p>
          )}

          <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Note (only visible to you)
          </p>
          <textarea
            rows={2}
            placeholder="Tap to add a note"
            className="mt-2 w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />

          {isAdmin && (
            <div className="mt-5 space-y-1 rounded-xl border border-primary/40 bg-primary/10 p-3 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                Owner view
              </p>
              <p className="text-muted-foreground">
                Account type: {member.real ? "Authenticated account" : "Community-listed profile"}
              </p>
              <p className="text-muted-foreground">Role: {member.role ?? "streamer"}</p>
              <p className="text-muted-foreground">Primary platform: {member.platform}</p>
              <p className="text-muted-foreground">Channel: {channelName(member)}</p>
              <p className="break-all text-muted-foreground">ID: {member.id}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
