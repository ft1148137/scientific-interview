export const protocolVersion = 1;
export const gate = (value, code, message = '', extra = {}) => ({gate:value, code, message, ...extra});
export function assertURL(url, domains) {
  let u; try { u = new URL(url); } catch { throw new Error('INVALID_URL'); }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || !domains.includes(u.hostname)) throw new Error('DOMAIN_REJECTED');
  return u.href;
}
export function negotiate(site, browser) {
  if (site.protocol_version !== 1 || browser.protocol_version !== 1) return gate('REJECT','PROTOCOL_VERSION');
  const missing = [...new Set((site.requires||[]).filter(x => !(browser.capabilities||[]).includes(x)))].sort();
  return gate(missing.length?'REJECT':'PASS',missing.length?'MISSING_CAPABILITY':'READY',missing.length?'浏览器缺少必要能力：'+missing.join(', '):'能力声明兼容',{
    missing,next_action:missing.length?'连接支持这些能力的已注册 BrowserPort，检查成功后从断点继续。':'调用该 BrowserPort.connect 检查实际连接，再开始扫描。'});
}
export function pageGate(observation) {
  if (observation.gate !== 'PASS') return observation;
  const text = observation.data.text;
  // A navigation header saying 登录 is not a blocked page.
  if (/请先登录|登录后查看|请完成验证|拖动滑块|安全验证|sign in to continue/i.test(text)) return gate('WAIT_USER','LOGIN_OR_CHALLENGE','请在浏览器完成登录或验证后继续。');
  if (/访问过于频繁|请求过于频繁|too many requests/i.test(text)) return gate('RETRY','RATE_LIMIT','稍后重新运行。',{retryAfter:30});
  return gate('PASS','PAGE_READY');
}
