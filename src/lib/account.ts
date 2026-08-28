import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Member, Status } from "@/lib/community";

export type SocialLink = { platform: string; url: string; label: string };

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
  last_active_at: string;
  twitch_verified: boolean;
  social_links: SocialLink[];
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
    const [{ data: profiles }, { data: roles }, { data: listedRows }] = await Promise.all([
      (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("user_roles").select("user_id, role"),
      (supabase as any).from("community_listed_members").select("id, data"),
    ]);
    const byUser = new Map<string, Role[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role as Role);
      byUser.set(r.user_id, list);
    }
    const existingIds = new Set<string>();
    const existingHandles = new Set<string>();
    const existingLinks = new Set<string>();
    const existingNames = new Set<string>();

    const profileAccounts: Account[] = [];
    for (const p of ((profiles ?? []) as unknown as ProfileRow[])) {
      const idKey = p.id?.toLowerCase() || "";
      const handleKey = p.handle ? p.handle.replace(/^@/, "").trim().toLowerCase() : "";
      const nameKey = p.display_name ? p.display_name.trim().toLowerCase() : "";
      const linkKey = p.channel_url ? p.channel_url.trim().toLowerCase() : "";

      if (existingIds.has(idKey) || (handleKey && existingHandles.has(handleKey)) || (linkKey && existingLinks.has(linkKey))) {
        continue;
      }
      if (idKey) existingIds.add(idKey);
      if (handleKey) existingHandles.add(handleKey);
      if (nameKey) existingNames.add(nameKey);
      if (linkKey) existingLinks.add(linkKey);

      profileAccounts.push({
        ...p,
        roles: byUser.get(p.id) ?? (p.id === "00000000-0000-0000-0000-000000000001" ? ["admin"] : ["streamer"]),
      });
    }

    // Convert listed members who aren't yet in profiles
    const convertedFromListed: Account[] = [];
    for (const row of (listedRows ?? [])) {
      if (!row.data) continue;
      const m = row.data as Member;
      const idKey = row.id?.toLowerCase() || "";
      const handleKey = m.handle ? m.handle.replace(/^@/, "").trim().toLowerCase() : "";
      const nameKey = m.name ? m.name.trim().toLowerCase() : "";
      const linkKey = m.link ? m.link.trim().toLowerCase() : "";

      if (
        (idKey && existingIds.has(idKey)) ||
        (handleKey && existingHandles.has(handleKey)) ||
        (nameKey && existingNames.has(nameKey)) ||
        (linkKey && existingLinks.has(linkKey))
      ) {
        continue;
      }
      if (idKey) existingIds.add(idKey);
      if (handleKey) existingHandles.add(handleKey);
      if (nameKey) existingNames.add(nameKey);
      if (linkKey) existingLinks.add(linkKey);

      convertedFromListed.push({
        id: row.id,
        display_name: m.name || "Streamer",
        handle: m.handle ? m.handle.replace(/^@/, "") : m.name.toLowerCase().replace(/\s+/g, ""),
        bio: m.bio || "",
        avatar_url: m.avatar || "",
        banner_url: m.banner || "",
        platform: m.platform || "Twitch",
        channel_url: m.link || "",
        status: m.status || "online",
        is_banned: false,
        restricted_until: null,
        created_at: new Date(m.joined || Date.now()).toISOString(),
        last_active_at: new Date().toISOString(),
        twitch_verified: false,
        social_links: (m.connections || []) as SocialLink[],
        roles: byUser.get(row.id) ?? (m.role ? [m.role as Role] : ["streamer"]),
      });
    }

    setAccounts([...profileAccounts, ...convertedFromListed]);
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
  const isRecentlyActive = new Date(a.last_active_at).getTime() > Date.now() - 6 * 60 * 1000;
  return {
    id: a.id,
    name: a.display_name,
    handle: a.handle ?? "@member",
    platform: a.platform,
    status: a.status === "live" ? "live" : a.status === "online" ? "online" : isRecentlyActive ? "online" : "offline",
    link: a.channel_url,
    bio: a.bio,
    avatar: a.avatar_url,
    banner: a.banner_url,
    joined: new Date(a.created_at).getTime(),
    real: true,
    role: topRole(a.roles),
    connections: [
      ...(a.channel_url ? [{ id: "primary", platform: a.platform, label: a.handle?.replace(/^@/, "") || a.display_name, url: a.channel_url, verified: a.platform === "Twitch" ? a.twitch_verified : true }] : []),
      ...(a.social_links ?? []).map((link, index) => ({ id: `social-${index}`, platform: link.platform, label: link.label || link.platform, url: link.url, verified: false })),
    ],
  };
}

export function useMyAccount(userId: string | undefined, accounts: Account[]) {
  return useMemo(
    () => (userId ? (accounts.find((a) => a.id === userId) ?? null) : null),
    [userId, accounts],
  );
}

export async function setUserRole(userId: string, role: Role) {
  try {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role });
  } catch {
    // ignore
  }

  try {
    const db = supabase as any;
    const { data: existing } = await db.from("community_listed_members").select("data").eq("id", userId).maybeSingle();
    if (existing?.data) {
      await db.from("community_listed_members").update({
        data: { ...existing.data, role }
      }).eq("id", userId);
    }
  } catch {
    // ignore
  }
}

export async function setRestriction(userId: string, days: number | null) {
  const until = days === null ? null : new Date(Date.now() + days * 86400000).toISOString();
  return supabase.from("profiles").update({ restricted_until: until }).eq("id", userId);
}

export async function setBanned(userId: string, banned: boolean) {
  return supabase.from("profiles").update({ is_banned: banned }).eq("id", userId);
}

// This removes a person from the community directory, their role, and their
// community content. Their Supabase Auth identity is intentionally retained so
// the owner never deletes somebody's external login by mistake.
export async function removeFromCommunity(userId: string) {
  const [roles, profile, listed, posts] = await Promise.all([
    supabase.from("user_roles").delete().eq("user_id", userId),
    supabase.from("profiles").delete().eq("id", userId),
    (supabase as any).from("community_listed_members").delete().eq("id", userId),
    (supabase as any).from("community_posts").delete().eq("data->>authorId", userId),
  ]);
  const failure = [roles.error, profile.error, listed.error, posts.error].find(Boolean);
  if (failure) throw failure;
}

export function isRestricted(a: Account) {
  return !!a.restricted_until && new Date(a.restricted_until).getTime() > Date.now();
}
