// Local UI translations only. Never pass archive text or interpolated user values to t().
const ENGLISH_UI = __I18N_EN__;
const LANGUAGE_KEY = 'scientific-interview.language';
let language = 'en';
try { if (localStorage.getItem(LANGUAGE_KEY) === 'zh-CN') language = 'zh-CN'; } catch { /* Offline/private storage may be unavailable. */ }
function translateLiteral(source) {
  if (language === 'zh-CN') return source;
  return source.replace(/[^<>"'\n]*[\u3400-\u9fff][^<>"'\n]*/g, fragment => {
    const key = fragment.trim();
    return Object.hasOwn(ENGLISH_UI, key) ? fragment.replace(key, ENGLISH_UI[key]) : fragment;
  });
}
// Tagged templates translate static segments before inserting values, preserving original data.
function t(source, ...values) {
  if (Array.isArray(source)) return source.reduce((text, part, i) => text + translateLiteral(part) + (i < values.length ? values[i] : ''), '');
  return translateLiteral(source);
}
function translatedLabels(labels) {
  return new Proxy(labels, {get: (target, key) => typeof target[key] === 'string' ? t(target[key]) : target[key]});
}
// Capture only the original HTML shell, before any archive content is rendered.
function staticTranslations(root) {
  const entries = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('script,style,[data-language-control]') && /[\u3400-\u9fff]/.test(node.textContent)) {
      const source = node.textContent;
      entries.push(() => { node.textContent = t(source); });
    }
  }
  for (const element of root.querySelectorAll('[aria-label],[placeholder],[title]')) {
    if (element.closest('[data-language-control]')) continue;
    for (const name of ['aria-label', 'placeholder', 'title']) {
      const source = element.getAttribute(name);
      if (source && /[\u3400-\u9fff]/.test(source)) entries.push(() => element.setAttribute(name, t(source)));
    }
  }
  return () => entries.forEach(apply => apply());
}
