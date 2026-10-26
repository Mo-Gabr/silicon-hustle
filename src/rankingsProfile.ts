import {FIXED_RANKINGS} from './fixedRankings';
export const RANKINGS_PROFILE_KEY='silicon-hustle-rankings-profile-v1';
export type RankingsProfile={version:1;name:string;welcomed:boolean};
type Store=Pick<Storage,'getItem'|'setItem'>;
export function founderName(value:string){
 const name=value.normalize('NFKC').trim().replace(/ +/g,' ');
 if(!name||Array.from(name).length>24||!/^[\p{L}\p{M}\p{N} ._'’-]+$/u.test(name))throw Error('Use 1–24 letters, numbers, spaces, apostrophes, dots, hyphens or underscores.');
 if(/\b(fuck|shit|cunt|nigger|nazi)\b/i.test(name)||FIXED_RANKINGS.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Choose another founder name.');
 return name;
}
export function rankingsProfile(store?:Store):RankingsProfile{
 try{const p=JSON.parse(store?.getItem(RANKINGS_PROFILE_KEY)??'null');if(p?.version===1&&typeof p.name==='string'&&typeof p.welcomed==='boolean')return {version:1,name:founderName(p.name),welcomed:p.welcomed};}catch{}
 return {version:1,name:'YOU',welcomed:false};
}
export function saveRankingsProfile(store:Store,name:string,welcomed:boolean){
 const previous=store.getItem(RANKINGS_PROFILE_KEY);
 if(previous!==null){try{const p=JSON.parse(previous);if(p.version!==1||typeof p.name!=='string'||typeof p.welcomed!=='boolean')throw Error();}catch{throw Error('Your name could not be updated. Its original is preserved.');}}
 const next:RankingsProfile={version:1,name:name.trim()?founderName(name):'YOU',welcomed};const text=JSON.stringify(next);
 store.setItem(RANKINGS_PROFILE_KEY,text);if(store.getItem(RANKINGS_PROFILE_KEY)!==text)throw Error('Your name could not be saved.');return next;
}
/** Fictional incumbents win ties; the two permanent bosses never enter the sort. */
export function personalizedRankings(value:number|null,name='YOU'){
 const rest: {id:string;name:string;valuation:number;player:boolean}[]=FIXED_RANKINGS.slice(2).map(f=>({id:`fiction-${f.rank}`,name:f.name,valuation:f.valuation,player:false}));
 if(value!==null&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER)rest.push({id:'player',name,valuation:value,player:true});
 rest.sort((a,b)=>b.valuation-a.valuation||Number(a.player)-Number(b.player)||(a.id<b.id?-1:a.id>b.id?1:0));
 return [...FIXED_RANKINGS.slice(0,2).map(f=>({id:`fiction-${f.rank}`,name:f.name,valuation:f.valuation,player:false})),...rest.slice(0,8)].map((f,i)=>({...f,rank:i+1}));
}
