export const manifest = {"id": "linkedin", "kind": "site", "version": "1.1.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["www.linkedin.com", "sg.linkedin.com", "kr.linkedin.com", "id.linkedin.com", "ae.linkedin.com", "in.linkedin.com", "uk.linkedin.com", "cn.linkedin.com", "au.linkedin.com", "ie.linkedin.com", "ca.linkedin.com"], "entry_url": "https://www.linkedin.com/jobs/search/", "requires": ["navigate", "observe", "click", "wait", "fill"], "search_fields": ["keyword", "city"], "keyword_mode": "native", "path_prefix": "/jobs"};
import {createSignedInSite} from './signed-in.mjs';
import {gate} from '../../protocol.mjs';
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const site = createInternationalSite(port,{manifest,canonical:u=>'https://www.linkedin.com/jobs/view/'+u.pathname.match(/(?:^|[-/])(\d+)\/?$/)?.[1],searchURL:q=>manifest.entry_url+'?keywords='+encodeURIComponent(q.keyword || '')+'&location='+encodeURIComponent(q.city?.trim() || 'Worldwide'),
  listSpec:{lists:{jobs:{selector:'.jobs-search__results-list .base-search-card',fields:{title:'.base-search-card__title',company:'.base-search-card__subtitle',location:'.job-search-card__location',href:{selector:'.base-card__full-link',attribute:'href'}}}}},
  id:u=>u.pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1],
  detailReady:'.description__text',detailSpec:{fields:{title:'h1.top-card-layout__title',company:'.topcard__org-name-link',location:'.topcard__flavor--bullet',jd:'.description__text'}}});
 return createSignedInSite(port, manifest, {...site, async discover(query = {}, cursor = null) {
  if (query.city !== undefined && typeof query.city !== 'string') return gate('REJECT','UNSUPPORTED_QUERY','city 必须是国家、地区或城市文本。');
  return site.discover(query, cursor);
 }});
}
