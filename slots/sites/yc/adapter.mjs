export const manifest = {"id": "yc", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["www.workatastartup.com"], "entry_url": "https://www.workatastartup.com/jobs", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "visible-title", "path_prefix": "/jobs"};
import {createInternationalSite,englishDescription} from '../shared/international.mjs';
export function createSiteSlot(port) {
 return createInternationalSite(port,{manifest,searchURL:()=>manifest.entry_url,
  listSpec:{lists:{jobs:{selector:'a[href^="/jobs/"]:has(h3)',fields:{title:'h3',company:'p.font-semibold'}}}},
  id:u=>u.pathname.match(/^\/jobs\/(\d+)\/?$/)?.[1],
  detailReady:'.variant2-prose',detailSpec:{fields:{title:'h1',company:'section:has(h1) a[href^="/companies/"]',jd:'section:has(h2) .variant2-prose'},lists:{facts:{selector:'section:has(h1) div:has(> span.font-mono)',fields:{label:'span:first-child',value:'span:nth-child(2)'}}}},
  parse:d=>{
   const base=englishDescription(d),facts=d.lists.facts || [];
   return {...base,location:facts.find(f=>f.label==='Location')?.value || null,jd:[...facts.map(f=>`${f.label}: ${f.value}`),base.jd].join('\n\n')};
  }});
}
