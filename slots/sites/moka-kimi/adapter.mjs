export const manifest = {"id": "moka-kimi", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "Kimi", "domains": ["app.mokahr.com"], "entry_url": "https://app.mokahr.com/apply/moonshot/148506#/jobs", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "path_prefix": "/apply/moonshot/148506"};
import {createMokaSite} from '../shared/moka.mjs';
export const createSiteSlot = port => createMokaSite(port,manifest);
