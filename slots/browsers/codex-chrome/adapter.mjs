import {assertURL, gate, pageGate} from '../../protocol.mjs';
export const manifest = {id:'codex-chrome', kind:'browser', version:'1.0.0', protocol_version:1, capabilities:['navigate','observe','click','fill','wait','scroll','screenshot']};

// Inject the host's documented cua object. No CDP, Playwright installation, cookies or hidden APIs.
export function createBrowserPort(cua, domains) {
  let browserId, tab, sequence = 0, last = null;
  const owned = new Map();
  const fail = error => gate('RETRY','BROWSER_ERROR',String(error.message || error),{retryAfter:2});
  async function observe(spec = {}) {
    if (!tab) return gate('WAIT_USER','CONNECT_REQUIRED','请连接 Chrome 插件。');
    try {
      const url = assertURL(await tab.url(), domains);
      const data = await tab.playwright.evaluate(({fields, lists, controls}) => {
        const visible = e => !!e && !!(e.getBoundingClientRect().width || e.getBoundingClientRect().height);
        const text = e => visible(e) ? (e.innerText || '').trim() : null;
        const firstVisible = (root, selector) => Array.from(root.querySelectorAll(selector)).find(visible);
        const clipped = e => {
          for (let node=e;node && node!==document.body;node=node.parentElement) {
            if (Number.parseInt(getComputedStyle(node).webkitLineClamp,10)>0 && node.scrollHeight>node.clientHeight+1) return true;
          }
          return false;
        };
        const readField = (root, config) => {
          if (typeof config==='string') return text(firstVisible(root,config));
          const element=firstVisible(root,config.selector);
          if (!/^(?:href|title|[\w-]*id)$/i.test(config.attribute || '')) throw new Error('UNSUPPORTED_ATTRIBUTE');
          return element ? element.getAttribute(config.attribute) : null;
        };
        const readFields = (root, config) => Object.fromEntries(Object.entries(config).map(([key, selector]) => [key,readField(root,selector)]));
        return {
          text:document.body.innerText, fields:readFields(document,fields),
          clipped_fields:Object.entries(fields).filter(([,selector])=>clipped(firstVisible(document,typeof selector==='string'?selector:selector.selector))).map(([key])=>key),
          lists:Object.fromEntries(Object.entries(lists).map(([key, config]) => [key, Array.from(document.querySelectorAll(config.selector)).map((e,index)=>visible(e)?({index,text:text(e),href:e.getAttribute('href'),clipped:clipped(e),...readFields(e,config.fields || {})}):null).filter(Boolean)])),
          controls:Object.fromEntries(controls.map(selector=>[selector,Array.from(document.querySelectorAll(selector)).map((e,index)=>({index,text:text(e),label:e.getAttribute('aria-label') || e.getAttribute('title') || e.parentElement?.getAttribute('title') || '',tag:e.tagName,type:e.getAttribute('type'),visible:visible(e),disabled:e.hasAttribute('disabled') || e.getAttribute('aria-disabled')==='true'}))]))
        };
      },{fields:spec.fields||{},lists:spec.lists||{},controls:spec.controls||[]});
      last = {id:++sequence,url,spec,data};
      return gate('PASS','OBSERVED','',{data:{...data,url,observed_at:new Date().toISOString(),snapshot_id:sequence}});
    } catch(error) { if (error.message === 'DOMAIN_REJECTED') return gate('REJECT','DOMAIN_REJECTED'); return fail(error); }
  }
  return {
    manifest,
    async connect(config = {}) {
      try {
        const inventory = await cua.listBrowsers({emit:false});
        const candidates = inventory.filter(b=>b.family==='chrome' && b.type==='extension' && (!config.browserId || b.id===config.browserId));
        if (candidates.length !== 1) return gate('WAIT_USER','SELECT_CHROME','请连接 Chrome 插件；多个配置时显式提供 browserId。');
        browserId = candidates[0].id;
        return gate('PASS','CONNECTED','',{data:{browser_id:browserId,capabilities:manifest.capabilities}});
      } catch(error) { return gate('WAIT_USER','CONNECT_REQUIRED','请连接 Codex Chrome 插件后重试。'); }
    },
    async navigate(url, options = {}) {
      try {
        assertURL(url,domains);
        if (!browserId) return gate('WAIT_USER','CONNECT_REQUIRED');
        if (!tab) { tab = await cua.createBrowserTab(browserId,url,{sessionName:'🧭 Scientific Interview'}); owned.set(tab.id,tab); }
        else if (await tab.url() !== url) await tab.goto(url);
        else if (options.reload) await tab.reload();
        last = null;
        if (!tab.playwright?.evaluate || !tab.playwright?.locator || !tab.url) return gate('REJECT','MISSING_CAPABILITY','当前宿主未提供协议所需的页面接口。');
        return await observe();
      } catch(error) { return error.message==='DOMAIN_REJECTED' ? gate('REJECT','DOMAIN_REJECTED') : fail(error); }
    },
    observe,
    async act(action) {
      if (!last || action.snapshot_id !== last.id) return gate('REJECT','STALE_OBSERVATION','重新观察页面后操作。');
      if (!['click','fill','scroll','press'].includes(action.kind)) return gate('REJECT','UNSUPPORTED_ACTION');
      const controls = last.data.controls[action.selector];
      if (!controls) return gate('REJECT','UNOBSERVED_TARGET');
      const target = action.text !== undefined ? controls.find(x=>x.text===action.text) : controls[action.index || 0];
      if (!target || target.visible === false || target.disabled || (!target.text && action.kind==='click' && target.tag!=='BUTTON' && !target.label)) return gate('REJECT','TARGET_MISSING');
      if (['password','file','submit','reset'].includes(target.type) || [target.text,target.label].some(text=>/^(?:[^\p{L}\p{N}]*)(申请岗位|立即申请|投递|提交|申请|发送|收藏|删除|apply|submit)/iu.test(text || ''))) return gate('REJECT','OUTSIDE_COLLECTION_SCOPE');
      if (action.kind==='press' && (action.key!=='Enter' || target.tag!=='INPUT' || !['text','search'].includes(target.type))) return gate('REJECT','UNSUPPORTED_ACTION');
      try {
        assertURL(await tab.url(),domains);
        const before = new Set((await cua.listTabs({browser:browserId,emit:false})).map(x=>x.id));
        const locator = tab.playwright.locator(action.selector).nth(target.index);
        if (action.kind==='click') await locator.click();
        if (action.kind==='fill') await locator.fill(String(action.value));
        if (action.kind==='press') await locator.press('Enter');
        if (action.kind==='scroll') await locator.press('PageDown');
        await tab.getAXState({emit:false});
        const added = (await cua.listTabs({browser:browserId,emit:false})).filter(x=>!before.has(x.id));
        if (added.length > 1) return gate('REJECT','AMBIGUOUS_NEW_TAB');
        if (added.length === 1) { assertURL(added[0].url,domains); tab = await cua.getTab(added[0].id,{browser:browserId}); owned.set(tab.id,tab); }
        return await observe();
      } catch(error) { return error.message==='DOMAIN_REJECTED' ? gate('REJECT','DOMAIN_REJECTED') : fail(error); }
    },
    async wait(spec = {}) {
      if (!tab) return gate('WAIT_USER','CONNECT_REQUIRED');
      try { if (spec.selector) { let locator=tab.playwright.locator(spec.selector).first(); if(spec.previousText) locator=locator.filter({hasNotText:spec.previousText}); await locator.waitFor({state:'visible',timeoutMs:spec.timeoutMs || 10000}); } return await observe(spec.observe || {}); }
      catch(error) { const observation=await observe(spec.observe || {}); const verdict=pageGate(observation); return verdict.gate==='PASS' ? fail(error) : verdict; }
    },
    async screenshot() { if (!tab) return gate('WAIT_USER','CONNECT_REQUIRED'); return tab.screenshot({fullPage:false}); },
    async handoff() { if (tab) await tab.markHandoff(); },
    async release() { last = null; tab = null; browserId = null; return gate('PASS','RELEASED'); }
  };
}
