import {gate, pageGate} from '../../protocol.mjs';
export const manifest={id:'demo-company',kind:'site',version:'1.0.0',protocol_version:1,domains:['jobs.example.com','127.0.0.1'],entry_url:'https://jobs.example.com/',requires:['navigate','observe'],search_fields:[],fixture_only:true};
export function createSiteSlot(port,{entryURL=manifest.entry_url}={}) {
  return {manifest, probe:pageGate,
    async discover(query,cursor) {
      const r=await port.navigate(cursor?.url||entryURL); if(r.gate!=='PASS') return r;
      const o=await port.observe({lists:{jobs:{selector:'a.job',fields:{title:'.title'}}}});
      const check=pageGate(o);if(check.gate!=='PASS')return check;
      return gate('PASS','DISCOVERED','',{data:{refs:o.data.lists.jobs.map(j=>({url:new URL(j.href,o.data.url).href,title:j.title})),next_cursor:null,coverage:'complete'}});
    },
    async readJob(ref) {
      const r=await port.navigate(ref.url);if(r.gate!=='PASS')return r;
      const o=await port.observe({fields:{title:'h1',company:'.company',location:'.location',jd:'.jd'}});
      const check=pageGate(o);if(check.gate!=='PASS')return check;
      const d=o.data; return gate('PASS','JOB_READ','',{data:{...d.fields,url:d.url,external_id:new URL(d.url).pathname,observed_at:d.observed_at,jd_complete:!!d.fields.jd,status:'open',evidence:{url:d.url,observed_at:d.observed_at,text:d.text,kind:'page'}}});
    }};
}
