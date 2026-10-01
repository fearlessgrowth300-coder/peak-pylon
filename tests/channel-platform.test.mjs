import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveChannelPlatform,parseKickSlug} from '../src/lib/channel-platform.ts';
test('pasted provider URL overrides the selected platform',()=>{
  assert.equal(resolveChannelPlatform('https://kick.com/xqc','Twitch'),'Kick');
  assert.equal(resolveChannelPlatform('kick.com/xqc','Twitch'),'Kick');
  assert.equal(resolveChannelPlatform('https://www.kick.com/xqc','Twitch'),'Kick');
  assert.equal(resolveChannelPlatform('https://twitch.tv/example','Kick'),'Twitch');
});
test('bare usernames use the selected platform and unrelated domains do not impersonate Kick',()=>{
  assert.equal(resolveChannelPlatform('@example','Kick'),'Kick');
  assert.equal(resolveChannelPlatform('example','Twitch'),'Twitch');
  assert.equal(resolveChannelPlatform('https://kick.com.example.org/xqc','Twitch'),'Other');
});
test('Kick accepts shared URLs and usernames but rejects other providers',()=>{
  for(const value of ['https://kick.com/XQC?ref=share','kick.com/xqc','www.kick.com/xqc','@xqc','xqc'])assert.equal(parseKickSlug(value),'xqc');
  for(const value of ['https://twitch.tv/xqc','https://kick.com.fake.org/xqc','https://kick.com/','hello world'])assert.throws(()=>parseKickSlug(value));
});
