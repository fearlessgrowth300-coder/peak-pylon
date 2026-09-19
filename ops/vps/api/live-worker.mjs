let appToken;
async function helix(path,params) {
  const clientId=process.env.TWITCH_CLIENT_ID, secret=process.env.TWITCH_CLIENT_SECRET;
  if(!clientId || !secret) throw new Error('Twitch server credentials missing');
  if(!appToken || appToken.expires<Date.now()+60000) {
    const response=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:clientId,client_secret:secret,grant_type:'client_credentials'}),signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new Error(`Twitch authentication failed (${response.status})`);
    const result=await response.json();
    if(!result.access_token) throw new Error('Twitch token missing');
    appToken={token:result.access_token,expires:Date.now()+result.expires_in*1000};
  }
  const response=await fetch(`https://api.twitch.tv/helix/${path}?${params}`,{headers:{'Client-Id':clientId,Authorization:`Bearer ${appToken.token}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`Twitch ${path} failed (${response.status})`);
  return (await response.json()).data || [];
}
export async function syncLive(source,pool,enabled,force=false) {
  if(!enabled) return {status:'Paused'};
  const lock=await pool.connect();let held=false;
  try {
    held=(await lock.query('SELECT pg_try_advisory_lock(731291,2) AS held')).rows[0].held;
    if(!held) return {status:'Busy'};
    const previous=(await pool.query("SELECT data FROM streamcore_job_state WHERE name='live_status'")).rows[0]?.data;
    if(!force && Date.parse(previous?.refreshedAt || '')>Date.now()-120000) return previous;
    const [listed,profiles]=await Promise.all([source.query('SELECT id,data FROM community_listed_members'),source.query("SELECT id,channel_url,platform FROM profiles WHERE channel_authorized=true")]);
    const creators=new Map(listed.rows.map(r=>[String(r.id),{id:String(r.id),...r.data}]));
    for(const r of profiles.rows) if(!creators.has(String(r.id))) creators.set(String(r.id),{id:String(r.id),link:r.channel_url,platform:r.platform});
    const channels=[];
    for(const r of creators.values()) {
      try { const url=new URL(r.link);if(!/(^|\.)twitch\.tv$/i.test(url.hostname))continue;const login=url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();if(/^[a-z0-9_]{1,25}$/.test(login))channels.push({...r,login}); } catch {}
    }
    const snapshots=[];
    for(let offset=0;offset<channels.length;offset+=100) {
      const batch=channels.slice(offset,offset+100);
      const users=await helix('users',new URLSearchParams(batch.map(r=>['login',r.login])));
      const streams=users.length?await helix('streams',new URLSearchParams([['first','100'],...users.map(u=>['user_id',u.id])])):[];
      const games=streams.length?await helix('games',new URLSearchParams([...new Set(streams.map(s=>s.game_id).filter(Boolean))].map(id=>['id',id]))):[];
      for(const channel of batch) {
        const user=users.find(u=>u.login.toLowerCase()===channel.login),stream=streams.find(s=>s.user_id===user?.id),game=games.find(g=>g.id===stream?.game_id);
        snapshots.push({id:channel.id,name:user?.display_name || channel.login,handle:`@${user?.login || channel.login}`,status:stream?'live':'offline',banner:stream?stream.thumbnail_url.replace('{width}','1280').replace('{height}','720'):user?.offline_image_url || '',avatar:user?.profile_image_url || '',bio:user?.description || '',gameName:stream?.game_name || '',gameImage:game?.box_art_url.replace('{width}','285').replace('{height}','380') || '',viewerCount:stream?.viewer_count || 0,title:stream?.title || '',streamId:stream?.id,followers:Number.isFinite(channel.followers)?channel.followers:undefined});
      }
    }
    const now=new Date(),bucket=new Date(Math.floor(now.getTime()/1800000)*1800000);
    await lock.query('BEGIN');
    for(const s of snapshots) await lock.query('INSERT INTO creator_twitch_observations(creator_id,observed_bucket,observed_at,is_live,viewer_count,followers,game_name,stream_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(creator_id,observed_bucket) DO UPDATE SET observed_at=EXCLUDED.observed_at,is_live=EXCLUDED.is_live,viewer_count=EXCLUDED.viewer_count,followers=EXCLUDED.followers,game_name=EXCLUDED.game_name,stream_id=EXCLUDED.stream_id',[s.id,bucket,now,s.status==='live',s.viewerCount,s.followers??null,s.gameName,s.streamId??null]);
    const result={snapshots,refreshedAt:now.toISOString()};
    await lock.query("INSERT INTO streamcore_job_state(name,data) VALUES('live_status',$1) ON CONFLICT(name) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",[result]);
    await lock.query('COMMIT');
    return result;
  } catch(error) {await lock.query('ROLLBACK');throw error;} finally {if(held)await lock.query('SELECT pg_advisory_unlock(731291,2)');lock.release();}
}
