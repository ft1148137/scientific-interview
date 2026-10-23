export const manifest = {"id": "didi", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "滴滴", "domains": ["talent.didiglobal.com"], "entry_url": "https://talent.didiglobal.com/social?page=1&size=10", "requires": ["navigate", "observe", "click", "wait", "fill"], "search_fields": ["keyword"]};
import {createDOMSite,pairedSections} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
 const cards='ul.loom-list-items > div',pages='li.loom-pagination-item';
 return createDOMSite(port,{manifest,pages,cardClick:cards,
  searchURL:()=>manifest.entry_url,
  search:{input:'input[placeholder="搜索职位名称/编号"]',button:'button.loom-input-search-button'},
  listSpec:{lists:{jobs:{selector:cards,fields:{title:'div.break-all > span',location:'.min-w-0 > div:nth-child(2) > span:nth-child(3) > span'}},pages:{selector:pages}},controls:[cards,pages]},
  detailReady:'.border-t > .whitespace-break-spaces',
  detailSpec:{fields:{title:'h1'},lists:{headings:{selector:'.border-t > .font-medium'},blocks:{selector:'.border-t > .whitespace-break-spaces'}}},
  id:u=>u.pathname==='/social/jobDetail'?u.searchParams.get('jdId'):null,
  parse:d=>({...pairedSections(d),title:d.fields.title?.replace(/\s*\(\s*JR[\w]+\s*\)\s*$/, '').trim()})});
}
