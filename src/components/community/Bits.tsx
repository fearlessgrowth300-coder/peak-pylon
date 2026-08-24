import type { ReactNode } from "react";
import { initials, type Member, type Status } from "@/lib/community";

export function statusColor(status: Status) {
  return status === "live"
    ? "bg-live"
    : status === "online"
      ? "bg-online"
      : "bg-offline";
}

export function Avatar({
  member,
  size = 40,
  showStatus = true,
}: {
  member: Pick<Member, "name" | "avatar" | "status">;
  size?: number;
  showStatus?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-accent bg-cover bg-center text-xs font-bold text-foreground"
        style={member.avatar ? { backgroundImage: `url(${member.avatar})` } : undefined}
      >
        {member.avatar ? "" : initials(member.name)}
      </div>
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-[3px] border-background ${statusColor(member.status)}`}
          style={{ width: Math.max(12, size * 0.3), height: Math.max(12, size * 0.3) }}
        />
      )}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-transparent bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50";

export const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/70";
