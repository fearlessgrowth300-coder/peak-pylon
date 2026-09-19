import {randomUUID} from 'node:crypto';
import {calculateCreatorMetrics,calculateCreatorScores,generateCreatorAiAnalysis} from './ranking-formulas.mjs';
export async function latestRankings(pool) {
  const latest=(await pool.query('SELECT batch_id,captured_at FROM creator_metric_snapshots ORDER BY captured_at DESC LIMIT 1')).rows[0];
  if(!latest)return {capturedAt:null,rows:[]};
  return {capturedAt:latest.captured_at,rows:(await pool.query('SELECT * FROM creator_metric_snapshots WHERE batch_id=$1 ORDER BY rank',[latest.batch_id])).rows};
}
export async function syncRankings(source,pool,enabled,force=false) {
  if(!enabled)return latestRankings(pool);
  const lock=await pool.connect();let held=false;
  try {
    held=(await lock.query('SELECT pg_try_advisory_lock(731291,3) AS held')).rows[0].held;
    if(!held)return latestRankings(pool);
    const latest=await latestRankings(pool);
    if(!force && Date.parse(latest.capturedAt)>Date.now()-1800000)return latest;
    const [members,posts,history,live]=await Promise.all([
      source.query('SELECT id,data FROM community_listed_members'),pool.query('SELECT id,data FROM community_posts'),
      pool.query(`SELECT creator_id,(array_agg(followers ORDER BY observed_at) FILTER(WHERE followers>0))[1] AS first_followers,(array_agg(followers ORDER BY observed_at DESC) FILTER(WHERE followers>0))[1] AS latest_followers,coalesce(avg(viewer_count) FILTER(WHERE is_live),0) AS average_live_viewers,coalesce(max(viewer_count) FILTER(WHERE is_live),0) AS peak_live_viewers,count(*) FILTER(WHERE is_live) AS live_observation_count,count(DISTINCT (observed_at AT TIME ZONE 'utc')::date) FILTER(WHERE is_live) AS live_days,min(observed_at) AS first_observed_at,max(observed_at) AS last_observed_at FROM creator_twitch_observations WHERE observed_at>=now()-interval '30 days' GROUP BY creator_id`),
      pool.query("SELECT data FROM streamcore_job_state WHERE name='live_status'")]);
    const cached=live.rows[0]?.data,status=new Map((Date.parse(cached?.refreshedAt)>Date.now()-600000?cached.snapshots:[]).map(s=>[s.id,s]));
    const rollups=new Map(history.rows.map(r=>[r.creator_id,{firstFollowers:Number(r.first_followers),latestFollowers:Number(r.latest_followers),averageLiveViewers:Number(r.average_live_viewers),peakLiveViewers:Number(r.peak_live_viewers),liveObservationCount:Number(r.live_observation_count),liveDays:Number(r.live_days),firstObservedAt:r.first_observed_at,lastObservedAt:r.last_observed_at}]));
    const feed=posts.rows.map(r=>({...r.data,id:r.id}));
    const calculated=members.rows.map(r=>{
      const s=status.get(String(r.id)),member={...r.data,id:String(r.id),status:s?.status || 'offline',viewerCount:s?.viewerCount || 0,...(s?{name:s.name,avatar:s.avatar}: {})};
      const metrics=calculateCreatorMetrics(member,feed,rollups.get(String(r.id))),scores=calculateCreatorScores(metrics),analysis=generateCreatorAiAnalysis(member,scores,metrics);
      return {creatorId:String(r.id),metrics,scores,analysis};
    }).sort((a,b)=>b.scores.totalScore-a.scores.totalScore || b.metrics.followers-a.metrics.followers || a.creatorId.localeCompare(b.creatorId));
    const previous=new Map(latest.rows.map(r=>[r.creator_id,r.rank])),batch=randomUUID(),now=new Date();
    await lock.query('BEGIN');
    for(let i=0;i<calculated.length;i++){
      const r=calculated[i],rank=i+1,prior=previous.get(r.creatorId)||rank;
      await lock.query('INSERT INTO creator_metric_snapshots(id,batch_id,creator_id,captured_at,metrics,scores,rank,previous_rank,rank_delta,formula_version,ai_headline,ai_summary,ai_strongest_category,ai_model) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[randomUUID(),batch,r.creatorId,now,r.metrics,r.scores,rank,prior,prior-rank,'streamcore-real-v1',r.analysis.aiAnalysis.headline,r.analysis.aiAnalysis.summary,r.analysis.aiAnalysis.strongestCategory,'deterministic-formula-explanation']);
    }
    await lock.query('COMMIT');return latestRankings(pool);
  } catch(error){await lock.query('ROLLBACK');throw error;}finally{if(held)await lock.query('SELECT pg_advisory_unlock(731291,3)');lock.release();}
}
