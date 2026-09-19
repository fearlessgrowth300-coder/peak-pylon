import { randomUUID } from 'node:crypto';
import { canDelete, canParticipate } from './permissions.mjs';
const fail = (status, message) => Object.assign(new Error(message), { status });
export function mutatePost(post, user, input) {
  if (!canParticipate(user.profile,user.roles)) throw fail(403,'Community approval required');
  const next = structuredClone(post);
  if (input.action === 'reaction') {
    if (typeof input.emoji !== 'string' || !input.emoji.trim() || input.emoji.length > 32) throw fail(400,'Invalid reaction');
    const users = next.reactionUsers || {};
    const current = Array.isArray(users[input.emoji]) ? users[input.emoji] : [];
    const removing = current.includes(user.id);
    users[input.emoji] = removing ? current.filter(id => id !== user.id) : [...current,user.id];
    next.reactionUsers = users;
    next.reactions = { ...next.reactions, [input.emoji]: Math.max(0,Number(next.reactions?.[input.emoji] || 0) + (removing ? -1 : 1)) };
    if (['❤️','💖'].includes(input.emoji)) next.likes = removing ? (next.likes || []).filter(id => id !== user.id) : [...new Set([...(next.likes || []),user.id])];
  } else if (input.action === 'comment') {
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 10000) throw fail(400,'Invalid comment');
    if ((next.comments || []).length >= 500) throw fail(409,'Comment capacity reached');
    next.comments = [...(next.comments || []),{ id: randomUUID(),authorId:user.id,text:input.text.trim(),time:Date.now() }];
  } else if (input.action === 'share') {
    const users = next.sharedBy || [];
    if (!users.includes(user.id)) { next.sharedBy = [...users,user.id]; next.shares = Number(next.shares || 0) + 1; }
  } else if (input.action === 'edit') {
    if (!canDelete(user.id,user.roles,next.authorId)) throw fail(403,'Only the author or admin may edit');
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 10000) throw fail(400,'Invalid text');
    next.text = input.text.trim();
    for(const field of ['image','video']) {
      if(input[field]===undefined) continue;
      if(input[field]==='') { next[field]=''; continue; }
      let url;try {url=new URL(input[field]);} catch {throw fail(400,'Invalid media URL');}
      if(url.protocol!=='https:' || input[field].length>2048) throw fail(400,'Invalid media URL');
      next[field]=input[field];
    }
  } else throw fail(400,'Unsupported post action');
  return next;
}
