export const manifest = {"id": "xiaohongshu-campus", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "小红书", "domains": ["job.xiaohongshu.com"], "entry_url": "https://job.xiaohongshu.com/campus/position", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "path_prefix": "/campus/position"};
import {createDOMSite,pairedSections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
 const cards='a[href^="/campus/position/"]',pages='li.ant-pagination-item';
 return createDOMSite(port,{manifest,pages,
  searchURL:q=>manifest.entry_url+'?positionName='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:cards,fields:{title:'.text-h4',location:'.text-description > span:nth-of-type(2)'}},pages:{selector:pages}},controls:[pages]},
  detailReady:'.p-7 > .text-paragraph',
  detailSpec:{fields:{title:'.text-h2',meta:'.p-7 .items-center.text-description'},lists:{headings:{selector:'.p-7 > .text-title'},blocks:{selector:'.p-7 > .text-paragraph'}}},
  id:u=>u.pathname.match(/^\/campus\/position\/(\d+)$/)?.[1],parse:d=>{const parsed=pairedSections(d);return {...parsed,jd:[d.fields.meta,parsed.jd].filter(Boolean).join("\n\n")};}});
}
