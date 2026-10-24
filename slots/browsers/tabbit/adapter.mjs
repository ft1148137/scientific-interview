import {assertURL, gate, pageGate} from '../../protocol.mjs';
import {readDOM} from '../dom-observation.mjs';

export const manifest = {id:'tabbit',kind:'browser',version:'1.0.0',protocol_version:1,capabilities:['navigate','observe','click','fill','wait','scroll','screenshot']};

// Inject only the documented globals from Tabbit CLI's nodejs task.
export function createBrowserPort(runtime, domains) {
  let page = null, last = null, sequence = 0;
  const fail = error => error.message === 'DOMAIN_REJECTED'
    ? gate('REJECT','DOMAIN_REJECTED')
    : gate('RETRY','BROWSER_ERROR',String(error.message || error),{retryAfter:2});
  const disconnected = () => gate('WAIT_USER','CONNECT_REQUIRED','请启动 Tabbit 并在官方 tabbit-cli nodejs 任务中连接。');
  async function observe(spec = {}) {
    if (!page) return disconnected();
    last = null;
    try {
      const url = assertURL(page.url(),domains);
      const data = await page.evaluate(readDOM,{fields:spec.fields||{},lists:spec.lists||{},controls:spec.controls||[]});
      if (page.url() !== url) return gate('RETRY','PAGE_CHANGED','页面已跳转，请重新观察。',{retryAfter:2});
      last = {id:++sequence,url,spec,data};
      return gate('PASS','OBSERVED','',{data:{...data,url,observed_at:new Date().toISOString(),snapshot_id:sequence}});
    } catch(error) { return fail(error); }
  }
  return {
    manifest,
    async connect() {
      last = null;
      const candidate = runtime?.getPage?.();
      if (!candidate) return disconnected();
      if (!candidate.evaluate || !candidate.locator || !candidate.goto || !candidate.reload || !candidate.waitForFunction || !candidate.screenshot || !runtime.context?.pages || !runtime.tabbit?.triggerAndObserve || !runtime.usePage || !runtime.reportIssue) return gate('REJECT','MISSING_CAPABILITY');
      page = candidate;
      return gate('PASS','CONNECTED','',{data:{browser_id:'tabbit',capabilities:manifest.capabilities}});
    },
    async navigate(url, options = {}) {
      last = null;
      try {
        assertURL(url,domains);
        if (!page) return disconnected();
        if (page.url() !== url) await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});
        else if (options.reload) await page.reload({waitUntil:'domcontentloaded',timeout:20000});
        return await observe();
      } catch(error) { return fail(error); }
    },
    observe,
    async act(action) {
      if (!last || action.snapshot_id !== last.id) return gate('REJECT','STALE_OBSERVATION');
      if (!['click','fill','scroll','press'].includes(action.kind)) return gate('REJECT','UNSUPPORTED_ACTION');
      const observed = last;
      const controls = observed.data.controls[action.selector];
      if (!controls) return gate('REJECT','UNOBSERVED_TARGET');
      const target = action.text !== undefined ? controls.find(x=>x.text===action.text) : controls[action.index || 0];
      if (!target || !target.visible || target.disabled || (!target.text && action.kind==='click' && target.tag!=='BUTTON' && !target.label)) return gate('REJECT','TARGET_MISSING');
      if (['password','file','submit','reset'].includes(target.type) || [target.text,target.label].some(text=>/^(?:[^\p{L}\p{N}]*)(申请岗位|立即申请|投递|提交|申请|发送|收藏|删除|apply|submit)/iu.test(text || ''))) return gate('REJECT','OUTSIDE_COLLECTION_SCOPE');
      if (action.kind==='fill' && (target.tag!=='INPUT' || !['text','search',null].includes(target.type))) return gate('REJECT','OUTSIDE_COLLECTION_SCOPE');
      if (action.kind==='press' && (action.key!=='Enter' || target.tag!=='INPUT' || !['text','search'].includes(target.type))) return gate('REJECT','UNSUPPORTED_ACTION');
      last = null;
      try {
        assertURL(page.url(),domains);
        if (page.url() !== observed.url) return gate('REJECT','STALE_OBSERVATION');
        const fresh = await page.evaluate(readDOM,{fields:{},lists:{},controls:[action.selector]});
        if (JSON.stringify(fresh.controls[action.selector]?.[target.index]) !== JSON.stringify(target)) return gate('REJECT','STALE_OBSERVATION');
        const before = new Set(runtime.context.pages());
        const locator = page.locator(action.selector).nth(target.index);
        if (action.kind==='click' || action.kind==='press') {
          // A render signal may precede the popup; collect the transition before choosing a page.
          const transition = await runtime.tabbit.triggerAndObserve(()=>action.kind==='click'?locator.click({timeout:10000}):locator.press('Enter',{timeout:10000}),{timeoutMs:10000,activatePage:false,settleMs:1000});
          if (transition?.kind==='page') {
            assertURL(transition.url,domains);
            if (!runtime.context.pages().some(p=>!before.has(p))) return gate('RETRY','PAGE_CHANGED','新标签页尚未就绪，请重新观察。',{retryAfter:2});
          }
        }
        if (action.kind==='fill') {
          // Search widgets may depend on keyboard events that bulk fill does not emit.
          await locator.fill('',{timeout:10000});
          await locator.pressSequentially(String(action.value),{timeout:10000});
        }
        if (action.kind==='scroll') await locator.press('PageDown',{timeout:10000});
        const added = runtime.context.pages().filter(p=>!before.has(p));
        if (added.length>1) return gate('REJECT','AMBIGUOUS_NEW_TAB');
        if (added.length===1) {
          await added[0].waitForLoadState('domcontentloaded',{timeout:10000});
          assertURL(added[0].url(),domains);
          page = added[0]; runtime.usePage(page);
        }
        return await observe();
      } catch(error) { return fail(error); }
    },
    async wait(spec = {}) {
      if (!page) return disconnected();
      last = null;
      try {
        assertURL(page.url(),domains);
        if (spec.selector) {
          await page.locator(spec.selector).first().waitFor({state:'visible',timeout:spec.timeoutMs || 10000});
          if (spec.previousText) await page.waitForFunction(({selector,previousText})=>{
            const element=document.querySelector(selector);
            return !!element && !!(element.getBoundingClientRect().width || element.getBoundingClientRect().height) && (element.innerText || '').trim() !== previousText;
          },{selector:spec.selector,previousText:spec.previousText},{timeout:spec.timeoutMs || 10000});
        }
        return await observe(spec.observe || {});
      } catch(error) {
        const observation = await observe(spec.observe || {});
        const verdict = pageGate(observation);
        return verdict.gate==='PASS' ? fail(error) : verdict;
      }
    },
    async screenshot() {
      if (!page) return disconnected();
      try { assertURL(page.url(),domains); return await page.screenshot({fullPage:false}); }
      catch(error) { return fail(error); }
    },
    async handoff() { last = null; if (page) runtime.reportIssue('AUTHENTICATION_REQUIRED'); },
    async release() { last = null; page = null; return gate('PASS','RELEASED'); }
  };
}
