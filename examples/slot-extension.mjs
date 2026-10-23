// Offline BrowserPort example. No browser, network, accounts or host API required.
import {gate,assertURL,negotiate} from '../slots/protocol.mjs';
import {runScan} from '../slots/runner.mjs';
import {createSiteSlot,manifest as siteManifest} from '../slots/sites/demo-company/adapter.mjs';

export const browserManifest={id:'fixture',kind:'browser',version:'1.0.0',protocol_version:1,capabilities:['navigate','observe']};
export function createFixturePort(){
  let currentURL=null;
  return {
    manifest:browserManifest,
    async connect(){return gate('PASS','CONNECTED','仅合成页面，无真实浏览器连接。');},
    async navigate(url){
      try{currentURL=assertURL(url,siteManifest.domains);return gate('PASS','NAVIGATED');}
      catch(error){return gate('REJECT',error.message,'请使用网站清单中声明的域名。');}
    },
    async observe(spec={}){
      if(!currentURL)return gate('REJECT','NO_PAGE','先 navigate 再 observe。');
      const fields={title:'合成后端工程师',company:'示例企业（合成）',location:'北京',jd:'负责服务端开发；要求 Python 经验。'};
      return gate('PASS','OBSERVED','', {data:{url:currentURL,text:currentURL.endsWith('/jobs/example')?fields.jd:'合成岗位列表',observed_at:new Date().toISOString(),snapshot_id:1,
        fields:spec.fields?fields:{},lists:spec.lists?{jobs:[{href:'/jobs/example',title:fields.title}]}:{},controls:[]}});
    },
    async handoff(){return gate('WAIT_USER','FIXTURE_ONLY','合成端口没有登录页。');},
    async release(){currentURL=null;return gate('PASS','RELEASED');}
  };
}
// Reuse the existing demo SiteSlot: adding a browser does not change site parsing or the runner.
const port=createFixturePort();
const check=negotiate(siteManifest,port.manifest);
if(check.gate!=='PASS')throw new Error(JSON.stringify(check));
await port.connect();
console.log(JSON.stringify(await runScan(port,createSiteSlot(port),{}, {id:'fixture-example-'+Date.now()}),null,2));
await port.release();
