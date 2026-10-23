// Shared, dependency-free calculations for the offline dashboard and Node tests.
const DAY_MS = 86400000;
const APPLICATION_LABELS = {submitted:'待反馈',in_review:'筛选中',interview:'面试中',offer:'Offer',rejected:'明确拒绝',withdrawn:'已撤回',ended:'流程结束',talent_pool:'转人才库',position_closed:'岗位停招',unknown:'状态待核验'};
const DISPLAY_STATUS_LABELS = {...APPLICATION_LABELS, inactive:'不活跃'};
function inactiveJob(job, at = new Date()) {
  if (job.activity_override?.mode === "inactive") return true;
  const changed = Date.parse(job.last_changed_at);
  return Number.isFinite(changed) && at.getTime() - changed >= 30 * DAY_MS;
}
function inactivityLabel(job) {
  return job.activity_override?.mode === 'inactive' ? '不活跃 · 人工标记' : '不活跃 · 30 天无变化';
}
function weekStart(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d;
}
function statistics(data, at = new Date(), days = 0) {
  const cutoff = days ? at.getTime() - days * DAY_MS : -Infinity;
  const timelines = new Map();
  for (const event of data.applications || []) {
    const stamp = Date.parse(event.evidence?.observed_at || event.at);
    if (!data.jobs[event.key] || !(event.status in APPLICATION_LABELS) || !Number.isFinite(stamp) || stamp > +at) continue;
    if (!timelines.has(event.key)) timelines.set(event.key, []);
    timelines.get(event.key).push({...event, stamp});
  }
  const rows = [];
  let unknownOnly = 0;
  for (const [key, events] of timelines) {
    events.sort((a,b)=>a.stamp-b.stamp);
    const known = events.filter(e=>e.status !== 'unknown');
    if (!known.length) { unknownOnly++; continue; }
    // A later stage proves an application exists, but does not establish its submission date.
    const first = events.find(e=>e.status === 'submitted' && e.evidence?.submission_date_unknown !== true);
    const start = first?.stamp ?? known[0].stamp;
    if (start < cutoff) continue;
    const feedback = []; let previous = null;
    for (const e of events) {
      if (e.status !== 'unknown') {
        if (e.status !== previous && ['in_review','interview','offer','rejected'].includes(e.status)) feedback.push(e.stamp);
        previous = e.status;
      }
    }
    const job = data.jobs[key], status = events[events.length-1].status;
    const displayStatus = ['submitted','in_review','interview','unknown'].includes(status) && inactiveJob(job, at) ? 'inactive' : status;
    rows.push({key, company:job.current.company, direction:job.classification?.direction || '未分类',
      industry:job.classification?.industry || '未分类', status, display_status:displayStatus,
      submitted_at:first?.stamp ?? null, first_recorded_at:start, feedback});
  }
  function group(field) {
    const groups = new Map();
    for (const row of rows) {
      const name = row[field];
      if (!groups.has(name)) groups.set(name, {label:name, keys:[]});
      groups.get(name).keys.push(row.key);
    }
    return [...groups.values()].map(g=>({...g,count:g.keys.length})).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label));
  }
  const weeks = []; const monday = weekStart(at);
  for (let offset=11; offset>=0; offset--) {
    const start = new Date(monday); start.setDate(start.getDate()-offset*7);
    const end = new Date(start); end.setDate(end.getDate()+7);
    const submitted = rows.filter(r=>r.submitted_at !== null && r.submitted_at >= +start && r.submitted_at < +end).map(r=>r.key);
    const feedback = rows.filter(r=>r.feedback.some(t=>t>=+start && t<+end)).map(r=>r.key);
    weeks.push({start:+start,label:`${start.getMonth()+1}/${start.getDate()}`,submitted,feedback});
  }
  return {rows, total:rows.length, companies:group('company'), directions:group('direction'), industries:group('industry'),
    statuses:group('display_status').sort((a,b)=>Object.keys(DISPLAY_STATUS_LABELS).indexOf(a.label)-Object.keys(DISPLAY_STATUS_LABELS).indexOf(b.label)).map(g=>({...g,status:g.label,label:DISPLAY_STATUS_LABELS[g.label],color:({submitted:'#e4b83e',in_review:'#e4b83e',interview:'#e4b83e',offer:'#32915b',rejected:'#d34c4c',withdrawn:'#969b96',ended:'#7e8b89',talent_pool:'#8495a6',position_closed:'#aba89b',unknown:'#c8ccc6',inactive:'#718078'})[g.label]})), weeks,
    thisWeek:rows.filter(r=>r.submitted_at !== null && r.submitted_at>=+monday).map(r=>r.key),
    inProgress:rows.filter(r=>['submitted','in_review','interview'].includes(r.display_status)).map(r=>r.key),
    rejected:rows.filter(r=>r.status==='rejected').map(r=>r.key),
    missingSubmissionDate:rows.filter(r=>r.submitted_at===null).length, unknownOnly};
}
