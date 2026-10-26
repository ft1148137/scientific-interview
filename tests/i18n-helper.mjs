import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export function loadI18n(context, language='zh-CN') {
  const source=readFileSync(new URL('../templates/i18n.js',import.meta.url),'utf8');
  const dictionary=readFileSync(new URL('../templates/i18n-en.json',import.meta.url),'utf8');
  vm.runInContext(source.replace('__I18N_EN__',dictionary),context);
  if(language==='zh-CN')vm.runInContext("language='zh-CN'",context);
}
