export type Observation = { stream_id: string | null; observed_at: string; viewer_count: number; is_live: boolean };

// These are sampled concurrent viewers, not Twitch's official full-session averages.
export function summarizeStreams(rows: Observation[]) {
  const groups = new Map<string, { id: string; firstSeen: string; lastSeen: string; samples: number; total: number; peak: number }>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.is_live || !row.stream_id || !Number.isFinite(Number(row.viewer_count)) || Number(row.viewer_count) < 0) continue;
    const key = `${row.stream_id}:${row.observed_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = groups.get(row.stream_id) ?? { id: row.stream_id, firstSeen: row.observed_at, lastSeen: row.observed_at, samples: 0, total: 0, peak: 0 };
    group.firstSeen = group.firstSeen < row.observed_at ? group.firstSeen : row.observed_at;
    group.lastSeen = group.lastSeen > row.observed_at ? group.lastSeen : row.observed_at;
    group.samples++;
    group.total += Number(row.viewer_count);
    group.peak = Math.max(group.peak, Number(row.viewer_count));
    groups.set(row.stream_id, group);
  }
  return [...groups.values()].map(({ total, ...group }) => ({ ...group, average: Math.round(total / group.samples) })).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
