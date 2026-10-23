export const manifest = {"id": "bytedance", "kind": "site", "version": "1.0.1", "protocol_version": 1, "entry": "adapter.mjs", "company": "字节跳动", "domains": ["jobs.bytedance.com"], "entry_url": "https://jobs.bytedance.com/experienced/position", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "path_prefix": "/experienced/position"};
import {createDOMSite} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
  const cards='a[href^="/experienced/position/"][href$="/detail"]',pages='li.atsx-pagination-item';
  return createDOMSite(port,{manifest,pages,
    searchURL:q=>manifest.entry_url+'?keywords='+encodeURIComponent(q.keyword || ''),
    listSpec:{lists:{jobs:{selector:cards,fields:{title:'.positionItem-title-text',location:'.positionItem-subTitle > span:first-child'}},pages:{selector:pages}},controls:[pages]},
    detailReady:'.jobDetail .block-content',
    detailSpec:{fields:{title:'.job-title',location:'.job-info > span:first-child'},lists:{headings:{selector:'.jobDetail .block-title'},blocks:{selector:'.jobDetail .block-content'}}},
    id:u=>u.pathname.match(/^\/experienced\/position\/(\d+)\/detail$/)?.[1],
    parse:d=>({title:d.fields.title,location:d.fields.location,jd:d.lists.blocks.map((b,i)=>(d.lists.headings[i]?.text || '')+'\n'+b.text).join('\n\n'),complete:d.lists.headings.length===d.lists.blocks.length && d.lists.headings.some((h,i)=>h.text==='职位描述'&&d.lists.blocks[i]?.text) && d.lists.headings.some((h,i)=>h.text==='职位要求'&&d.lists.blocks[i]?.text)})});
}
