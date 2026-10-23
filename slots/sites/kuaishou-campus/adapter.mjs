export const manifest = {"id": "kuaishou-campus", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "快手", "domains": ["campus.kuaishou.cn"], "entry_url": "https://campus.kuaishou.cn/recruit/campus/e/#/campus/jobs?recruitSubProjectCodes=20271779425607", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "path_prefix": "/recruit/campus/e"};
import {createDOMSite,sections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
  const cards='.job-list > .item',pages='li.ant-pagination-item';
  return createDOMSite(port,{manifest,pages,cardClick:cards,
    searchURL:()=>manifest.entry_url,
    search:{input:'input[placeholder="搜索职位"]',button:'button.ant-input-search-button'},
    listSpec:{lists:{jobs:{selector:cards,fields:{title:{selector:'.name[title]',attribute:'title'},location:'.work-location'}},pages:{selector:pages}},controls:[cards,pages]},
    detailReady:'.job-info-container .description .value',
    detailSpec:{fields:{title:'.job-info-container .base-info .title',meta:'.job-info-container .base-info .label',location:'.base-info .label-item:nth-child(5)'},lists:{sections:{selector:'.job-info-container .description .item',fields:{heading:'.title'}}}},
    id:u=>u.hash.match(/^#\/campus\/job-info\/(\d+)\/?(?:\?|$)/)?.[1],
    parse:d=>{const parsed=sections(d);return {...parsed,location:d.fields.location,jd:[d.fields.meta,parsed.jd].filter(Boolean).join('\n\n')};}});
}
