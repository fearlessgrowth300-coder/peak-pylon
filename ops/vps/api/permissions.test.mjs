import test from 'node:test';
import assert from 'node:assert/strict';
import { canPost, canDelete } from './permissions.mjs';
const approved = { rules_acknowledged: true, channel_authorized: true, approval_status: 'approved' };
test('pending and anonymous profiles cannot publish', () => {
  assert.equal(canPost(null, [], 'general'), false);
  assert.equal(canPost({ ...approved, approval_status: 'pending' }, [], 'general'), false);
});
test('approved members can publish chat and clips but not announcements', () => {
  assert.equal(canPost(approved, [], 'general'), true);
  assert.equal(canPost(approved, [], 'clips'), true);
  assert.equal(canPost(approved, [], 'announcements'), false);
});
test('bans and active restrictions block posting', () => {
  assert.equal(canPost({ ...approved, is_banned: true }, ['admin'], 'general'), false);
  assert.equal(canPost({ ...approved, restricted_until: new Date(Date.now() + 60000).toISOString() }, [], 'general'), false);
});
test('only owners and admins may delete', () => {
  assert.equal(canDelete('a', [], 'a'), true);
  assert.equal(canDelete('a', [], 'b'), false);
  assert.equal(canDelete('', [], ''), false);
  assert.equal(canDelete('a', ['admin'], 'b'), true);
});
