/** Display-only compatibility reader. Never imports account or Rankings identities. */
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const nameFields=['founderName','displayName','playerName','founder_name','display_name','player_name'];
export function localFounderName(state:unknown):string{
 if(!record(state))return 'Founder';
 const profile=record(state.profile)?state.profile:null;
 const candidates=[...(profile?[...nameFields.map(key=>profile[key]),profile.name]:[]),...nameFields.map(key=>state[key])];
 for(const candidate of candidates)if(typeof candidate==='string'&&candidate.trim())return candidate.trim();
 return 'Founder';
}
