import type { ComponentType } from "react";
import {
  BadgeCheck,
  ExternalLink,
  Link2,
  MessageSquare,
  Music2,
  PhoneCall,
  Twitch,
  UserPlus,
  Video,
  Youtube,
} from "lucide-react";
import { formatDate, type Member } from "@/lib/community";
import { Avatar } from "./Bits";

const PLATFORM_ICON: Record<string, ComponentType<{ className?: string }>> = {
  Twitch,
  YouTube: Youtube,
  TikTok: Music2,
  Kick: Link2,
  Other: Link2,
};

function Action({
  icon: Icon,
  label,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-3">
      <Icon className={`h-5 w-5 ${accent ? "text-online" : "text-foreground"}`} />
      <span
        className={`text-[11px] font-semibold ${accent ? "text-online" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

export function ProfileModal({
  member,
  onClose,
}: {
  member: Member | null;
  onClose: () => void;
}) {
  if (!member) return null;
  const PlatformIcon = PLATFORM_ICON[member.platform] ?? Link2;
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
          className="relative h-36 bg-primary/60 bg-cover bg-center"
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

        <div className="-mt-12 px-4 pb-6">
          <div className="w-fit rounded-full border-[6px] border-popover">
            <Avatar member={member} size={84} />
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background">
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-extrabold">{member.name}</h2>
                <p className="truncate text-sm text-muted-foreground">{member.handle}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                  member.status === "live"
                    ? "bg-live/20 text-live"
                    : member.status === "online"
                      ? "bg-online/20 text-online"
                      : "bg-accent text-muted-foreground"
                }`}
              >
                {statusLabel}
              </span>
            </div>

            <div className="grid grid-cols-4 border-t border-border">
              <Action icon={MessageSquare} label="Message" />
              <Action icon={PhoneCall} label="Voice Call" />
              <Action icon={Video} label="Video Call" />
              <Action icon={UserPlus} label="Add Friend" accent />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
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
            {member.link ? (
              <a
                href={member.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-3 transition-colors hover:bg-accent/40"
              >
                <PlatformIcon className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {member.handle.replace(/^@/, "")}
                  <BadgeCheck className="ml-1.5 inline h-4 w-4 align-text-bottom text-primary" />
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No channel linked yet.</p>
            )}

            <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Note
            </p>
            <textarea
              rows={2}
              placeholder="Tap to add a note"
              className="mt-2 w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              This profile is displayed by the community. A linked external channel does not
              mean the creator endorses this community.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
