import http from 'node:http';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { canPost, canDelete } from './permissions.mjs';
import { mutatePost } from './mutations.mjs';
import { mediaExtension } from './media.mjs';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import {runActivityWorker} from './worker.mjs';
import {syncLive} from './live-worker.mjs';
import {syncRankings,latestRankings} from './ranking-worker.mjs';
const { DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error('Required server configuration missing');
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5, statement_timeout: 5000 });
const writesEnabled = process.env.ENABLE_WRITES === 'true';
const workerEnabled = writesEnabled && process.env.WORKER_ENABLED !== 'false';
const sourceCa=process.env.SOURCE_CA_FILE ? await readFile(process.env.SOURCE_CA_FILE,'utf8') : undefined;
const source = process.env.SOURCE_DATABASE_URL ? new pg.Pool({connectionString:process.env.SOURCE_DATABASE_URL,max:2,statement_timeout:5000,ssl:{rejectUnauthorized:true,...(sourceCa?{ca:sourceCa}:{})}}) : pool;
const activityTimer = setInterval(()=>{ void runActivityWorker(source,pool,workerEnabled).catch(()=>console.error('Activity worker failed; check provider configuration')); },60000);
const dataTimer=setInterval(()=>{if(workerEnabled)void syncLive(source,pool,true).then(()=>syncRankings(source,pool,true)).catch(()=>console.error('Live/ranking worker failed; last successful snapshot retained'));},60000);
const origin = 'https://peak-pylon.vercel.app';
const subscribers = new Set();
const listener = await pool.connect();
await listener.query('LISTEN streamcore_post_events');
listener.on('notification', () => { for (const wake of subscribers) wake(); });
listener.on('error', () => { for (const wake of subscribers) wake(true); });
const reply = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
const fail = (status, message) => Object.assign(new Error(message), { status });
async function identity(req) {
  const auth = req.headers.authorization;
  if (!auth || !/^Bearer \S+$/.test(auth)) throw fail(401, 'Sign in required');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: auth }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw fail(401, 'Session invalid');
  const user = await response.json();
  if (!user.id) throw fail(401, 'Session invalid');
  const [profiles, roles] = await Promise.all([
    source.query('SELECT * FROM profiles WHERE id = $1', [user.id]),
    source.query('SELECT role FROM user_roles WHERE user_id = $1', [user.id]),
  ]);
  return { id: user.id, profile: profiles.rows[0], roles: roles.rows.map(r => r.role) };
}
async function body(req) {
  let raw = ''; let bytes = 0;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 65536) throw fail(413, 'Request too large'); raw += chunk.toString(); }
  try { return JSON.parse(raw); } catch { throw fail(400, 'Invalid JSON'); }
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.origin && req.headers.origin !== origin) throw fail(403, 'Origin not allowed');
    if (req.headers.origin === origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE'); res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type'); return reply(res, 204, null); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health' && req.method === 'GET') { await pool.query('SELECT 1'); return reply(res, 200, { database: 'connected', writesEnabled }); }
    if(url.pathname==='/v1/session' && req.method==='GET') {
      const user=await identity(req);
      return reply(res,200,{authenticated:true,admin:user.roles.includes('admin'),approved:canPost(user.profile,user.roles,'general')});
    }
    if(url.pathname==='/v1/live' && req.method==='GET') {
      const cached=(await pool.query("SELECT data FROM streamcore_job_state WHERE name='live_status'")).rows[0]?.data;
      return reply(res,200,cached || {snapshots:[],refreshedAt:null});
    }
    if(url.pathname==='/v1/live/sync' && req.method==='POST') {
      const user=await identity(req);if(!user.roles.includes('admin'))throw fail(403,'Admin access required');
      return reply(res,200,await syncLive(source,pool,writesEnabled,true));
    }
    if(url.pathname==='/v1/rankings' && req.method==='GET')return reply(res,200,await latestRankings(pool));
    if(url.pathname==='/v1/rankings' && req.method==='POST') {
      const user=await identity(req);if(!user.roles.includes('admin'))throw fail(403,'Admin access required');
      return reply(res,200,await syncRankings(source,pool,writesEnabled,true));
    }
    if(url.pathname==='/v1/ranking-insight' && req.method==='PATCH') {
      if(!writesEnabled)throw fail(503,'Migration in progress; writes disabled');
      const user=await identity(req);if(!user.roles.includes('admin'))throw fail(403,'Admin access required');
      const input=await body(req),patch=input.patch;
      if(typeof input.id!=='string' || !/^[0-9a-f-]{36}$/i.test(input.id) || !patch || ['ai_headline','ai_summary','ai_strongest_category','ai_model'].some(k=>typeof patch[k]!=='string' || patch[k].length>1000))throw fail(400,'Invalid insight');
      const result=await pool.query('UPDATE creator_metric_snapshots SET ai_headline=$2,ai_summary=$3,ai_strongest_category=$4,ai_model=$5 WHERE id=$1 RETURNING *',[input.id,patch.ai_headline,patch.ai_summary,patch.ai_strongest_category,patch.ai_model]);
      if(!result.rowCount)throw fail(404,'Ranking unavailable');return reply(res,200,result.rows[0]);
    }
    if(url.pathname==='/v1/ai/run' && req.method==='POST') {
      const user=await identity(req);
      if(!user.roles.includes('admin')) throw fail(403,'Admin access required');
      const input=await body(req);
      return reply(res,200,await runActivityWorker(source,pool,workerEnabled,input.force===true));
    }
    if(url.pathname==='/v1/welcome' && req.method==='POST') {
      if(!writesEnabled) throw fail(503,'Migration in progress; writes disabled');
      const user=await identity(req);
      if(!user.roles.includes('admin')) throw fail(403,'Admin access required');
      const input=await body(req);
      if(typeof input.creatorId!=='string' || !/^[0-9a-f-]{36}$/i.test(input.creatorId)) throw fail(400,'Invalid creator ID');
      const creator=(await source.query("SELECT * FROM profiles WHERE id=$1 AND approval_status='approved' AND channel_authorized=true",[input.creatorId])).rows[0];
      if(!creator) throw fail(409,'Creator is not approved and authorized');
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`welcome:${creator.id}`]);
        const existing=await client.query("SELECT id,data FROM community_posts WHERE data->>'welcomeFor'=$1 LIMIT 1",[creator.id]);
        if(existing.rowCount) { await client.query('COMMIT'); return reply(res,200,{id:existing.rows[0].id,...existing.rows[0].data}); }
        let channelLink='';
        try { const link=new URL(creator.channel_url); if(link.protocol==='https:') channelLink=link.href; } catch {}
        const post={authorId:'streamcore_bot',authorName:'STREAMCORE BOT',authorHandle:'@streamcore',channel:'general',welcomeFor:creator.id,time:Date.now(),text:`Welcome ${creator.handle || creator.display_name || 'Creator'} to StreamCore. Their channel has been verified by the admin team.${channelLink?`\n\nChannel: ${channelLink}`:''}`,reactions:{},likes:[],comments:[],shares:0};
        const id=randomUUID();
        await client.query('INSERT INTO community_posts(id,data,created_at) VALUES($1,$2,$3)',[id,post,new Date(post.time)]);
        await client.query('COMMIT');
        return reply(res,201,{id,...post});
      } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
    if(url.pathname==='/v1/posts' && req.method==='DELETE') {
      if(!writesEnabled) throw fail(503,'Migration in progress; writes disabled');
      const user=await identity(req);
      if(!user.roles.includes('admin')) throw fail(403,'Admin access required');
      const authorId=url.searchParams.get('authorId');
      if(!authorId || !/^[0-9a-f-]{36}$/i.test(authorId)) throw fail(400,'Invalid author ID');
      const result=await pool.query("DELETE FROM community_posts WHERE data->>'authorId'=$1",[authorId]);
      return reply(res,200,{deletedCount:result.rowCount});
    }
    if (url.pathname === '/v1/feed' && req.method === 'GET') {
      const [general,channels,count] = await Promise.all([
        pool.query("SELECT id,data,created_at FROM community_posts WHERE coalesce(data->>'channel','general')='general' ORDER BY created_at DESC,id DESC LIMIT 41"),
        pool.query("SELECT id,data,created_at FROM community_posts WHERE coalesce(data->>'channel','general')<>'general' ORDER BY created_at DESC,id DESC LIMIT 40"),
        pool.query('SELECT count(*)::integer AS count FROM community_posts'),
      ]);
      const rows=general.rows.slice(0,40); const last=rows.at(-1);
      return reply(res,200,{rows:[...rows,...channels.rows],totalPosts:count.rows[0].count,hasMore:general.rows.length>40,cursor:last?Buffer.from(JSON.stringify([last.created_at,last.id])).toString('base64url'):null});
    }
    if(url.pathname==='/v1/engagement' && req.method==='GET') {
      const authorId=url.searchParams.get('authorId');
      if(!authorId || !/^[0-9a-f-]{36}$/i.test(authorId)) throw fail(400,'Invalid author ID');
      const result=await pool.query(`SELECT count(*) FILTER (WHERE coalesce(data->>'channel','general')='general')::integer AS "generalMessages",
        coalesce(sum((SELECT coalesce(sum(CASE WHEN value ~ '^[0-9]{1,9}$' THEN value::bigint ELSE 0 END),0) FROM jsonb_each_text(CASE WHEN jsonb_typeof(data->'reactions')='object' THEN data->'reactions' ELSE '{}'::jsonb END)) + CASE WHEN jsonb_typeof(data->'likes')='array' THEN jsonb_array_length(data->'likes') ELSE 0 END),0)::text AS "receivedReactions"
        FROM community_posts WHERE data->>'authorId'=$1`,[authorId]);
      return reply(res,200,{generalMessages:result.rows[0].generalMessages,receivedReactions:Number(result.rows[0].receivedReactions)});
    }
    if (/^\/v1\/posts\/[^/]+$/.test(url.pathname) && req.method === 'GET') {
      const id = decodeURIComponent(url.pathname.split('/').pop());
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw fail(400,'Invalid post ID');
      const result = await pool.query('SELECT id,data,created_at FROM community_posts WHERE id=$1',[id]);
      if (!result.rowCount) throw fail(404,'Post not found');
      return reply(res,200,result.rows[0]);
    }
    if (url.pathname === '/v1/media' && req.method === 'POST') {
      if (!writesEnabled) throw fail(503,'Migration in progress; writes disabled');
      const user = await identity(req);
      if (!canPost(user.profile,user.roles,'general')) throw fail(403,'Community approval required');
      const contentType = String(req.headers['content-type'] || '').split(';')[0];
      const chunks=[]; let bytes=0;
      for await (const chunk of req) { bytes+=chunk.length; if(bytes>64*1024*1024) throw fail(413,'Upload exceeds 64 MB'); chunks.push(chunk); }
      const data=Buffer.concat(chunks); const extension=mediaExtension(data,contentType);
      if (!extension) throw fail(400,'Unsupported or invalid media file');
      const file=`${randomUUID()}.${extension}`;
      await mkdir('/opt/streamcore/media/uploads',{recursive:true,mode:0o750});
      await writeFile(`/opt/streamcore/media/uploads/${file}`,data,{flag:'wx',mode:0o640});
      return reply(res,201,{url:`https://streamcore-api.legacynerxux.online/media/uploads/${file}`});
    }
    if (url.pathname === '/v1/post-events' && req.method === 'GET') {
      if (subscribers.size >= 100) throw fail(503, 'Live connection capacity reached');
      const cursor = req.headers['last-event-id'] || url.searchParams.get('after');
      if (cursor && !/^\d{1,18}$/.test(cursor)) throw fail(400, 'Invalid event cursor');
      let sequence = cursor || (await pool.query('SELECT coalesce(max(sequence),0)::text AS sequence FROM streamcore_post_events')).rows[0].sequence;
      let closed = false; let busy = false; let again = false;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
      res.write(`event: ready\ndata: ${JSON.stringify({ sequence })}\n\n`);
      const wake = async (broken = false) => {
        if (closed) return;
        if (broken) return res.end();
        if (busy) { again = true; return; }
        busy = true;
        try {
          do {
            again = false;
            const events = await pool.query('SELECT sequence::text,payload FROM streamcore_post_events WHERE sequence>$1 ORDER BY sequence LIMIT 101', [sequence]);
            if (events.rows.length > 100) { res.write('event: reset\ndata: {}\n\n'); return res.end(); }
            for (const event of events.rows) {
              if (!res.write(`id: ${event.sequence}\nevent: post\ndata: ${JSON.stringify(event.payload)}\n\n`)) return res.end();
              sequence = event.sequence;
            }
          } while (again && !closed);
        } catch { res.end(); } finally { busy = false; }
      };
      subscribers.add(wake);
      const heartbeat = setInterval(() => { if (!res.write(': heartbeat\n\n')) res.end(); },30000);
      res.on('close', () => { closed = true; clearInterval(heartbeat); subscribers.delete(wake); });
      void wake();
      return;
    }
    if (url.pathname === '/v1/posts' && req.method === 'GET') {
      const channel = url.searchParams.get('channel') || 'general';
      if (channel !== '*' && !/^[a-z0-9-]{1,60}$/.test(channel)) throw fail(400, 'Invalid channel');
      const before = url.searchParams.get('before'); let time=null; let id=null;
      if(before) {
        try { [time,id]=JSON.parse(Buffer.from(before,'base64url').toString()); } catch { throw fail(400,'Invalid cursor'); }
        if (!Number.isFinite(Date.parse(time)) || typeof id!=='string' || !/^[0-9a-f-]{36}$/i.test(id)) throw fail(400,'Invalid cursor');
      }
      const result = await pool.query("SELECT id,data,created_at FROM community_posts WHERE ($1::text IS NULL OR coalesce(data->>'channel','general')=$1) AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT 41",[channel==='*'?null:channel,time,id]);
      const rows=result.rows.slice(0,40); const last=rows.at(-1);
      return reply(res,200,{rows,hasMore:result.rows.length>40,cursor:last?Buffer.from(JSON.stringify([last.created_at,last.id])).toString('base64url'):null});
    }
    if (url.pathname === '/v1/posts' && req.method === 'POST') {
      if (!writesEnabled) throw fail(503, 'Migration in progress; writes disabled');
      const user = await identity(req); const input = await body(req);
      const channel = input.channel || 'general';
      if (!canPost(user.profile, user.roles, channel)) throw fail(403, 'Posting is not permitted');
      if (typeof input.text !== 'string' || (!input.text.trim() && !input.image && !input.video && !input.sticker) || input.text.length > (user.roles.includes('admin')?50000:10000)) throw fail(400, 'Invalid post content');
      const media = value => {
        if (!value) return '';
        if (typeof value !== 'string' || value.length > 2048) throw fail(400, 'Invalid media URL');
        let url; try { url = new URL(value); } catch { throw fail(400, 'Invalid media URL'); }
        if (url.protocol !== 'https:') throw fail(400, 'Media requires an HTTPS URL');
        return value;
      };
      let authorId = user.id;
      if (input.authorId && input.authorId !== user.id) {
        if (!user.roles.includes('admin')) throw fail(403, 'Cannot post as another creator');
        const creator = await source.query("SELECT id FROM community_listed_members WHERE id=$1 AND data->>'managedByAdmin'='true'", [input.authorId]);
        if (!creator.rowCount) throw fail(403, 'Creator is not admin-managed');
        authorId = input.authorId;
      }
      const time = user.roles.includes('admin') && Number.isFinite(input.time) && Math.abs(input.time) < 8640000000000000 ? input.time : Date.now();
      if(input.replyToId && !/^[0-9a-f-]{36}$/i.test(input.replyToId)) throw fail(400,'Invalid reply target');
      const post = { authorId, text: input.text.trim(), channel, time, image: media(input.image), video: media(input.video),sticker:typeof input.sticker==='string' && input.sticker.length<100?input.sticker:'',replyToId:input.replyToId||undefined,reactions: {}, likes: [], comments: [], shares: 0 };
      const id = randomUUID();
      await pool.query('INSERT INTO community_posts(id,data,created_at) VALUES($1,$2,$3)', [id,post,new Date(post.time)]);
      return reply(res, 201, { id, ...post });
    }
    if (/^\/v1\/posts\/[^/]+$/.test(url.pathname) && req.method === 'DELETE') {
      if (!writesEnabled) throw fail(503, 'Migration in progress; writes disabled');
      const user = await identity(req); const id = decodeURIComponent(url.pathname.split('/').pop());
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw fail(400,'Invalid post ID');
      const result = await pool.query("DELETE FROM community_posts WHERE id=$1 AND (data->>'authorId'=$2 OR $3::boolean) RETURNING id", [id,user.id,canDelete(user.id,user.roles,'')]);
      if (!result.rowCount) throw fail(404, 'Post unavailable or deletion not permitted');
      return reply(res, 200, { deleted: id });
    }
    if (/^\/v1\/posts\/[^/]+$/.test(url.pathname) && req.method === 'PATCH') {
      if (!writesEnabled) throw fail(503,'Migration in progress; writes disabled');
      const user = await identity(req); const input = await body(req);
      const id = decodeURIComponent(url.pathname.split('/').pop());
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400,'Invalid post ID');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const row = await client.query('SELECT data FROM community_posts WHERE id=$1 FOR UPDATE',[id]);
        if (!row.rowCount) throw fail(404,'Post not found');
        const data = mutatePost(row.rows[0].data,user,input);
        await client.query('UPDATE community_posts SET data=$2 WHERE id=$1',[id,data]);
        await client.query('COMMIT');
        return reply(res,200,{id,...data});
      } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
    throw fail(404, 'Not found');
  } catch (error) { reply(res, error.status || 500, { error: error.status ? error.message : 'Backend request failed' }); }
});
server.listen(Number(process.env.PORT || 4100), '127.0.0.1');
process.on('SIGTERM', () => { clearInterval(activityTimer); clearInterval(dataTimer); for (const wake of subscribers) wake(true); listener.release(); server.close(() => Promise.all([pool.end(),source!==pool?source.end():Promise.resolve()]).then(() => process.exit(0))); });
