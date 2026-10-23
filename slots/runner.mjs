import {gate,negotiate} from './protocol.mjs';
// One bounded chunk per call. The agent persists each result before starting another chunk.
export async function runScan(port,site,query={},options={}) {
  const check=negotiate(site.manifest,port.manifest);if(check.gate!=='PASS')return check;
  const maxJobs=options.maxJobs??5,maxPages=options.maxPages??1;
  if(!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>100||!Number.isInteger(maxPages)||maxPages<1||maxPages>20)return gate('REJECT','INVALID_LIMITS');
  const cp=options.checkpoint;
  if(cp && (cp.protocol_version!==1 || cp.source!==site.manifest.id || cp.slot_version!==site.manifest.version || JSON.stringify(cp.query)!==JSON.stringify(query)))return gate('REJECT','CHECKPOINT_INCOMPATIBLE');
  const result={protocol_version:1,id:options.id||'scan-'+Date.now(),source:site.manifest.id,slot_version:site.manifest.version,browser_id:port.manifest.id,query,observed_at:new Date().toISOString(),gate:'PASS',code:'CHUNK_COMPLETE',coverage:'partial',records:[],rejected_refs:[...(cp?.rejected_refs||[])],seen_urls:[],seen_ids:[],message:'本批已保存，扫描范围尚未完成。',next_action:'保存并 ingest 本批结果；有断点则继续下一批。',checkpoint:null};
  let cursor=cp?.cursor||null, startIndex=0, pages=0;
  if(cp?.completed_ids!==undefined && (!Array.isArray(cp.completed_ids) || cp.completed_ids.some(id=>typeof id!=='string' || !id)))return gate('REJECT','INVALID_CHECKPOINT');
  const completed=new Set(cp?.completed_urls||[]),completedIds=new Set((cp?.completed_ids||[]).map(String));
  const hasCompleted=ref=>(ref.external_id!=null && completedIds.has(String(ref.external_id))) || (ref.url && completed.has(ref.url));
  let retries=cp?.retry_attempts??0, retryCode=cp?.retry_code??null, retryNotBefore=cp?.retry_not_before??null;
  if(!Number.isInteger(retries)||retries<0||retries>2||(retryNotBefore!==null&&!Number.isFinite(Date.parse(retryNotBefore))))return gate('REJECT','INVALID_RETRY_CHECKPOINT');
  if(options.resumeAfterUser===true&&retries>=2){retries=0;retryCode=null;}
  const checkpoint=(index)=>({protocol_version:1,source:site.manifest.id,slot_version:site.manifest.version,query,cursor,next_index:index,completed_urls:[...completed],completed_ids:[...completedIds],rejected_refs:result.rejected_refs,retry_attempts:retries,retry_code:retryCode,retry_not_before:retryNotBefore});
  function stopped(r,index){Object.assign(result,{gate:r.gate,code:r.code,message:r.message||r.code,next_action:r.next_action||'保存结果与断点，处理门禁提示后继续。',seen_urls:[...completed],seen_ids:[...completedIds],checkpoint:checkpoint(index),retry_attempts:retries});if(r.retryAfter!==undefined)result.retryAfter=r.retryAfter;return result;}
  // A checkpoint carries the retry budget across separate host calls; no sleeping or busy retrying here.
  if(retryCode&&retries>=2)return stopped(gate('WAIT_USER','RETRY_EXHAUSTED','已重试两次，当前批次仍未完成。',{next_action:'保留断点并停止自动重试；用户检查原因并明确要求继续后，才使用 resumeAfterUser: true。'}),cp?.next_index||0);
  const remaining=retryNotBefore?Math.ceil((Date.parse(retryNotBefore)-Date.now())/1000):0;
  if(remaining>0)return stopped(gate('RETRY','RETRY_NOT_READY',`还需等待 ${remaining} 秒，不会访问网站。`,{retryAfter:remaining,next_action:'等待 retryAfter 秒后使用同一断点；本次没有消耗重试次数。'}),cp?.next_index||0);
  if(retryCode)retries++;
  async function stop(r,index) {
    if(r.gate==='RETRY'){
      retryCode=r.code;
      const seconds=Number.isFinite(r.retryAfter)&&r.retryAfter>=0?r.retryAfter:30;
      retryNotBefore=new Date(Date.now()+seconds*1000).toISOString();
      r={...r,retryAfter:seconds,next_action:r.next_action||`至少等待 ${seconds} 秒后从断点继续；已重试 ${retries}/2 次。`};
    }else{retries=0;retryCode=null;retryNotBefore=null;}
    if(r.gate==='WAIT_USER'&&port.handoff)await port.handoff();
    return stopped(r,index);
  }
  while(pages<maxPages) {
    const found=await site.discover(query,cursor);if(found.gate!=='PASS')return stop(found,startIndex);
    for(let i=startIndex;i<found.data.refs.length;i++) {
      if(result.records.length>=maxJobs){result.checkpoint=checkpoint(i);result.seen_urls=[...completed];result.seen_ids=[...completedIds];return result;}
      const ref=found.data.refs[i];if(hasCompleted(ref))continue;
      const read=await site.readJob(ref);if(read.gate==='REJECT'){result.rejected_refs.push({ref,code:read.code,message:read.message});continue;}if(read.gate!=='PASS')return stop(read,i);
      retries=0;retryCode=null;retryNotBefore=null;
      if(!hasCompleted(read.data)){result.records.push(read.data);if(read.data.external_id!=null)completedIds.add(String(read.data.external_id));else completed.add(read.data.url);}
    }
    pages++;startIndex=0;cursor=found.data.next_cursor;
    if(!cursor){result.coverage=result.rejected_refs.length || ['partial','unknown'].includes(found.data.coverage)?'partial':'complete';result.seen_urls=[...completed];result.seen_ids=[...completedIds];result.message=result.coverage==='partial'?'可读取条目已处理，但拒绝条目或分页边界仍待核验。':'本轮声明范围已完成。';result.next_action=result.coverage==='partial'?'保存本批，查看拒绝原因；未读取岗位不能判定下线。':'保存并 ingest 本批结果，再 render 查看变化。';return result;}
  }
  result.checkpoint=checkpoint(0);result.seen_urls=[...completed];result.seen_ids=[...completedIds];return result;
}
