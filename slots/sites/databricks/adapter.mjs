export const manifest = {"id": "databricks", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["www.databricks.com"], "entry_url": "https://www.databricks.com/company/careers/open-positions", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "visible-title", "company": "Databricks", "path_prefix": "/company/careers"};
import {createInternationalSite} from '../shared/international.mjs';
export function createSiteSlot(port) {
 return createInternationalSite(port,{manifest,searchURL:()=>manifest.entry_url,
  listSpec:{lists:{jobs:{selector:'a[aria-label]:not([aria-label^="Jump to"])[href^="/company/careers/"]:has(> span:nth-child(2))',fields:{title:'span:first-child',location:'span:nth-child(2)'}}}},
  id:u=>u.pathname.match(/^\/company\/careers\/[^/]+\/[^/]*-(\d+)\/?$/)?.[1],
  detailReady:'.rich-text-body',detailSpec:{fields:{title:'h1',jd:'main .rich-text-body'}}});
}
