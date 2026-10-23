export const manifest = {"id": "jd", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "京东", "domains": ["zhaopin.jd.com"], "entry_url": "https://zhaopin.jd.com/web/job_info_list/3?isHunterFlag=false", "requires": ["navigate", "observe", "click", "wait", "fill"], "search_fields": ["keyword"], "shared_detail_url": true};
import {createDOMSite,sections} from '../shared/dom-site.mjs';
import {gate} from '../../protocol.mjs';
export function createSiteSlot(port) {
 const cards='.line .info',pages='#pagination a:not(.next):not(.prev), #pagination span.current';
 const list=createDOMSite(port,{manifest,pages,searchURL:()=>manifest.entry_url,search:{input:'#search-key'},
  listSpec:{lists:{jobs:{selector:cards,fields:{title:{selector:'.post',attribute:'title'},location:'.sel:nth-of-type(4)',external_id:{selector:'a.apply-btn',attribute:'recrequirementid'}}},pages:{selector:pages}},controls:[pages]},id:()=>null});
 return {manifest,probe:list.probe,discover:list.discover,
  async readJob(ref) {
   if(!/^\d+$/.test(ref.external_id || '') || !ref.query || !Number.isInteger(ref.page)) return gate('REJECT','INVALID_REF');
   const found=await list.discover(ref.query,{page:ref.page});
   if(found.gate!=='PASS') return found;
   const card=found.data.refs.find(r=>r.external_id===ref.external_id);
   if(!card || card.title!==ref.title || card.card_text!==ref.card_text) return gate('REJECT','LIST_CHANGED');
   const row='.line:has(a.apply-btn[recrequirementid="'+ref.external_id+'"])',title={selector:row+' .info .post',attribute:'title'},toggle=row+' b.drop-down';
   let observed=await list.probe(await port.observe({controls:[toggle]}));
   if(observed.gate!=='PASS') return observed;
   observed=await list.probe(await port.act({kind:'click',selector:toggle,snapshot_id:observed.data.snapshot_id}));
   if(observed.gate!=='PASS') return observed;
   observed=await list.probe(await port.wait({selector:row+' .detail .par',observe:{fields:{title},lists:{sections:{selector:row+' .detail .par',fields:{heading:'h3'}}}}}));
   if(observed.gate!=='PASS') return observed;
   const d=observed.data,parsed=sections(d);
   if(parsed.title!==ref.title) return gate('REJECT','IDENTITY_CHANGED');
   return gate('PASS','JOB_READ','',{data:{external_id:ref.external_id,title:parsed.title,company:manifest.company,url:d.url,location:ref.location,jd:parsed.jd || null,jd_complete:!!parsed.complete && !d.lists.sections.some(b=>b.clipped),status:parsed.jd?'open':'unknown',observed_at:d.observed_at,evidence:{url:d.url,observed_at:d.observed_at,text:[parsed.title,parsed.jd].join('\n'),kind:'page'}}});
  }};
}
