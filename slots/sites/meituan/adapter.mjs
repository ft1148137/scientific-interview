export const manifest = {"id": "meituan", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "美团", "domains": ["zhaopin.meituan.com"], "entry_url": "https://zhaopin.meituan.com/web/position", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"]};
import {createDOMSite, sections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
  const cards='.position_list_item_content_left',pages='li.mtd-pagination-item';
  return createDOMSite(port,{manifest,pages,cardClick:cards,
    searchURL:q=>manifest.entry_url+'?keyword='+encodeURIComponent(q.keyword || ''),
    listSpec:{lists:{jobs:{selector:cards,fields:{title:'.postion_name .title',location:'.city'}},pages:{selector:pages}},controls:[cards,pages]},
    detailReady:'.positin_detail_info_item .desc',
    detailSpec:{fields:{title:'.postion_name .title'},lists:{sections:{selector:'.positin_detail_info_item',fields:{heading:'.title'}}}},
    id:u=>u.pathname==='/web/position/detail'?u.searchParams.get('jobUnionId'):null,parse:sections});
}
