import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Member, Status } from "@/lib/community";

export const ROLES = [
  "member",
  "streamer",
  "verified",
  "affiliate",
  "partner",
  "moderator",
  "admin",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_META: Record<Role, { label: string; icon: string }> = {
  member: { label: "Member", icon: "👤" },
  streamer: { label: "Streamer", icon: "🎥" },
  verified: { label: "Verified Streamer", icon: "⭐" },
  affiliate: { label: "Affiliate", icon: "👑" },
  partner: { label: "Partner", icon: "💎" },
  moderator: { label: "Moderator", icon: "🛡️" },
  admin: { label: "Owner / Admin", icon: "👑" },
};

export type ProfileRow = {
  id: string;
  display_name: string;
  handle: string | null;
  bio: string;
  avatar_url: string;
  banner_url: string;
  platform: string;
  channel_url: string;
  status: string;
  is_banned: boolean;
  restricted_until: string | null;
  created_at: string;
};

export type Account = ProfileRow & { roles: Role[] };

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser = new Map<string, Role[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role as Role);
      byUser.set(r.user_id, list);
    }
    setAccounts(
      ((profiles ?? []) as ProfileRow[]).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { accounts, loading, refresh };
}

export function topRole(roles: Role[]): Role {
  for (const r of [...ROLES].reverse()) if (roles.includes(r)) return r;
  return "member";
}

export function accountToMember(a: Account): Member & { real: true; role: Role } {
  return {
    id: a.id,
    name: a.display_name,
    handle: a.handle ?? "@member",
    platform: a.platform,
    status: (["online", "live", "offline"].includes(a.status) ? a.status : "online") as Status,
    link: a.channel_url,
    bio: a.bio,
    avatar: a.avatar_url,
    banner: a.banner_url,
    joined: new Date(a.created_at).getTime(),
    real: true,
    role: topRole(a.roles),
  };
}

export function useMyAccount(userId: string | undefined, accounts: Account[]) {
  return useMemo(
    () => (userId ? (accounts.find((a) => a.id === userId) ?? null) : null),
    [userId, accounts],
  );
}

export async function setUserRole(userId: string, role: Role) {
  await supabase.from("user_roles").delete().eq("user_id", userId);
  return supabase.from("user_roles").insert({ user_id: userId, role });
}

export async function setRestriction(userId: string, days: number | null) {
  const until = days === null ? null : new Date(Date.now() + days * 86400000).toISOString();
  return supabase.from("profiles").update({ restricted_until: until }).eq("id", userId);
}

export async function setBanned(userId: string, banned: boolean) {
  return supabase.from("profiles").update({ is_banned: banned }).eq("id", userId);
}

export function isRestricted(a: Account) {
  return !!a.restricted_until && new Date(a.restricted_until).getTime() > Date.now();
}
