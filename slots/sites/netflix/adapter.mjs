export const manifest = {"id": "netflix", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["explore.jobs.netflix.net"], "entry_url": "https://explore.jobs.netflix.net/careers", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Netflix", "path_prefix": "/careers"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const cards='[data-test-id^="position-card-"]';
 return createInternationalSite(port,{manifest,reloadDetail:true,cardClick:cards,searchURL:q=>manifest.entry_url+'?query='+encodeURIComponent(q.keyword || '')+'&sort_by=relevance',
  listSpec:{lists:{jobs:{selector:cards,fields:{title:'.position-title',location:'.position-location'}}},controls:[cards]},
  id:u=>u.pathname==='/careers' && /^\d+$/.test(u.searchParams.get('pid') || '') ? u.searchParams.get('pid') : null,
  canonical:u=>manifest.entry_url+'?pid='+u.searchParams.get('pid'),
  detailReady:'.position-job-description',detailSpec:{fields:{title:'h1.position-title',jd:'.position-job-description'}}});
}
