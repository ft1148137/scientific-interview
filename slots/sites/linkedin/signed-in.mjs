import {assertURL, gate, pageGate} from '../../protocol.mjs';
import {completeEnglishJD} from '../shared/international.mjs';

const cards = '[componentkey^="job-card-component-ref-"]';
const header = '[componentkey="searchResultsHeaderComponent"]';
const locationButton = header + ' [role="button"]:has(svg[id="location-marker-small"])';
const editor = '[componentkey="LocationTypeahead_TextEditor"]';
const clear = 'div:has([componentkey="LocationTypeahead_TextEditor"]) + div > button:has(svg[id="clear-small"])';
const suggestions = '[componentkey="semanticSearchBoxLocationList"] a';
const next = '[data-testid="pagination-controls-next-button-visible"]';
const jdRoot = '[componentkey^="JobDetails_AboutTheJob_"]';
const expand = jdRoot + ' [data-testid="expandable-text-button"]';
const norm = value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
// A localized country label is equivalent; a state or same-named city is not.
const usNames = ['United States', 'United States of America', 'USA', 'US', '美国', 'Vereinigte Staaten von Amerika'];
export const sameRegion = (a, b) => norm(a) === norm(b) || usNames.some(x => norm(x) === norm(a)) && usNames.some(x => norm(x) === norm(b));
const locationInput = city => usNames.some(x => norm(x) === norm(city)) ? 'United States' : city;
const listSpec = {
  fields: {region: locationButton + ' p', keyword:{selector:'input[componentkey="semanticSearchBox"]',attribute:'value'}, page:'[data-testid^="pagination-indicator-"][aria-current="true"]'},
  lists: {jobs: {selector:cards, fields: {
    external_id:{selector:':scope',attribute:'componentkey'},
    title:'p > span[aria-hidden="true"]', plain_title:{selector:'p',index:0},
    company:{selector:'p',index:1}, location:{selector:'p',index:2}
  }}}, controls:[locationButton,next]
};
const detailSpec = {fields:{title:{selector:'main section[aria-label] p',index:1}, company:'main section[aria-label] a[href*="/company/"] p', location:{selector:'main section[aria-label] p',index:2}, jd:jdRoot+' [data-testid="expandable-text-box"]', body_id:{selector:jdRoot,attribute:'id'}},controls:[expand]};
const canonical = id => 'https://www.linkedin.com/jobs/view/' + id;
const jobId = url => new URL(url).pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1];

export function createSignedInSite(port, manifest, anonymous) {
  function checked(r) {
    if (r.gate !== 'PASS') return r;
    let u;
    try { u = new URL(assertURL(r.data.url, manifest.domains)); }
    catch { return gate('REJECT','SITE_SCOPE_REJECTED'); }
    if (/^\/(?:login|checkpoint|uas\/login)(?:\/|$)/.test(u.pathname)) return gate('WAIT_USER','LOGIN_OR_CHALLENGE','请在浏览器完成 LinkedIn 登录或验证。');
    const verdict = pageGate(r);
    if (verdict.gate !== 'PASS') return verdict;
    return /^\/jobs(?:\/|$)/.test(u.pathname) ? r : gate('REJECT','SITE_SCOPE_REJECTED');
  }
  const observe = spec => port.observe(spec).then(checked);
  async function wait(selector,spec,previousText) {
    const r=checked(await port.wait({selector,observe:spec,...(previousText?{previousText}:{})}));
    if(r.gate!=='RETRY' || r.code!=='BROWSER_ERROR')return r;
    // A re-render can detach the waited element even though its replacement is ready.
    const fresh=await observe({...spec,controls:[...new Set([...(spec.controls || []),selector])]});
    if(fresh.gate!=='PASS')return fresh;
    const visible=(fresh.data.controls[selector] || []).find(x=>x.visible!==false);
    return visible && (!previousText || visible.text!==previousText) ? fresh : r;
  }
  const act = (r,selector,extra={}) => port.act({kind:'click',selector,snapshot_id:r.data.snapshot_id,...extra}).then(checked);
  async function region(r, city) {
    if (sameRegion(r.data.fields.region,city)) return r;
    const before = r.data.lists.jobs[0]?.text;
    // This UI offers no verified global option. Do not silently use the account's city.
    if (['worldwide','全球','weltweit'].includes(norm(city))) return gate('REJECT','REGION_REQUIRED','已登录搜索需要明确国家/地区或城市；当前页面未提供可核验的全球选项。');
    r=await act(r,locationButton); if(r.gate!=='PASS')return r;
    r=await wait(editor,{controls:[editor,clear]});
    // LinkedIn can render a clickable header before attaching its event handler.
    if(r.gate==='RETRY' && r.code==='BROWSER_ERROR') {
      r=await observe({fields:{editor},controls:[locationButton]}); if(r.gate!=='PASS')return r;
      if(r.data.fields.editor===null){r=await act(r,locationButton);if(r.gate!=='PASS')return r;}
      r=await wait(editor,{controls:[editor,clear]});
    }
    if(r.gate!=='PASS')return r;
    const clearButtons=(r.data.controls[clear] || []).filter(x=>x.visible!==false);
    if(clearButtons.length!==1)return gate('REJECT','REGION_LAYOUT_CHANGED');
    r=await act(r,clear,{index:clearButtons[0].index}); if(r.gate!=='PASS')return r;
    r=await observe({controls:[editor],fields:{input:editor}}); if(r.gate!=='PASS')return r;
    if(r.data.fields.input?.trim())return gate('REJECT','REGION_INPUT_NOT_CLEARED');
    r=await act(r,editor,{kind:'fill',value:locationInput(city)}); if(r.gate!=='PASS')return r;
    const spec={fields:{input:editor},lists:{choices:{selector:suggestions}},controls:[suggestions]};
    r=await wait(suggestions,spec); if(r.gate!=='PASS')return r;
    if(norm(r.data.fields.input)!==norm(locationInput(city)))return gate('REJECT','REGION_INPUT_CHANGED');
    const choices=r.data.lists.choices.filter(x=>sameRegion(x.text,city));
    if(choices.length!==1)return gate('REJECT','REGION_NOT_RESOLVED','地点未唯一匹配，请使用页面候选项的完整名称：'+r.data.lists.choices.map(x=>x.text).join('；'),{choices:r.data.lists.choices.map(x=>x.text)});
    const choice=choices[0];
    let selected;
    try { selected=new URL(assertURL(choice.href,manifest.domains)); } catch {return gate('REJECT','SITE_SCOPE_REJECTED');}
    if(selected.pathname!=='/jobs/search-results/' || !/^\d+$/.test(selected.searchParams.get('geoId') || ''))return gate('REJECT','REGION_LINK_CHANGED');
    r=await act(r,suggestions,{index:choice.index}); if(r.gate!=='PASS')return r;
    r=await wait(cards,listSpec,before); if(r.gate!=='PASS')return r;
    if(r.data.lists.jobs[0]?.text===before || !sameRegion(r.data.fields.region,city) || new URL(r.data.url).searchParams.get('geoId')!==selected.searchParams.get('geoId'))return gate('RETRY','REGION_NOT_APPLIED','地区结果尚未更新。',{retryAfter:2});
    return r;
  }
  return {...anonymous,
    async discover(query={},cursor=null) {
      if(Object.keys(query).some(k=>!manifest.search_fields.includes(k)) || ['keyword','city'].some(k=>query[k]!==undefined && typeof query[k]!=='string'))return gate('REJECT','UNSUPPORTED_QUERY');
      const page=cursor?.page??1;
      if(!Number.isInteger(page)||page<1||page>1000)return gate('REJECT','INVALID_CURSOR');
      const city=query.city?.trim() || 'Worldwide';
      let r=checked(await port.navigate(manifest.entry_url+'?keywords='+encodeURIComponent(query.keyword || '')+'&location='+encodeURIComponent(city),{reload:true}));
      if(r.gate!=='PASS')return r;
      r=await wait(cards+', .jobs-search__results-list .base-search-card',listSpec); if(r.gate!=='PASS')return r;
      if(!new URL(r.data.url).pathname.startsWith('/jobs/search-results')) return anonymous.discover(query,cursor);
      if(!r.data.lists.jobs?.length)return gate('REJECT','LAYOUT_CHANGED','未找到已登录页面的岗位卡片。');
      r=await wait(locationButton+' p',listSpec); if(r.gate!=='PASS')return r;
      r=await wait('input[componentkey="semanticSearchBox"]',listSpec); if(r.gate!=='PASS')return r;
      r=await region(r,city); if(r.gate!=='PASS')return r;
      if(norm(r.data.fields.keyword)!==norm(query.keyword))return gate('REJECT','KEYWORD_NOT_APPLIED');
      if(Number(r.data.fields.page)!==1)return gate('RETRY','PAGE_NOT_RESET','搜索没有回到第一页。',{retryAfter:2});
      for(let n=2;n<=page;n++) {
        const before=r.data.lists.jobs[0]?.text;
        r=await act(r,next); if(r.gate!=='PASS')return r;
        r=await wait(cards,listSpec,before); if(r.gate!=='PASS')return r;
        if(Number(r.data.fields.page)!==n || r.data.lists.jobs[0]?.text===before)return gate('RETRY','PAGE_NOT_CHANGED','页码或列表尚未更新。',{retryAfter:2});
        if(!sameRegion(r.data.fields.region,city)||norm(r.data.fields.keyword)!==norm(query.keyword))return gate('REJECT','SEARCH_SCOPE_CHANGED');
      }
      const refs=[],seen=new Set();
      for(const card of r.data.lists.jobs) {
        const id=card.external_id?.match(/^job-card-component-ref-(\d+)$/)?.[1];
        const title=(card.title || card.plain_title || '').trim();
        if(!id||!title||!card.company)return gate('REJECT','LAYOUT_CHANGED','岗位 ID、标题或企业缺失。');
        if(seen.has(id))continue; seen.add(id);
        refs.push({external_id:id,url:canonical(id),title,company:card.company,location:card.location,layout:'signed-in'});
      }
      const canNext=(r.data.controls[next] || []).some(x=>x.visible!==false&&!x.disabled);
      return gate('PASS','DISCOVERED','',{data:{refs,next_cursor:canNext?{page:page+1}:null,coverage:'partial',search_evidence:{keyword:r.data.fields.keyword,region:r.data.fields.region,observed_at:r.data.observed_at}}});
    },
    async readJob(ref) {
      if(ref.layout!=='signed-in')return anonymous.readJob(ref);
      try {assertURL(ref.url,manifest.domains);if(!/^\d+$/.test(ref.external_id)||jobId(ref.url)!==ref.external_id)return gate('REJECT','IDENTITY_CHANGED');}catch{return gate('REJECT','SITE_SCOPE_REJECTED');}
      let r=checked(await port.navigate(ref.url)); if(r.gate!=='PASS')return r;
      r=await wait(jdRoot+' [data-testid="expandable-text-box"]',detailSpec); if(r.gate!=='PASS')return r;
      const button=r.data.controls[expand]?.find(x=>x.visible!==false&&!x.disabled);
      if(button){r=await act(r,expand,{index:button.index});if(r.gate!=='PASS')return r;r=await observe(detailSpec);if(r.gate!=='PASS')return r;}
      const d=r.data,f=d.fields;
      if(jobId(d.url)!==ref.external_id || f.body_id!=='JobDetails_AboutTheJob_'+ref.external_id || norm(f.title)!==norm(ref.title) || norm(f.company)!==norm(ref.company))return gate('REJECT','IDENTITY_CHANGED','详情 ID、标题或企业与列表不符。');
      if(!f.jd?.trim())return gate('REJECT','JD_MISSING');
      const url=canonical(ref.external_id),text=[f.title,f.company,f.jd].join('\n');
      return gate('PASS','JOB_READ','',{data:{external_id:ref.external_id,url,title:f.title.trim(),company:f.company.trim(),location:f.location?.split(' · ')[0] || ref.location || null,jd:f.jd,jd_complete:completeEnglishJD(f.jd)&&!(d.clipped_fields || []).includes('jd')&&!(d.controls[expand] || []).some(x=>x.visible!==false),status:'open',observed_at:d.observed_at,evidence:{url,observed_at:d.observed_at,text,kind:'page'}}});
    }
  };
}
