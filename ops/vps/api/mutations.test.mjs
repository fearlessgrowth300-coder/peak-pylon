import test from 'node:test';
import assert from 'node:assert/strict';
import { mutatePost } from './mutations.mjs';
const user = { id:'u1',roles:[],profile:{rules_acknowledged:true,channel_authorized:true,approval_status:'approved'} };
const post = { authorId:'u2',channel:'general',text:'original',reactions:{'x':5} };
test('reaction toggles once per user without deleting historical totals', () => {
  const added = mutatePost(post,user,{action:'reaction',emoji:'x'});
  assert.equal(added.reactions.x,6);
  assert.equal(mutatePost(added,user,{action:'reaction',emoji:'x'}).reactions.x,5);
  assert.equal(post.reactions.x,5);
});
test('comments cannot impersonate another user', () => {
  const result = mutatePost(post,user,{action:'comment',text:'hello',authorId:'u2',time:1});
  assert.equal(result.comments[0].authorId,'u1');
  assert.notEqual(result.comments[0].time,1);
});
test('shares are idempotent per member', () => {
  const result = mutatePost(post,user,{action:'share'});
  assert.equal(mutatePost(result,user,{action:'share'}).shares,1);
});
test('other members cannot edit posts or set counters directly', () => {
  assert.throws(() => mutatePost(post,user,{action:'edit',text:'spoof'}),{status:403});
  assert.throws(() => mutatePost(post,user,{action:'set',shares:999}),{status:400});
});
test('unapproved members cannot react or comment', () => {
  assert.throws(() => mutatePost(post,{...user,profile:{...user.profile,approval_status:'pending'}},{action:'comment',text:'hi'}),{status:403});
});
test('approved members may react to admin announcements without publishing one',()=>{
  assert.equal(mutatePost({...post,channel:'announcements'},user,{action:'reaction',emoji:'x'}).reactions.x,6);
});
