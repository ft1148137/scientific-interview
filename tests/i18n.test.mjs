import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {loadI18n} from './i18n-helper.mjs';
function fixture(storage){const context=vm.createContext(storage?{localStorage:storage}:{});loadI18n(context,'en');return context;}
test('English is the first-visit default, including unavailable or invalid storage',()=>{
  for(const storage of [undefined,{getItem(){throw Error('blocked');}},{getItem(){return 'fr';}}]){
    const c=fixture(storage);assert.equal(c.t('全部岗位'),'All jobs');
  }
  assert.equal(fixture({getItem(){return 'zh-CN';}}).t('全部岗位'),'全部岗位');
});
test('static UI translates without modifying interpolated source content or HTML escaping',()=>{
  const c=fixture();
  // Even archive text identical to a UI label must retain its original language.
  const source='投递候选 &lt;script&gt;';
  assert.equal(c.t(['<p>方向：','</p>'],source),'<p>Role: '+source+'</p>');
  assert.equal(c.t('<span class="badge">待核验</span>'),'<span class="badge">Needs verification</span>');
  const labels=c.translatedLabels({open:'在招',closed:'已核实下线'});
  assert.equal(labels.open,'Open');vm.runInContext("language='zh-CN'",c);
  assert.equal(labels.open,'在招');assert.equal(c.t(['方向：',''],source),'方向：'+source);
});
test('English chart tooltips, empty states and weekly table coexist with untouched company names',()=>{
  const c=fixture();c.esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  vm.runInContext(readFileSync(new URL('../templates/statistics-view.js',import.meta.url),'utf8'),c);
  const html=c.ringChart([{label:'投递候选',count:1,keys:['synthetic']}],1,'Applications');
  assert.match(html,/投递候选 · 1 applications/);assert.match(html,/view details/);
  assert.match(c.ringChart([],0,'Applications'),/No confirmed applications/);
  const weeks=Array.from({length:12},(_,i)=>({label:`10/${i+1}`,submitted:[],feedback:[]}));
  const line=c.lineChart(weeks);assert.match(line,/Weekly values &amp; details|Weekly values & details/);assert.match(line,/Week starting/);assert.doesNotMatch(line,/[\u3400-\u9fff]/);
});
test('CSV headers and filename follow the UI language, while job text stays unchanged',()=>{
  for(const locale of ['en','zh-CN']){
    const c=fixture();if(locale==='zh-CN')vm.runInContext("language='zh-CN'",c);
    let download;const button={};
    Object.assign(c,{
      $:()=>button,filtered:[{current:{company:'投递候选',title:'合成岗位',location:'北京',status:'open',url:'https://jobs.example.com/a'}}],
      status:c.translatedLabels({open:'在招'}),decision:c.translatedLabels({undecided:'未决定'}),effectiveDecision:()=> 'undecided',latest:()=>null,
      Blob:class{constructor(parts){this.text=parts.join('');}},
      URL:{createObjectURL:blob=>{download=blob;return 'blob:synthetic';},revokeObjectURL:()=>{}},
      setTimeout:()=>{},document:{createElement:()=>({click(){download.filename=this.download;}})}
    });
    const template=readFileSync(new URL('../templates/dashboard.html',import.meta.url),'utf8');
    vm.runInContext(template.slice(template.indexOf('function csvCell('),template.indexOf("for(const event of ['pointerover'")),c);
    button.onclick();
    assert.match(download.text,/投递候选/);assert.match(download.text,/合成岗位/);
    assert.ok(download.text.includes(locale==='en'?'"Company","Job title"':'"公司","职位"'));
    assert.equal(download.filename,locale==='en'?'filtered-jobs.csv':'岗位筛选.csv');
  }
});
