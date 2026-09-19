import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaExtension} from './media.mjs';
test('executable and HTML payloads cannot masquerade as images',()=>{
  assert.equal(mediaExtension(Buffer.from('<html>not a photo</html>'),'image/png'),null);
  assert.equal(mediaExtension(Buffer.alloc(20),'application/javascript'),null);
});
test('image signatures and declared types must agree',()=>{
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(10)]);
  assert.equal(mediaExtension(png,'image/png'),'png');
  assert.equal(mediaExtension(png,'image/jpeg'),null);
  assert.equal(mediaExtension(Buffer.alloc(2),'image/png'),null);
});
