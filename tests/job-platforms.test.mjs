import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOMSite} from '../slots/sites/shared/dom-site.mjs';
import {gate} from '../slots/protocol.mjs';

// Synthetic multi-employer portal: platform identity is not an employer name.
function fixture({company='合成企业甲',fixedCompany,closed=false}={}) {
  let url='https://jobs.example.com/search';
  const detail='https://jobs.example.com/job/123';
  const observation=(spec={})=>gate('PASS','OBSERVED','',{data:{url,
    text:closed?'该职位已下线':'合成岗位页面',observed_at:'2026-10-23T00:00:00Z',snapshot_id:1,
    fields:{title:'合成工程师',company,jd:'岗位职责\n合成职责\n任职要求\n合成要求'},
    lists:spec.lists?.jobs?{jobs:[{index:0,title:'合成工程师',company:'合成企业甲',text:'合成卡片',href:detail}]}:{},controls:{}}});
  const port={navigate:async target=>{url=target;return observation();},wait:async spec=>observation(spec.observe)};
  const manifest={id:'synthetic-platform',domains:['jobs.example.com'],search_fields:['keyword'],...(fixedCompany?{company:fixedCompany}:{})};
  const site=createDOMSite(port,{manifest,searchURL:()=>url,listSpec:{lists:{jobs:{selector:'.job'}}},detailSpec:{fields:{}},detailReady:'.jd',id:u=>u.pathname.match(/^\/job\/(\d+)$/)?.[1],parse:d=>({...d.fields,complete:true})});
  return {site,detail};
}
test('platform records use the employer from the detail and include it in evidence',async()=>{
  const f=fixture();const ref=(await f.site.discover({})).data.refs[0];
  assert.equal(ref.company,'合成企业甲');
  const result=await f.site.readJob(ref);assert.equal(result.gate,'PASS');
  assert.equal(result.data.company,'合成企业甲');assert.match(result.data.evidence.text,/合成企业甲/);
});
test('missing or mismatched employers reject records instead of guessing',async()=>{
  for(const company of ['', '   ', '合成企业乙']){
    const f=fixture({company});const ref=(await f.site.discover({})).data.refs[0];
    const result=await f.site.readJob(ref);
    assert.equal(result.code,company.trim()?'IDENTITY_CHANGED':'COMPANY_MISSING');
  }
});
test('closed platform jobs need employer identity; fixed-company adapters remain compatible',async()=>{
  const f=fixture({closed:true});
  assert.equal((await f.site.readJob({url:f.detail,title:'合成工程师'})).code,'COMPANY_MISSING');
  const result=await f.site.readJob({url:f.detail,title:'合成工程师',company:'合成企业甲'});
  assert.equal(result.data.status,'closed');assert.equal(result.data.company,'合成企业甲');
  const fixed=fixture({company:'',fixedCompany:'合成官网企业'});
  assert.equal((await fixed.site.readJob({url:fixed.detail})).data.company,'合成官网企业');
});
