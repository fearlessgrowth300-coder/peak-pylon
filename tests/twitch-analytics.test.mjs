import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeStreams } from '../src/lib/twitch-analytics.ts';

test('aggregates actual samples, preserves zero viewers, and excludes offline observations', () => {
  const row = { stream_id: 'one', observed_at: '2026-10-01T10:00:00Z', viewer_count: 0, is_live: true };
  const result = summarizeStreams([row, row, { ...row, observed_at: '2026-10-01T10:30:00Z', viewer_count: 20 }, { ...row, is_live: false, viewer_count: 500 }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].samples, 2);
  assert.equal(result[0].average, 10);
  assert.equal(result[0].peak, 20);
});
test('missing history remains empty rather than generating statistics', () => {
  assert.deepEqual(summarizeStreams([]), []);
  assert.deepEqual(summarizeStreams([{ stream_id: null, observed_at: '2026-10-01', viewer_count: 50, is_live: true }]), []);
});
test('keeps broadcasts separate and sorts latest first', () => {
  const result = summarizeStreams([
    { stream_id: 'older', observed_at: '2026-09-01', viewer_count: 10, is_live: true },
    { stream_id: 'newer', observed_at: '2026-10-01', viewer_count: 40, is_live: true },
  ]);
  assert.deepEqual(result.map(row => row.id), ['newer', 'older']);
});
