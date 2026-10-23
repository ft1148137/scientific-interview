import {assertURL, gate, pageGate} from '../../protocol.mjs';

const normalized = text => (text || '').replace(/\s+/g, ' ').trim();
export function createDOMSite(port, config) {
  const {manifest, listSpec, detailSpec} = config;
  function scope(url, detail = false) {
    try {
      const u = new URL(assertURL(url, manifest.domains));
      if (manifest.path_prefix && u.pathname !== manifest.path_prefix && !u.pathname.startsWith(manifest.path_prefix + '/')) return false;
      return !detail || !!config.id(u);
    } catch { return false; }
  }
  function checked(result) {
    const verdict = pageGate(result);
    if (verdict.gate !== 'PASS') return verdict;
    return scope(result.data.url) ? result : gate('REJECT','SITE_SCOPE_REJECTED','页面不属于当前企业或租户。');
  }
  function canonical(url) {
    const u = new URL(url);
    for (const key of ['track_id','highlightType','from','source']) u.searchParams.delete(key);
    if (config.hashJobs) { u.search = ''; u.hash = '#/job/' + config.id(u); }
    u.searchParams.sort();
    return u.href;
  }
  async function list(query, page) {
    let result = checked(await port.navigate(config.searchURL(query),{reload:true}));
    if (result.gate !== 'PASS') return result;
    if (config.search && query.keyword) {
      const controls=[config.search.input,...(config.search.button?[config.search.button]:[])];
      result=checked(await port.wait({selector:config.search.input,observe:{controls}}));
      if(result.gate!=='PASS') return result;
      result=checked(await port.act({kind:'fill',selector:config.search.input,value:query.keyword,snapshot_id:result.data.snapshot_id}));
      if(result.gate!=='PASS') return result;
      result=checked(await port.observe({controls}));
      if(result.gate!=='PASS') return result;
      result=checked(await port.act({kind:config.search.button?'click':'press',selector:config.search.button || config.search.input,key:'Enter',snapshot_id:result.data.snapshot_id}));
      if(result.gate!=='PASS') return result;
    }
    result = checked(await port.wait({selector:listSpec.lists.jobs.selector,observe:listSpec}));
    if (result.gate !== 'PASS') return result;
    for (let nextPage = 2; nextPage <= page; nextPage++) {
      const previous = result.data.lists.jobs[0]?.text;
      const control = config.next ? {selector:config.next} : {selector:config.pages,text:String(nextPage)};
      result = checked(await port.act({kind:'click',...control,snapshot_id:result.data.snapshot_id}));
      if (result.gate !== 'PASS') return result;
      result = checked(await port.wait({selector:listSpec.lists.jobs.selector,previousText:previous,observe:listSpec}));
      if (result.gate !== 'PASS') return result;
      if (previous && result.data.lists.jobs[0]?.text === previous) return gate('RETRY','PAGE_NOT_CHANGED','翻页内容尚未更新。',{retryAfter:2});
    }
    return result;
  }
  return {
    manifest,
    async probe(observation) { return checked(observation || await port.observe()); },
    async discover(query = {}, cursor = null) {
      if (Object.keys(query).some(key => !manifest.search_fields.includes(key)) || (query.keyword !== undefined && typeof query.keyword !== 'string')) return gate('REJECT','UNSUPPORTED_QUERY','只将网站声明支持的搜索条件交给插槽；其他条件在采集后筛选。');
      const page = cursor?.page ?? 1;
      if (!Number.isInteger(page) || page < 1 || page > 1000) return gate('REJECT','INVALID_CURSOR');
      const result = await list(query, page);
      if (result.gate !== 'PASS') return result;
      const data = result.data;
      if (!data.lists.jobs.length) return gate('REJECT','EMPTY_OR_CHANGED','没有可确认的岗位列表，不能推断岗位下线。');
      const refs = [];
      for (const card of data.lists.jobs) {
        if (!card.title) return gate('REJECT','LAYOUT_CHANGED','岗位标题字段缺失。');
        const ref = {...(card.external_id?{external_id:card.external_id}:{}),...(card.company?{company:card.company}:{}),title:card.title,location:config.location ? config.location(card) : card.location || null,index:card.index,card_text:card.text,page,query};
        if (card.href && !card.href.startsWith('javascript:')) {
          const url = new URL(card.href, data.url).href;
          if (!scope(url, true)) return gate('REJECT','SITE_SCOPE_REJECTED','列表包含非本租户的详情链接。');
          ref.url = canonical(url);
          ref.external_id = config.id(new URL(url));
        }
        refs.push(ref);
      }
      const nextControl = config.next ? data.controls?.[config.next]?.find(c => c.visible !== false) : null;
      const maxPage = Math.max(page,...(data.lists.pages || []).map(p=>Number(p.text)).filter(Number.isFinite));
      const hasNext = config.next ? !!nextControl && !nextControl.disabled : maxPage > page;
      // Absence of pagination is not proof of a complete catalog.
      const paginationKnown = config.next ? !!nextControl : (data.lists.pages || []).length > 0;
      return gate('PASS','DISCOVERED','',{data:{refs,next_cursor:hasNext?{page:page+1}:null,coverage:hasNext || !paginationKnown ? 'partial' : 'complete'}});
    },
    async readJob(ref) {
      if (ref.url && !scope(ref.url,true)) return gate('REJECT','SITE_SCOPE_REJECTED');
      let result;
      if (ref.url) result = checked(await port.navigate(ref.url));
      else {
        if (!Number.isInteger(ref.index) || ref.index < 0 || !ref.query || !Number.isInteger(ref.page)) return gate('REJECT','INVALID_REF');
        result = await list(ref.query,ref.page);
        if (result.gate !== 'PASS') return result;
        const card = result.data.lists.jobs.find(card=>card.index===ref.index);
        if (!card || card.title !== ref.title || card.text !== ref.card_text) return gate('REJECT','LIST_CHANGED','列表变化，重新发现岗位。');
        result = checked(await port.act({kind:'click',selector:config.cardClick,index:ref.index,snapshot_id:result.data.snapshot_id}));
      }
      if (result.gate !== 'PASS') return result;
      if (!scope(result.data.url,true)) return gate('REJECT','DETAIL_ID_MISSING','未进入有稳定岗位 ID 的详情页。');
      const closed = result.data.text.match(/该(?:职位|岗位)已(?:下线|停止招聘)|职位已失效/);
      const expected = ref.external_id || (ref.url ? config.id(new URL(ref.url)) : null);
      if (expected && config.id(new URL(result.data.url)) !== expected) return gate('REJECT','IDENTITY_CHANGED');
      if (!closed) {
        result = checked(await port.wait({selector:config.detailReady,observe:detailSpec}));
        if (result.gate !== 'PASS') return result;
      }
      const d = result.data;
      if (!scope(d.url,true) || (expected && config.id(new URL(d.url)) !== expected)) return gate('REJECT','IDENTITY_CHANGED');
      if (closed && !ref.title) return gate('REJECT','CLOSED_WITHOUT_IDENTITY');
      const parsed = closed ? {title:ref.title,company:ref.company,jd:null,complete:false} : config.parse(d);
      if (!parsed.title) return gate('REJECT','LAYOUT_CHANGED','详情缺少标题。');
      if (ref.title && normalized(parsed.title) !== normalized(ref.title)) return gate('REJECT','IDENTITY_CHANGED','列表与详情标题不一致，重新发现。');
      const company=manifest.company || parsed.company;
      if (!normalized(company)) return gate('REJECT','COMPANY_MISSING','详情缺少招聘企业，不能以平台名称代替。');
      if (!manifest.company && ref.company && normalized(company)!==normalized(ref.company)) return gate('REJECT','IDENTITY_CHANGED','列表与详情企业不一致，重新发现。');
      const url = canonical(d.url), id = config.id(new URL(d.url));
      const text = [parsed.title,...(!manifest.company?[company]:[]),parsed.jd,closed?.[0]].filter(Boolean).join('\n');
      return gate('PASS',closed?'CLOSED':'JOB_READ','',{data:{external_id:id,title:parsed.title,company,url,location:parsed.location || ref.location || null,jd:parsed.jd || null,jd_complete:!!parsed.complete && !(d.clipped_fields || []).includes('jd') && !Object.values(d.lists || {}).flat().some(b=>b.clipped),status:closed?'closed':parsed.jd?'open':'unknown',...(closed?{closed_reason:closed[0]}:{}),observed_at:d.observed_at,evidence:{url,observed_at:d.observed_at,text,kind:closed?'closed':'page'}}});
    }
  };
}

export function sections(data) {
  const blocks = (data.lists.sections || []).map(b=>({...b,heading:(b.heading || '').replace(/[：:]$/, '').trim()}));
  const duty = blocks.find(b=>/^(岗位职责|职位描述|工作职责|岗位描述)$/.test(b.heading || ''));
  const requirements = blocks.find(b=>/^(岗位基本要求|任职要求|职位要求|任职资格)$/.test(b.heading || ''));
  return {title:data.fields.title,jd:blocks.map(b=>b.text).join('\n\n'),complete:!!duty && !!requirements && blocks.every(b=>b.text.trim().replace(/[：:]$/, '').trim()!==b.heading)};
}

export function pairedSections(data) {
  const headings=data.lists.headings || [], bodies=data.lists.blocks || [];
  const blocks=bodies.map((b,i)=>({...b,heading:headings[i]?.text || '',text:[headings[i]?.text,b.text].filter(Boolean).join('\n')}));
  const parsed=sections({...data,lists:{sections:blocks}});
  return {...parsed,complete:parsed.complete && headings.length===bodies.length};
}
