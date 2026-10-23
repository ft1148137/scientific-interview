export const manifest = {"id": "didi-campus", "kind": "site", "version": "1.0.0", "protocol_version": 1, "entry": "adapter.mjs", "company": "滴滴", "domains": ["campus.didiglobal.com"], "entry_url": "https://campus.didiglobal.com/campus_apply/didiglobal/96064#/jobs", "requires": ["navigate", "observe", "click", "wait"], "search_fields": ["keyword"], "path_prefix": "/campus_apply/didiglobal/96064"};
import {createMokaSite} from '../shared/moka.mjs';
export const createSiteSlot = port => createMokaSite(port,manifest);
