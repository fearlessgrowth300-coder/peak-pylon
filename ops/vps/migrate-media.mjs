import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = '/opt/streamcore/media';
const rows = (await fs.readFile('/opt/streamcore/private/source-media.jsonl', 'utf8')).trim().split('\n').filter(Boolean).map(x => JSON.parse(x));
let total = 0;
const verified = [];
for (const row of rows) {
  if (row.public !== true) throw new Error('Private media requires authenticated migration; stopping');
  const relative = `${row.bucket_id}/${row.name}`;
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}/`) || relative.split('/').some(x => ['.', '..'].includes(x))) throw new Error('Invalid media path');
  const response = await fetch(`https://remlkdcficnmsosulotw.supabase.co/storage/v1/object/public/${relative.split('/').map(encodeURIComponent).join('/')}`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Media source returned ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  total += data.length;
  if (total > 1024 * 1024 * 1024) throw new Error('Migration safety limit exceeded');
  if (row.size != null && Number(row.size) !== data.length) throw new Error('Media source size does not match manifest');
  const hash = createHash('sha256').update(data).digest('hex');
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  await fs.writeFile(target, data, { mode: 0o640 });
  const stored = await fs.readFile(target);
  if (createHash('sha256').update(stored).digest('hex') !== hash) throw new Error('Stored media hash mismatch');
  verified.push({ ...row, relative, size: data.length, sha256: hash });
}
await fs.writeFile('/opt/streamcore/private/migrated-media.json', JSON.stringify(verified), { mode: 0o600 });
console.log(`Media migration verified: ${verified.length} objects, ${total} bytes. Production URLs unchanged.`);
