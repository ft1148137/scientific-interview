import {createDOMSite} from './dom-site.mjs';
// Only classify full descriptions when both duties and requirements have bodies.
export function completeMokaJD(text = '') {
  const heading = names => new RegExp('(?:^|\\n)[ \t]*(?:【|\\[)?(?:' + names + ')(?:】|\\])?[：:]?[ \t]*\\n\\s*\\S', 'i').test(text);
  return text.length > 60 && heading('岗位职责|职位描述|工作职责|你会亲手打造|你将参与构建|Responsibilities|What you.will do') && heading('任职要求|岗位要求|职位要求|任职资格|我们在找谁|以下满足其一即可|Qualifications|Requirements');
}
export function createMokaSite(port, manifest, {jobInfo=false}={}) {
  const cards='[class*="jobs-"] a[href*="#/job/"]',next='button[class*="Pagination-forward"]';
  return createDOMSite(port,{manifest,next,hashJobs:true,
    searchURL:q=>manifest.entry_url+'?keyword='+encodeURIComponent(q.keyword || '')+'&page=1&anchorName=jobsList',
    listSpec:{lists:{jobs:{selector:cards,fields:{title:'span[class*="title-"]',meta:'[class*="info-"]'}}},controls:[next]},
    // Campus cards may omit location: the last segment can be a function or job type.
    location:card=>jobInfo ? null : [...new Set((card.meta || '').split('|').at(-1).split('\n').map(s=>s.trim()).filter(Boolean))].join('、') || null,
    detailReady:'[class*="job-description-"]',
    detailSpec:{fields:{title:'[class*="title-ROU"]',jd:'[class*="job-description-"]'},...(jobInfo?{lists:{info:{selector:'[class*="info-row-"]',fields:{label:'.no-adaptive-tooltip',value:'[class*="value-"] [id="clamp-container"]'}}}}:{})},
    id:u=>u.hash.match(/^#\/job\/([\w-]+)(?:\?|$)/)?.[1],
    parse:d=>{
      const info=(d.lists?.info || []).filter(r=>!r.clipped && ['职位性质','职能类型','工作地点'].includes(r.label) && r.value && r.value!=='-');
      const raw=d.fields.jd || '';
      const checkedJD=jobInfo?raw.replace(/^#{1,6}[ \t]+/gm,'').replace(/^(\s*(?:【|\[)?)(?:核心职责|岗位描述)((?:】|\])?[：:]?\s*)$/gm,'$1岗位职责$2'):raw;
      return {title:d.fields.title,jd:jobInfo?[...info.map(r=>`${r.label}：${r.value}`),raw].filter(Boolean).join('\n\n'):d.fields.jd,
        location:jobInfo?info.find(r=>r.label==='工作地点')?.value || null:undefined,complete:completeMokaJD(checkedJD)};
    }});
}
