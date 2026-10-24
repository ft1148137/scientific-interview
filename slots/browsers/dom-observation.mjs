// Shared read-only DOM extraction; executed inside the browser page.
export const readDOM = ({fields, lists, controls}) => {
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
      };
