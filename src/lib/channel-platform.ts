/** An explicit URL takes precedence over the form's default platform. */
export function resolveChannelPlatform(value: string, selected: string): string {
  const input = value.trim();
  const looksLikeUrl = /^https?:\/\//i.test(input) || /^(?:www\.)?[^/]+\.[^/]+(?:\/|$)/.test(input);
  if (!looksLikeUrl) return selected;
  const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  const host = url.hostname.toLowerCase();
  if (host === 'kick.com' || host === 'www.kick.com') return 'Kick';
  if (host === 'twitch.tv' || host === 'www.twitch.tv' || host === 'm.twitch.tv') return 'Twitch';
  return 'Other';
}

export function parseKickSlug(value: string): string {
  const input=value.trim();
  let slug=input.replace(/^@/,'');
  if (/^https?:\/\//i.test(input) || input.includes('/') || input.includes('.')) {
    let url:URL;
    try { url=new URL(/^https?:\/\//i.test(input)?input:`https://${input}`); }
    catch { throw new Error('Enter a valid Kick channel URL or username'); }
    if(!['kick.com','www.kick.com'].includes(url.hostname.toLowerCase()))throw new Error('Use a kick.com channel URL');
    slug=url.pathname.split('/').filter(Boolean)[0]?.replace(/^@/,'') || '';
  }
  if(!/^[a-zA-Z0-9_-]{1,25}$/.test(slug))throw new Error('Enter a valid Kick channel username');
  return slug.toLowerCase();
}
