export const manifest = {"id": "wellfound", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["wellfound.com"], "entry_url": "https://wellfound.com/role/software-engineer", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "visible-title"};
import {createInternationalSite,completeEnglishJD} from '../shared/international.mjs';
export function createSiteSlot(port) {
 return createInternationalSite(port,{manifest,searchURL:()=>manifest.entry_url,
  listSpec:{lists:{jobs:{selector:'div.mb-1:has(> a[href^="/jobs/"])',fields:{title:'a[href^="/jobs/"]',href:{selector:'a[href^="/jobs/"]',attribute:'href'}}}}},
  id:u=>u.pathname.match(/^\/jobs\/(\d+)-/)?.[1],
  detailReady:'#job-description',detailSpec:{fields:{title:'h1',company:'a[href^="/company/"] > span',jd:'#job-description',location:'div:has(> h1) a[href^="/location/"]'},lists:{facts:{selector:'div.grid > div:has(> span.font-semibold)'}}},
  parse:d=>({title:d.fields.title,company:d.fields.company,location:d.fields.location,jd:[...(d.lists.facts || []).map(x=>x.text),d.fields.jd].filter(Boolean).join('\n\n'),complete:completeEnglishJD(d.fields.jd)})});
}
