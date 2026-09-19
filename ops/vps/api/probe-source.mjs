import pg from 'pg';
import {readFile} from 'node:fs/promises';
const ca=process.env.SOURCE_CA_FILE ? await readFile(process.env.SOURCE_CA_FILE,'utf8') : undefined;
const pool=new pg.Pool({connectionString:process.env.SOURCE_DATABASE_URL,max:1,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},connectionTimeoutMillis:15000});
try {
  await pool.query('SELECT 1');
  console.log('Secure source connection: PASS');
} catch(error) { console.error(`Secure source connection failed: ${error.code || 'connection error'}`);process.exitCode=1; }
finally {await pool.end();}
