export const manifest = {"id": "indeed", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["www.indeed.com"], "entry_url": "https://www.indeed.com/jobs", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const next='a[data-testid="pagination-page-next"]';
 const id=u=>['/rc/clk','/viewjob'].includes(u.pathname) && /^[a-f0-9]{16}$/.test(u.searchParams.get('jk') || '') ? u.searchParams.get('jk') : null;
 return createInternationalSite(port,{manifest,next,id,
  refURL:card=>/^(job|sj)_[a-f0-9]{16}$/.test(card.external_id || '') ? 'https://www.indeed.com/viewjob?jk='+card.external_id.replace(/^(job|sj)_/,'') : null,
  canonical:u=>'https://www.indeed.com/viewjob?jk='+id(u),
  searchURL:q=>manifest.entry_url+'?q='+encodeURIComponent(q.keyword || '')+'&l=',
  listSpec:{lists:{jobs:{selector:'td.resultContent:has(a.jcs-JobTitle)',fields:{external_id:{selector:'a.jcs-JobTitle',attribute:'id'},title:'a.jcs-JobTitle span[title]',company:'[data-testid="company-name"]',location:'[data-testid="text-location"]',href:{selector:'a.jcs-JobTitle',attribute:'href'}}}},controls:[next]},
  detailReady:'.simple-job-description-html',detailSpec:{fields:{title:'[data-testid="vj-job-title"]',company:'[data-testid="company-info-metadata"] a[href*="/cmp/"]',jd:'.simple-job-description-html'}}});
}
