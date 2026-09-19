export function canParticipate(profile, roles) {
  if (!profile || profile.is_banned || (profile.restricted_until && Date.parse(profile.restricted_until) > Date.now())) return false;
  if (roles.includes('admin')) return true;
  return profile.rules_acknowledged === true && profile.channel_authorized === true && profile.approval_status === 'approved';
}
export function canPost(profile, roles, channel) {
  return canParticipate(profile,roles) && (roles.includes('admin') || ['general','clips'].includes(channel));
}
export function canDelete(userId, roles, authorId) {
  return Boolean(userId) && (roles.includes('admin') || userId === authorId);
}
