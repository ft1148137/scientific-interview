export const manifest = {"id": "meta", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["www.metacareers.com"], "entry_url": "https://www.metacareers.com/jobsearch/", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Meta"};
import {createInternationalSite,completeEnglishJD} from '../shared/international.mjs';
export function createSiteSlot(port) {
 return createInternationalSite(port,{manifest,searchURL:q=>manifest.entry_url+'?q='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:'a[href*="/profile/job_details/"]:has(h3)',fields:{title:'h3'}}}},
  id:u=>u.pathname.match(/^\/profile\/job_details\/(\d+)\/?$/)?.[1],
  detailReady:'div.x1na6gtj:has(h1):has(h2)',detailSpec:{fields:{title:'h1',jd:'div.x1na6gtj:has(h1):has(h2)'}},
  parse:d=>({title:d.fields.title,jd:d.fields.jd,complete:completeEnglishJD((d.fields.jd || '').replace(/^.* Responsibilities$/m,'Responsibilities'))})});
}
