export const manifest = {"id": "jd-campus", "kind": "site", "version": "1.0.1", "protocol_version": 1, "entry": "adapter.mjs", "company": "京东", "domains": ["campus.jd.com"], "entry_url": "https://campus.jd.com/home#/jobs", "requires": ["navigate", "observe", "click", "wait", "fill"], "search_fields": ["keyword"]};
import {createDOMSite,pairedSections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
  const cards='div[class^="item___"]',pages='li.ant-pagination-item';
  return createDOMSite(port,{manifest,pages,cardClick:cards,
    searchURL:()=>manifest.entry_url,
    search:{input:'[class^="searchBox___"] input[placeholder="搜索职位或关键词"]',waitForChange:true},
    listSpec:{lists:{jobs:{selector:cards,fields:{title:':scope > div:first-child > span:first-child'}},pages:{selector:pages}},controls:[cards,pages]},
    detailReady:'[class^="contentBox___"]',
    detailSpec:{fields:{title:'[class^="positionTop___"] > p:first-child > span:first-child',meta:'[class^="positionTop___"] > p:nth-child(2)',location:'p[class^="itemContent___"]'},lists:{headings:{selector:'p[class^="itemTitle___"]'},blocks:{selector:'p[class^="itemContent___"],div[class^="contentBox___"]'}}},
    id:u=>/^#\/details\?/.test(u.hash) && /^\d+$/.test(new URLSearchParams(u.hash.split('?')[1]).get('id') || '') ? new URLSearchParams(u.hash.split('?')[1]).get('id') : null,
    parse:d=>{const mapped={...d,lists:{...d.lists,headings:d.lists.headings.map(h=>({...h,text:h.text==='工作内容'?'岗位职责':h.text}))}};const parsed=pairedSections(mapped);return {...parsed,location:d.fields.location,jd:[d.fields.meta,parsed.jd].filter(Boolean).join('\n\n')};}});
}
