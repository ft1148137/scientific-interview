export const manifest = {"id": "moka-step", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "阶跃星辰", "domains": ["app.mokahr.com"], "entry_url": "https://app.mokahr.com/social-recruitment/step/94904#/jobs", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "path_prefix": "/social-recruitment/step/94904"};
import {createMokaSite} from '../shared/moka.mjs';
export const createSiteSlot = port => createMokaSite(port,manifest);
