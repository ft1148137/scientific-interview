export const manifest = {"id": "apple", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["jobs.apple.com"], "entry_url": "https://jobs.apple.com/en-us/search", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Apple", "path_prefix": "/en-us"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const next='button[aria-label="Next Page"]';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?search='+encodeURIComponent(q.keyword || '')+'&sort=relevance&location=united-states-USA',
  listSpec:{lists:{jobs:{selector:'.job-title-link',fields:{title:'h3 a',href:{selector:'h3 a',attribute:'href'}}}},controls:[next]},
  id:u=>u.pathname.match(/^\/en-us\/details\/([\d-]+)\//)?.[1],
  detailReady:'#jobdetails-jobdescription',detailSpec:{fields:{title:'main h1'},lists:{sections:{selector:'main div[id^="jobdetails-"]:has(> aside)'}}}});
}
