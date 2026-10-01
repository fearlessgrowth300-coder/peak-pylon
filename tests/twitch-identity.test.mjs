import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsTwitchId } from '../src/lib/twitch-identity.ts';
test('supports current and legacy verified identities', () => {
  assert.equal(analyticsTwitchId({twitch_verified:true,twitch_user_id:'123'}),'123');
  assert.equal(analyticsTwitchId({},[{provider:'twitch',identity_data:{sub:'234'}}]),'234');
  assert.equal(analyticsTwitchId({twitch_verified:true,social_links:[{provider:'twitch',verified:true,providerIdentityId:'345'}]}),'345');
});
test('does not turn a pasted URL or unverified link into ownership', () => {
  assert.equal(analyticsTwitchId({channel_url:'https://twitch.tv/example',channel_authorized:true}),null);
  assert.equal(analyticsTwitchId({social_links:[{provider:'twitch',verified:true,providerIdentityId:'345'}]}),null);
  assert.equal(analyticsTwitchId({twitch_verified:true,twitch_user_id:'not-an-id'}),null);
});
