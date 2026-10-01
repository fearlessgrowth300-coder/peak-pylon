// Only server-verified connection records or the authenticated provider identity
// can identify a private analytics channel. Never infer ownership from a URL.
export function analyticsTwitchId(profile: any, identities: any[] = []): string | null {
  const valid = (value: unknown) => typeof value === "string" && /^\d+$/.test(value) ? value : null;
  if (profile?.twitch_verified && valid(profile.twitch_user_id)) return profile.twitch_user_id;
  for (const identity of identities) {
    if (identity.provider === "twitch") {
      const id = valid(identity.identity_data?.provider_id) ?? valid(identity.identity_data?.sub);
      if (id) return id;
    }
  }
  // Legacy verified links must also carry the profile-level verification flag.
  if (profile?.twitch_verified && Array.isArray(profile.social_links)) {
    for (const link of profile.social_links) {
      if (link.provider === "twitch" && link.verified === true && valid(link.providerIdentityId)) return link.providerIdentityId;
    }
  }
  return null;
}
