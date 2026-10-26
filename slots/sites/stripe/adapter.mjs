export const manifest = {"id": "stripe", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["stripe.com"], "entry_url": "https://stripe.com/careers/search", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Stripe", "path_prefix": "/careers"};
import {createInternationalSite,englishDescription} from '../shared/international.mjs';
export function createSiteSlot(port) {
 const next='button[aria-label="Next page"]';
 return createInternationalSite(port,{manifest,next,searchURL:q=>manifest.entry_url+'?query='+encodeURIComponent(q.keyword || ''),
  listSpec:{lists:{jobs:{selector:'.careers-role-result',fields:{title:'a.careers-role-result__title',href:{selector:'a.careers-role-result__title',attribute:'href'}}}},controls:[next]},
  id:u=>u.pathname.match(/^\/careers\/listing\/[^/]+\/(\d+)\/?$/)?.[1],
  detailReady:'.careers-listing-details__body',detailSpec:{fields:{title:'h1.careers-detail-hero__title'},lists:{sections:{selector:'.careers-listing-details__body'},facts:{selector:'.careers-listing-details__fact',fields:{label:'dt',value:'dd'}}}},
  parse:d=>{const parsed=englishDescription(d),facts=d.lists.facts || [];return {...parsed,location:facts.filter(f=>/location/i.test(f.label || '')).map(f=>f.label+': '+f.value).join('; ') || null,jd:[...facts.map(f=>f.text),parsed.jd].join('\n\n')};}});
}
