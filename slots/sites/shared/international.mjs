import {createDOMSite} from './dom-site.mjs';
import {gate} from '../../protocol.mjs';

// Only visible description text is certified; unfamiliar headings remain incomplete.
export function completeEnglishJD(text = '') {
  const section = names => new RegExp('(?:^|\\n)\\s*(?:' + names + ')[：:]?\\s*\\n+\\s*\\S', 'i').test(text);
  return text.length > 150 && section('Responsibilities|Key (?:job )?responsibilities|What you[’\x27]ll (?:do|be doing)|What you will (?:do|be doing)|In this role, you will|Description|Your impact|Impact you will have|Representative Projects|Responsibilities will include|The difference you will make|Every day') && section('(?:Minimum|Basic|Required|Preferred) (?:qualifications|requirements)|Qualifications|Requirements|What we need to see|You (?:may|might) be a good fit if you|You might thrive in this role if you|Who you are|Your expertise|What we look for|Key things we.ll be looking for|What sets you apart|What we.re looking for');
}
export function englishDescription(d) {
  const jd=d.fields.jd || (d.lists.sections || []).map(s=>s.text).join('\n\n');
  return {title:d.fields.title,company:d.fields.company,location:d.fields.location,jd,complete:completeEnglishJD(jd)};
}
// Local title search is explicit in the manifest; it does not claim native full-text search.
export function createInternationalSite(port, config) {
  const site=createDOMSite(port,{parse:englishDescription,...config});
  return {...site,async discover(query={},cursor=null) {
    if(Object.keys(query).some(k=>!config.manifest.search_fields.includes(k)) || (query.keyword!==undefined && typeof query.keyword!=='string')) return gate('REJECT','UNSUPPORTED_QUERY');
    const local=config.manifest.keyword_mode==='visible-title';
    const r=await site.discover(local?{}:query,cursor);
    if(r.gate!=='PASS')return r;
    const tokens=(query.keyword || '').toLowerCase().split(/\s+/).filter(Boolean);
    const seen=new Set();
    r.data.refs=r.data.refs.filter(ref=>{
      if(local && !tokens.every(t=>ref.title.toLowerCase().includes(t)))return false;
      const key=ref.external_id || ref.url;
      if(key && seen.has(key))return false;
      if(key)seen.add(key);
      return true;
    });
    // A sampled rendered list is not evidence of the entire international catalog.
    r.data.coverage='partial';
    return r;
  }};
}
export function createAshbySite(port,manifest) {
 return createInternationalSite(port,{manifest,searchURL:()=>manifest.entry_url,
  listSpec:{lists:{jobs:{selector:'a:has(.ashby-job-posting-brief-title)',fields:{title:'.ashby-job-posting-brief-title'}}}},
  id:u=>u.pathname.match(new RegExp('^'+manifest.path_prefix+'/([a-f0-9-]{36})/?$'))?.[1],
  detailReady:'.ashby-job-posting-description',
  detailSpec:{fields:{title:'.ashby-job-posting-heading',jd:'.ashby-job-posting-description',location:'.ashby-job-posting-left-pane > div:first-child p'}}});
}
export function createGreenhouseSite(port,manifest) {
 const next='button[aria-label="Next page"]';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?keyword='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:'.job-post a',fields:{title:'.body--medium',location:'.body__secondary'}}},controls:[next]},
  id:u=>u.pathname.match(new RegExp('^'+manifest.path_prefix+'/jobs/(\\d+)/?$'))?.[1],
  detailReady:'.job__description',detailSpec:{fields:{title:'.job__title h1',jd:'.job__description',location:'.job__location'}}});
}
export function createEightfoldSite(port,manifest) {
 const next='button[class*="pagination-next"]';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?query='+encodeURIComponent(q.keyword || '')+'&start=0',
  listSpec:{lists:{jobs:{selector:'a[id$="-job-list"]',fields:{title:'[class^="title-"]'}}},controls:[next]},
  id:u=>u.pathname.match(/^\/careers\/job\/(\d+)\/?$/)?.[1],
  detailReady:'#job-description-container',detailSpec:{fields:{title:'h2[class*="position-title-"]',location:'[class*="position-location-"]',jd:'#job-description-container'}}});
}
