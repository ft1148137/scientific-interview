export const manifest = {"id": "anthropic", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["job-boards.greenhouse.io"], "entry_url": "https://job-boards.greenhouse.io/anthropic", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "Anthropic", "path_prefix": "/anthropic"};
import {createGreenhouseSite} from '../shared/international.mjs';
export const createSiteSlot = port => createGreenhouseSite(port,manifest);
