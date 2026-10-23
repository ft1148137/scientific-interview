let statisticGroups = [];
function statisticButton(label, keys, content, className='') {
  const index = statisticGroups.push({label,keys}) - 1;
  return `<button class="${className}" data-statistic="${index}" aria-label="${esc(label)}，${keys.length} 个岗位，查看明细">${content}</button>`;
}
function ringChart(groups, total, centerLabel) {
  if (!total) return '<div class="chart-empty">暂无已确认投递</div>';
  const colors=['#315847','#a5b59a','#c66d43','#d4b574','#718b9b','#9c859c','#bbbdb3'];
  let offset=-90;
  const point=(radius,angle)=>{const a=angle*Math.PI/180;return `${(70+radius*Math.cos(a)).toFixed(3)} ${(70+radius*Math.sin(a)).toFixed(3)}`;};
  const segments=groups.map((g,i)=>{
    const angle=g.count/total*360,gap=Math.min(1.2,angle/5),start=offset+gap/2,end=offset+angle-gap/2,large=end-start>180?1:0;
    offset+=angle;
    const path=`M ${point(62,start)} A 62 62 0 ${large} 1 ${point(62,end)} L ${point(44,end)} A 44 44 0 ${large} 0 ${point(44,start)} Z`;
    const label=`${g.label} · ${g.count} 份 · ${(g.count/total*100).toFixed(1)}%`;
    const index=statisticGroups.push({label:g.label,keys:g.keys})-1;
    return `<g class="ring-segment" role="button" tabindex="0" data-statistic="${index}" data-ring-label="${esc(label)}" aria-label="${esc(label)}，查看明细"><path d="${path}" fill="${g.color||colors[i%colors.length]}"/></g>`;
  }).join('');
  return `<div class="ring-layout"><svg class="ring" viewBox="0 0 140 140" role="group" aria-label="${esc(centerLabel)}：${total} 份。悬停或聚焦环段查看分类，点击查看明细。">${segments}<text x="70" y="68" text-anchor="middle" class="ring-number">${total}</text><text x="70" y="88" text-anchor="middle" class="ring-label">${esc(centerLabel)}</text></svg><div class="ring-tooltip" role="tooltip" hidden></div></div>`;

}
function distributionBars(groups,total) {
  return groups.length?'<div class="distribution">'+groups.map(g=>statisticButton(g.label,g.keys,`<span class="bar-label">${esc(g.label)}<span>${g.count} <small>· ${(g.count/total*100).toFixed(1)}%</small></span></span><span class="bar-track"><span style="width:${g.count/total*100}%"></span></span>`,'distribution-row')).join('')+'</div>':'<div class="chart-empty">暂无已确认投递</div>';
}
function renderStatistics() {
  if(shared)return;
  statisticGroups=[];
  const s=statistics(data,new Date(),Number($('stats-period').value)), allKeys=s.rows.map(r=>r.key);
  const inactiveKeys=Object.entries(data.jobs).filter(([,j])=>inactiveJob(j)).map(([key])=>key);
  const cards=[['累计投递',s.total,allKeys],['投递公司',s.companies.length,allKeys],['本周投递',s.thisWeek.length,s.thisWeek],['进行中',s.inProgress.length,s.inProgress],['明确拒绝',s.rejected.length,s.rejected],['不活跃岗位',inactiveKeys.length,inactiveKeys]];
  $('stats-metrics').innerHTML=cards.map(([label,value,keys],i)=>statisticButton(label,keys,`<span>${label}</span><b>${value}<small>${i===1?'家':i===5?'个':'份'}</small></b><small>${i===5?'全库 · 自动或人工标记':'所选投递批次'}</small>`,'stat-metric')).join('');
  $('status-chart').innerHTML=ringChart(s.statuses,s.total,'申请');
  let companies=s.companies;
  if(companies.length>6){const rest=companies.slice(5);companies=[...companies.slice(0,5),{label:'其他公司',count:rest.reduce((n,g)=>n+g.count,0),keys:rest.flatMap(g=>g.keys)}];}
  $('company-chart').innerHTML=ringChart(companies,s.total,'投递份数');
  $('direction-chart').innerHTML=distributionBars(s.directions,s.total);
  $('industry-chart').innerHTML=distributionBars(s.industries,s.total);
  $('trend-chart').innerHTML=lineChart(s.weeks);
  $('stats-scope').textContent=`按岗位去重 · 公司按已记录名称归并 · 截至 ${time(generatedAt)} · 趋势最近 12 周（周一开始，浏览器本地时区）`;
  $('stats-quality').textContent=`${s.missingSubmissionDate} 份缺少投递日期：计入总数及分布，投递趋势不补造日期。${s.unknownOnly} 个仅有“状态待核验”的岗位未计入投递。`;
  $('stats-detail').innerHTML='';
}
function showStatistic(index) {
  const group=statisticGroups[index];if(!group)return;
  const rows=statistics(data).rows;
  $('stats-detail').innerHTML=`<h2 class="section-title">${esc(group.label)} · ${group.keys.length} 个岗位</h2>`+(group.keys.length?'<div class="stat-detail-list">'+group.keys.map(key=>{const j=data.jobs[key],r=rows.find(r=>r.key===key);return `<div><span>${jobLink(key)}<small>${esc(j.current.company)}</small></span><span>${r?esc(APPLICATION_LABELS[r.status]):'未记录投递'}${inactiveJob(j)?' · 不活跃':''}</span></div>`;}).join('')+'</div>':empty('此项暂无记录。'));
  $('stats-detail').scrollIntoView({block:'start',behavior:'smooth'});$('stats-detail').focus({preventScroll:true});
}

function lineChart(weeks) {
  const peak=Math.max(1,...weeks.flatMap(w=>[w.submitted.length,w.feedback.length]));
  const top=Math.ceil(peak/4)*4, x=i=>48+i*72, y=n=>134-n/top*100;
  const grid=Array.from({length:5},(_,i)=>{const n=top*i/4;return `<line x1="48" x2="840" y1="${y(n)}" y2="${y(n)}" stroke="var(--line)"/><text x="35" y="${y(n)+4}" text-anchor="end">${n}</text>`;}).join('');
  const lines=[['submitted','投递','#315847'],['feedback','反馈','#c66d43']].map(([field,label,color])=>`<polyline points="${weeks.map((w,i)=>`${x(i)},${y(w[field].length)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" ${field==='feedback'?'stroke-dasharray="6 4"':''}/>`+weeks.map((w,i)=>{const index=statisticGroups.push({label:`${w.label} 当周${label}`,keys:w[field]})-1;return `<g role="button" tabindex="0" data-statistic="${index}" aria-label="${w.label} 当周${label} ${w[field].length} 个岗位，查看明细"><title>${w.label} ${label}：${w[field].length}</title>${field==='submitted'?`<circle cx="${x(i)}" cy="${y(w[field].length)}" r="5" fill="${color}"/>`:`<path d="M ${x(i)} ${y(w[field].length)-5} l 5 5 -5 5 -5 -5 Z" fill="var(--white)" stroke="${color}" stroke-width="2"/>`}</g>`;}).join('')).join('');
  return `<svg class="trend-line" viewBox="0 0 880 172" role="group" aria-label="投递与反馈折线图，纵轴为岗位数，横轴为周。实线圆点为投递，虚线菱形为反馈。">${grid}${lines}${weeks.map((w,i)=>`<text x="${x(i)}" y="160" text-anchor="middle">${esc(w.label)}</text>`).join('')}</svg><details class="trend-values"><summary>查看每周数值与明细</summary><table><thead><tr><th>周起始</th><th>投递</th><th>反馈</th></tr></thead><tbody>${weeks.map(w=>`<tr><th>${esc(w.label)}</th>${[['submitted','投递'],['feedback','反馈']].map(([field,label])=>'<td>'+statisticButton(`${w.label} 当周${label}`,w[field],String(w[field].length),'text-link')+'</td>').join('')}</tr>`).join('')}</tbody></table></details>`;
}
