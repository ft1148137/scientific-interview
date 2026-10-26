export const manifest = {"id": "google", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["www.google.com"], "entry_url": "https://www.google.com/about/careers/applications/jobs/results/", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Google", "path_prefix": "/about/careers/applications/jobs/results"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const next='a[aria-label="Go to next page"]';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?q='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:'.sMn82b',fields:{title:'h3',href:{selector:'a[aria-label^="Learn more about"]',attribute:'href'}}}},controls:[next]},
  id:u=>u.pathname.match(/\/jobs\/results\/(\d+)-/)?.[1],
  detailReady:'main .BDNOWe',detailSpec:{fields:{title:'main h2.p1N2lc',jd:'main .DkhPwc'}}});
}
