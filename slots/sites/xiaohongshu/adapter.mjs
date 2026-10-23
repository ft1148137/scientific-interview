export const manifest = {"id": "xiaohongshu", "kind": "site", "version": "1.0.1", "protocol_version": 1, "entry": "adapter.mjs", "company": "小红书", "domains": ["job.xiaohongshu.com"], "entry_url": "https://job.xiaohongshu.com/social/position", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "path_prefix": "/social/position"};
import {createDOMSite,pairedSections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
 const cards='a[href^="/social/position/"]',pages='li.ant-pagination-item';
 return createDOMSite(port,{manifest,pages,
  searchURL:q=>manifest.entry_url+'?positionName='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:cards,fields:{title:'.text-h4',location:'.text-description > span:last-of-type'}},pages:{selector:pages}},controls:[pages]},
  detailReady:'.p-7 > .text-paragraph',
  detailSpec:{fields:{title:'.text-h2'},lists:{headings:{selector:'.p-7 > .text-title'},blocks:{selector:'.p-7 > .text-paragraph'}}},
  id:u=>u.pathname.match(/^\/social\/position\/(\d+)$/)?.[1],parse:pairedSections});
}
