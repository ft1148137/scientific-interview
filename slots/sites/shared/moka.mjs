import {createDOMSite} from './dom-site.mjs';
// Only classify full descriptions when both duties and requirements have bodies.
export function completeMokaJD(text = '') {
  const heading = names => new RegExp('(?:^|\\n)[ \t]*(?:【|\\[)?(?:' + names + ')(?:】|\\])?[：:]?[ \t]*\\n\\s*\\S', 'i').test(text);
  return text.length > 60 && heading('岗位职责|职位描述|工作职责|你会亲手打造|你将参与构建|Responsibilities|What you.will do') && heading('任职要求|岗位要求|职位要求|任职资格|我们在找谁|以下满足其一即可|Qualifications|Requirements');
}
export function createMokaSite(port, manifest) {
  const cards='[class*="jobs-"] a[href*="#/job/"]',next='button[class*="Pagination-forward"]';
  return createDOMSite(port,{manifest,next,hashJobs:true,
    searchURL:q=>manifest.entry_url+'?keyword='+encodeURIComponent(q.keyword || '')+'&page=1&anchorName=jobsList',
    listSpec:{lists:{jobs:{selector:cards,fields:{title:'span[class*="title-"]',meta:'[class*="info-"]'}}},controls:[next]},
    location:card=>[...new Set((card.meta || '').split('|').at(-1).split('\n').map(s=>s.trim()).filter(Boolean))].join('、') || null,
    detailReady:'[class*="job-description-"]',
    detailSpec:{fields:{title:'[class*="title-ROU"]',jd:'[class*="job-description-"]'}},
    id:u=>u.hash.match(/^#\/job\/([\w-]+)(?:\?|$)/)?.[1],
    parse:d=>({title:d.fields.title,jd:d.fields.jd,complete:completeMokaJD(d.fields.jd || '')})});
}
