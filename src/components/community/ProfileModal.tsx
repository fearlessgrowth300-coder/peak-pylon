import { ExternalLink, MessageSquare, PhoneCall, UserPlus } from "lucide-react";
import { useState } from "react";
import { formatDate, type Connection, type Member } from "@/lib/community";
import { Avatar } from "./Bits";
import { BrandIcon, VerifiedCheck } from "./BrandIcon";

function memberConnections(member: Member): Connection[] {
  if (member.connections?.length) return member.connections;
  if (member.link)
    return [
      {
        id: "primary",
        platform: member.platform,
        label: member.handle.replace(/^@/, ""),
        url: member.link,
        verified: true,
      },
    ];
  return [];
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
}: {
  member: Member | null;
  onClose: () => void;
  isAdmin?: boolean;
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
          className="relative h-32 bg-primary/60 bg-cover bg-center"
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

        <div className="-mt-12 px-4 pb-8">
          <div className="w-fit rounded-full border-[6px] border-popover">
            <Avatar member={member} size={84} />
          </div>

          <div className="mt-3">
            <h2 className="truncate text-2xl font-extrabold">{member.name}</h2>
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

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
            <button onClick={() => setNotice("Friends are available only to verified Twitch or Kick Partners.")} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85"><UserPlus className="h-4 w-4" /> Add Friend</button>
            <button onClick={() => setNotice("Private messages are available only to verified Twitch or Kick Partners.")} aria-label="Message" className="grid h-10 w-10 place-items-center rounded-lg bg-accent hover:bg-accent/70"><MessageSquare className="h-4 w-4" /></button>
            <button onClick={() => setNotice("Private calls are available only to verified Twitch or Kick Partners.")} aria-label="Call" className="grid h-10 w-10 place-items-center rounded-lg bg-accent hover:bg-accent/70"><PhoneCall className="h-4 w-4" /></button>
          </div>
          {notice && <p className="mt-2 rounded-lg bg-accent/60 px-3 py-2 text-xs text-muted-foreground">{notice}</p>}

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
