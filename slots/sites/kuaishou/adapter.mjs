export const manifest = {"id": "kuaishou", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "快手", "domains": ["zhaopin.kuaishou.cn"], "entry_url": "https://zhaopin.kuaishou.cn/#/official/social/", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"]};
import {createDOMSite,sections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
 const cards='tbody tr.ant-table-row',pages='li.ant-pagination-item';
 return createDOMSite(port,{manifest,pages,cardClick:cards,
  searchURL:q=>manifest.entry_url+'?workLocationCode=domestic&name='+encodeURIComponent(q.keyword || '')+'&pageNum=1',
  listSpec:{lists:{jobs:{selector:cards,fields:{title:'td:first-child',location:'td:nth-child(3)'}},pages:{selector:pages}},controls:[cards,pages]},
  detailReady:'.job-info-des-item-value',
  detailSpec:{fields:{title:'.job-info-header-title-name'},lists:{sections:{selector:'.job-info-des-item',fields:{heading:'.job-info-des-item-name'}}}},
  id:u=>u.hash.match(/^#\/official\/social\/job-info\/(\d+)\/?(?:\?|$)/)?.[1],parse:sections});
}
