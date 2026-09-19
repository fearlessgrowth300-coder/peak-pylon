import {readFile,writeFile} from 'node:fs/promises';
let input='';for await(const chunk of process.stdin)input+=chunk;
const values=JSON.parse(input),path='/opt/streamcore/private/api-stage.env';
const names=['TWITCH_CLIENT_ID','TWITCH_CLIENT_SECRET','KICK_CLIENT_ID','KICK_CLIENT_SECRET'];
let config=await readFile(path,'utf8');
for(const name of names){const value=values[name];if(typeof value!=='string' || !value)continue;if(!/^[a-zA-Z0-9_.-]+$/.test(value))throw new Error('Invalid provider credential format');config=config.split('\n').filter(line=>!line.startsWith(`${name}=`)).join('\n');config+=`\n${name}=${value}\n`;}
await writeFile(path,config,{mode:0o600});
console.log('Provider configuration saved securely');
