export const manifest = {"id": "amazon", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["www.amazon.jobs"], "entry_url": "https://www.amazon.jobs/en/search", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Amazon", "path_prefix": "/en"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const next='button[aria-label="Next page"]';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?base_query='+encodeURIComponent(q.keyword || '')+'&loc_query=',
  listSpec:{lists:{jobs:{selector:'.job-title',fields:{title:'a.job-link',href:{selector:'a.job-link',attribute:'href'}}}},controls:[next]},
  id:u=>u.pathname.match(/^\/en\/jobs\/(\d+)\//)?.[1],
  detailReady:'.content .section:not(.description)',detailSpec:{fields:{title:'h1.title'},lists:{sections:{selector:'.content .section:not(.description)'}}}});
}
