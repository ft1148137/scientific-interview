export const manifest = {"id": "amap", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "高德", "domains": ["talent.amap.com"], "entry_url": "https://talent.amap.com/off-campus/position-list", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"]};
import {createDOMSite, sections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
  const cards='.lDOITgXtGWpYKcIGbvzvn > ._2AOmjKmlEtuR_KEoehWYcN',next='button.next-pagination-item.next-next';
  return createDOMSite(port,{manifest,next,cardClick:cards,
    searchURL:q=>manifest.entry_url+'?lang=zh&search='+encodeURIComponent(q.keyword || ''),
    listSpec:{lists:{jobs:{selector:cards,fields:{title:'._1RRlPtjyYmeDGCWt9lrk2P',location:'._3CJNtKfv5mLnNfeqL1jgRB'}}},controls:[cards,next]},
    detailReady:'#positionDetailBlock .content-block',
    detailSpec:{fields:{title:'.bXVhSIL-ovT-82dSXA2yw'},lists:{sections:{selector:'#positionDetailBlock .content-block',fields:{heading:'.card-header'}}}},
    id:u=>u.pathname==='/off-campus/position-detail'?u.searchParams.get('positionId'):null,parse:sections});
}
