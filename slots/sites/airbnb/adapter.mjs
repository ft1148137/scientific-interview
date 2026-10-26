export const manifest = {"id": "airbnb", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["careers.airbnb.com"], "entry_url": "https://careers.airbnb.com/positions/", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Airbnb", "path_prefix": "/positions"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const next='a.facetwp-page.next';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?_search_input='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:'ul.job-list > li',fields:{title:'a[href*="/positions/"]',href:{selector:'a[href*="/positions/"]',attribute:'href'},location:'.text-right'}}},controls:[next]},
  id:u=>u.pathname.match(/^\/positions\/(\d+)\/?$/)?.[1],
  detailReady:'#job-detail-panel',detailSpec:{fields:{title:'.job-page-banner h1',jd:'#job-detail-panel'}}});
}
