export const manifest = {"id": "nvidia", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "domains": ["jobs.nvidia.com"], "entry_url": "https://jobs.nvidia.com/careers", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "keyword_mode": "native", "company": "NVIDIA", "path_prefix": "/careers"};
import {createEightfoldSite} from '../shared/international.mjs';
export const createSiteSlot = port => createEightfoldSite(port,manifest);
