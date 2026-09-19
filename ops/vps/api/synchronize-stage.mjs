// Consistent read-only source snapshot. Not a production cutover or write pause.
import pg from 'pg';
import {readFile} from 'node:fs/promises';
const targetPool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1});
const sourcePool=new pg.Pool({connectionString:process.env.SOURCE_DATABASE_URL,max:1,ssl:{rejectUnauthorized:true,ca:await readFile(process.env.SOURCE_CA_FILE,'utf8')}});
const source=await sourcePool.connect(),target=await targetPool.connect();
const tables=['community_posts','creator_twitch_observations','creator_metric_snapshots'];
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const checksum=table=>`SELECT count(*)::text AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS hash FROM ${quote(table)} t`;
try {
  if(process.env.ENABLE_WRITES!=='false' || (await target.query('SELECT current_database() AS name')).rows[0].name!=='streamcore_migration_stage')throw new Error('Requires isolated staging with writes disabled');
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await target.query('BEGIN');await Promise.all([source.query("SET LOCAL TIME ZONE 'UTC'"),target.query("SET LOCAL TIME ZONE 'UTC'")]);
  for(const table of tables) {
    const columns=(await source.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table])).rows;
    if(!columns.length)throw new Error('Source table missing');
    const projection=columns.map(c=>c.data_type.startsWith('timestamp')?`${quote(c.column_name)}::text AS ${quote(c.column_name)}`:quote(c.column_name)).join(',');
    const rows=(await source.query(`SELECT ${projection} FROM ${quote(table)}`)).rows;
    await target.query(`DELETE FROM ${quote(table)}`);
    for(let offset=0;offset<rows.length;offset+=500) {
      const batch=rows.slice(offset,offset+500),values=[];
      const placeholders=batch.map(row=>'('+columns.map(c=>{values.push(row[c.column_name]);return '$'+values.length;}).join(',')+')').join(',');
      await target.query(`INSERT INTO ${quote(table)}(${columns.map(c=>quote(c.column_name)).join(',')}) VALUES ${placeholders}`,values);
    }
    const [expected,actual]=await Promise.all([source.query(checksum(table)),target.query(checksum(table))]);
    if(JSON.stringify(expected.rows[0])!==JSON.stringify(actual.rows[0]))throw new Error(`Snapshot checksum mismatch: ${table}`);
    console.log(JSON.stringify({table,rows:actual.rows[0].count,checksumMatched:true}));
  }
  await target.query('COMMIT');await source.query('COMMIT');
  console.log('Staging synchronized to a consistent source snapshot. Live source can subsequently change; final write-pause reconciliation is still required.');
}catch(error){await Promise.all([target.query('ROLLBACK'),source.query('ROLLBACK')]);throw error;}
finally{source.release();target.release();await Promise.all([sourcePool.end(),targetPool.end()]);}
