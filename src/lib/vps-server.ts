export const usingVpsJobs = () => process.env['DATA_BACKEND'] === 'vps';
export async function vpsServerRequest(path:string,accessToken?:string,method='GET',body?:unknown) {
  const response=await fetch(`https://streamcore-api.legacynerxux.online${path}`,{method,headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error || 'Backend job failed');return result;
}
export async function readVpsEngagement(authorId:string):Promise<{generalMessages:number;receivedReactions:number}> {
  const response=await fetch(`https://streamcore-api.legacynerxux.online/v1/engagement?${new URLSearchParams({authorId})}`,{signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error('Cannot read migrated community engagement');
  return response.json();
}
export async function readVpsPosts() {
  const rows:Array<{id:string;data:Record<string,any>}>=[];
  let cursor:string|null=null;
  do {
    const query=new URLSearchParams({channel:'*',...(cursor?{before:cursor}:{})});
    const response=await fetch(`https://streamcore-api.legacynerxux.online/v1/posts?${query}`,{signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new Error('Cannot read migrated posts for ranking calculations');
    const page=await response.json();
    rows.push(...page.rows);
    cursor=page.hasMore?page.cursor:null;
    if(cursor && rows.length>=10000) throw new Error('Ranking history limit reached; aggregation must be moved to the backend');
  } while(cursor);
  return rows;
}
export async function readVpsPost(id:string):Promise<{data:{id:string;data:Record<string,any>}|null}> {
  const response=await fetch(`https://streamcore-api.legacynerxux.online/v1/posts/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(10000)});
  if(response.status===404) return {data:null};
  if(!response.ok) throw new Error('Cannot read the migrated community message');
  return {data:await response.json()};
}
export async function invokeVpsJob(accessToken:string,force=false) {
  const response=await fetch('https://streamcore-api.legacynerxux.online/v1/ai/run',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify({force}),signal:AbortSignal.timeout(120000)});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error || 'Activity engine request failed');
  return result;
}
