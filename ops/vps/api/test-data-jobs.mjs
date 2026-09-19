import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {syncLive} from './live-worker.mjs';
import {syncRankings} from './ranking-worker.mjs';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5});
const source=new pg.Pool({connectionString:process.env.SOURCE_DATABASE_URL,max:2,ssl:{rejectUnauthorized:true,ca:await readFile(process.env.SOURCE_CA_FILE,'utf8')}});
try {
  if((await pool.query('SELECT current_database() AS name')).rows[0].name!=='streamcore_migration_stage')throw new Error('Staging tests only');
  const live=await syncLive(source,pool,true,true);
  const rankings=await syncRankings(source,pool,true,true);
  if(!live.snapshots.length || !rankings.rows.length)throw new Error('No real results');
  if(rankings.rows.some(r=>!Number.isFinite(Number(r.scores.totalScore))))throw new Error('Invalid scores');
  const duplicate=await pool.query('SELECT count(*)::integer AS count FROM (SELECT creator_id,observed_bucket FROM creator_twitch_observations GROUP BY creator_id,observed_bucket HAVING count(*)>1) t');
  if(duplicate.rows[0].count)throw new Error('Duplicate observations');
  console.log(JSON.stringify({liveCreators:live.snapshots.length,currentlyLive:live.snapshots.filter(s=>s.status==='live').length,rankedCreators:rankings.rows.length,formulaVersion:rankings.rows[0].formula_version,observationsUnique:true}));
}finally{await Promise.all([source.end(),pool.end()]);}
