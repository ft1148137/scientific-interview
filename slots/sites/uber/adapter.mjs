export const manifest = {"id": "uber", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["jobs.uber.com"], "entry_url": "https://jobs.uber.com/en/jobs/", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Uber", "path_prefix": "/en/jobs"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const next='a[aria-label="Go to next page"]';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?search='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:'h2:has(a.js-view-job)',fields:{title:'a.js-view-job',href:{selector:'a.js-view-job',attribute:'href'}}}},controls:[next]},
  id:u=>u.pathname.match(/^\/en\/jobs\/(\d+)\/?$/)?.[1],
  detailReady:'main .wysiwyg',detailSpec:{fields:{title:'h1',jd:'main .wysiwyg'}}});
}
