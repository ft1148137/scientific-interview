export const manifest = {"id": "tencent-campus", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "腾讯", "domains": ["join.qq.com"], "entry_url": "https://join.qq.com/post.html?query=p_1", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"]};
import {createDOMSite} from '../shared/dom-site.mjs';
export function createSiteSlot(port) {
  const cards='.post_list > .post_box',pages='.el-pager > li.number';
  return createDOMSite(port,{manifest,pages,cardClick:cards,
    searchURL:()=>manifest.entry_url,
    search:{input:'input[placeholder="搜索工作岗位"]',button:'.search_text'},
    listSpec:{lists:{jobs:{selector:cards,fields:{title:'.post_title',location:'.site'}},pages:{selector:pages}},controls:[cards,pages]},
    detailReady:'.detail_box .detail_text',
    detailSpec:{fields:{title:'.bannerItemText',meta:'.bannerTipLeft .bannerItem:not(.bannerItemText)'},lists:{sections:{selector:'.detail_box',fields:{heading:'.subtitle',body:'.text_box'}}}},
    id:u=>u.pathname==='/post_detail.html' && /^\d+$/.test(u.searchParams.get('postid') || '') ? u.searchParams.get('postid') : null,
    parse:d=>({title:d.fields.title,jd:[d.fields.meta,...d.lists.sections.map(b=>b.text)].filter(Boolean).join('\n\n'),complete:['岗位描述','岗位要求'].every(heading=>d.lists.sections.some(b=>b.heading===heading && b.body?.trim()))})});
}
