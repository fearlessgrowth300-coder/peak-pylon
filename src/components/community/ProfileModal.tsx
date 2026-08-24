import type { Member } from "@/lib/community";
import { Avatar } from "./Bits";

export function ProfileModal({
  member,
  onClose,
}: {
  member: Member | null;
  onClose: () => void;
}) {
  if (!member) return null;
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

        <div className="-mt-10 px-4 pb-6">
          <div className="w-fit rounded-full border-[6px] border-popover">
            <Avatar member={member} size={72} />
          </div>

          <div className="mt-3 rounded-xl bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold">{member.name}</h2>
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

            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                About me
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                {member.bio || "Community creator profile."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Platform
                </p>
                <p className="font-semibold">{member.platform}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Profile type
                </p>
                <p className="font-semibold">Community-listed</p>
              </div>
            </div>

            {member.link && (
              <a
                href={member.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
              >
                Open creator channel ↗
              </a>
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              This profile is displayed by the community. A linked external channel does not
              mean the creator endorses this community.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
