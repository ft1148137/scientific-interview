import {gate, pageGate} from '../../protocol.mjs';
export const manifest = {id:'tencent',kind:'site',version:'1.0.0',protocol_version:1,domains:['careers.tencent.com'],entry_url:'https://careers.tencent.com/search.html',requires:['navigate','observe','click','wait'],search_fields:['keyword']};
const listSpec = {lists:{jobs:{selector:'.recruit-list-link',fields:{title:'.job-recruit-title',location:'.job-recruit-location'}},pages:{selector:'.page-li'}},controls:['.recruit-list-link','.page-li']};
const detailSpec = {fields:{title:'.jobdesc-content .job-recruit-title',location:'.jobdesc-content .job-recruit-location',duty:'.duty .duty-text',requirements:'.requirement .duty-text'},lists:{sections:{selector:'.work-module',fields:{heading:'.duty-title',body:'.duty-text'}}}};
export function createSiteSlot(port) {
  async function probe(observation) { return pageGate(observation || await port.observe()); }
  async function list(query, page = 1) {
    let result = await port.navigate(manifest.entry_url + '?keyword=' + encodeURIComponent(query.keyword || '') + '&query=at_1');
    let checked = await probe(result); if (checked.gate!=='PASS') return checked;
    result = await port.wait({selector:'.recruit-list-link',observe:listSpec});
    if (result.gate!=='PASS') return result;
    // Replay pagination from stable search URL. A stored DOM handle is never a checkpoint.
    for (let n=2;n<=page;n++) {
      const previousText=result.data.lists.jobs[0]?.text;
      result = await port.act({kind:'click',selector:'.page-li',text:String(n),snapshot_id:result.data.snapshot_id});
      checked = await probe(result); if (checked.gate!=='PASS') return checked;
      result = await port.wait({selector:'.recruit-list-link',previousText,observe:listSpec});
      if (result.gate!=='PASS') return result;
    }
    return result;
  }
  return {
    manifest,probe,
    async discover(query, cursor = null) {
      const page = cursor?.page || 1;
      const result = await list(query,page);
      if(result.gate!=='PASS') return result;
      const data = result.data;
      if (!data.lists.jobs.length) return gate('REJECT','LAYOUT_CHANGED','未识别到岗位卡片，不将空页面当作已下线。');
      const maxPage = Math.max(1,...data.lists.pages.map(x=>Number(x.text)).filter(Number.isFinite));
      return gate('PASS','DISCOVERED','',{data:{refs:data.lists.jobs.map(j=>({title:j.title,location:j.location,index:j.index,list_url:data.url,page,query})),next_cursor:page<maxPage?{page:page+1}:null,coverage:page>=maxPage?'complete':'partial'}});
    },
    async readJob(ref) {
      let result;
      if (ref.url) result = await port.navigate(ref.url);
      else {
        result = await list(ref.query,ref.page);
        if(result.gate!=='PASS') return result;
        const card = result.data.lists.jobs[ref.index];
        if (!card || card.title!==ref.title || card.location!==ref.location) return gate('REJECT','LIST_CHANGED','列表顺序变化，重新发现岗位。');
        result = await port.act({kind:'click',selector:'.recruit-list-link',index:ref.index,snapshot_id:result.data.snapshot_id});
      }
      let checked = await probe(result); if(checked.gate!=='PASS') return checked;
      const closed = result.data?.text.match(/该职位已下线|该岗位已下线|该职位已停止招聘|该岗位已停止招聘/);
      if (closed && ref.title) {
        const at=result.data.observed_at,url=result.data.url;
        return gate('PASS','CLOSED','',{data:{external_id:new URL(url).searchParams.get('postId'),url,title:ref.title,company:'腾讯',location:ref.location||null,jd:null,jd_complete:false,status:'closed',closed_reason:closed[0],observed_at:at,evidence:{url,observed_at:at,text:closed[0],kind:'closed'}}});
      }
      result = await port.wait({selector:'.jobdesc-content .job-recruit-title',observe:detailSpec});
      if(result.gate!=='PASS') return result;
      const d=result.data, id=new URL(d.url).searchParams.get('postId');
      if(!id || !d.fields.title) return gate('REJECT','LAYOUT_CHANGED');
      const jd=d.lists.sections.filter(x=>x.heading&&x.body).map(x=>x.heading+'\n'+x.body).join('\n\n');
      return gate('PASS','JOB_READ','',{data:{external_id:id,title:d.fields.title,company:'腾讯',url:d.url,location:d.fields.location,jd:jd||null,jd_complete:!!(d.fields.duty&&d.fields.requirements),status:jd?'open':'unknown',observed_at:d.observed_at,evidence:{url:d.url,observed_at:d.observed_at,text:d.fields.title+'\n'+jd,kind:'page'}}});
    }
  };
}
