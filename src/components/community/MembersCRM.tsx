import { useState } from "react";
import {
  ROLES,
  ROLE_META,
  accountToMember,
  isRestricted,
  setBanned,
  setRestriction,
  setUserRole,
  topRole,
  type Account,
  type Role,
} from "@/lib/account";
import { formatDate } from "@/lib/community";
import { Avatar, inputClass } from "./Bits";

export function MembersCRM({
  accounts,
  isAdmin,
  refresh,
  notify,
}: {
  accounts: Account[];
  isAdmin: boolean;
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const list = accounts.filter((a) =>
    `${a.display_name} ${a.handle ?? ""} ${a.platform} ${a.channel_url}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  const counts = {
    total: accounts.length,
    streamers: accounts.filter((a) => a.roles.length > 0).length,
    partners: accounts.filter((a) => a.roles.includes("partner")).length,
    restricted: accounts.filter((a) => isRestricted(a) || a.is_banned).length,
  };

  async function run(id: string, fn: () => Promise<unknown>, message: string) {
    if (!isAdmin) return notify("Only the owner can do that");
    setBusy(id);
    await fn();
    await refresh();
    setBusy(null);
    notify(message);
  }

  return (
    <div className="space-y-3 rounded-xl bg-popover p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">05 · Streamer CRM (real accounts)</h2>
        {!isAdmin && (
          <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-bold text-destructive">
            READ ONLY
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Accounts" value={counts.total} />
        <Metric label="Streamers" value={counts.streamers} />
        <Metric label="Partners" value={counts.partners} />
        <Metric label="Restricted" value={counts.restricted} />
      </div>

      <input
        className={inputClass}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search @handle, name, platform or channel URL"
      />

      {list.length === 0 && (
        <p className="rounded-md bg-background p-3 text-xs text-muted-foreground">
          No real accounts yet. Share the join link — new signups appear here automatically as
          streamers, on top of the showcase profiles.
        </p>
      )}

      <div className="space-y-2">
        {list.map((a) => {
          const role = topRole(a.roles);
          return (
            <div key={a.id} className="space-y-3 rounded-md bg-background p-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <Avatar member={accountToMember(a)} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.handle} · {a.platform} · joined{" "}
                    {formatDate(new Date(a.created_at).getTime())}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold">
                  {ROLE_META[role].icon} {ROLE_META[role].label}
                </span>
              </div>

              {(a.is_banned || isRestricted(a)) && (
                <p className="text-xs font-semibold text-destructive">
                  {a.is_banned ? "Banned" : `Restricted until ${formatDate(new Date(a.restricted_until!).getTime())}`}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  disabled={!isAdmin || busy === a.id}
                  className={`${inputClass} w-auto`}
                  value={role}
                  onChange={(e) =>
                    void run(
                      a.id,
                      () => setUserRole(a.id, e.target.value as Role),
                      "Role updated",
                    )
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!isAdmin || busy === a.id}
                  onClick={() =>
                    void run(
                      a.id,
                      () => setRestriction(a.id, isRestricted(a) ? null : 7),
                      isRestricted(a) ? "Restriction lifted" : "Posting restricted for 7 days",
                    )
                  }
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                >
                  {isRestricted(a) ? "Lift restriction" : "Restrict 7 days"}
                </button>
                <button
                  disabled={!isAdmin || busy === a.id}
                  onClick={() =>
                    void run(
                      a.id,
                      () => setBanned(a.id, !a.is_banned),
                      a.is_banned ? "Account restored" : "Account banned",
                    )
                  }
                  className="rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-50"
                >
                  {a.is_banned ? "Unban" : "Ban"}
                </button>
                {a.channel_url && (
                  <a
                    href={a.channel_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open channel ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background p-3 text-center">
      <p className="text-lg font-extrabold">{value.toLocaleString()}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
