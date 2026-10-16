// Keep deployment configuration failures distinct from real PostgREST errors.
// Diagnostics contain variable names/codes only, never their values.
export type RankingsConfiguration={ready:boolean;missing:string[];invalid:boolean};
export function rankingsConfiguration(url:unknown,key:unknown):RankingsConfiguration {
 const missing=[];
 if(typeof url!=='string'||!url.trim())missing.push('VITE_SUPABASE_URL');
 if(typeof key!=='string'||!key.trim())missing.push('VITE_SUPABASE_ANON_KEY');
 let invalid=false;
 if(!missing.includes('VITE_SUPABASE_URL')){
  try{const parsed=new URL(url as string);invalid=parsed.protocol!=='https:'||!!parsed.username||!!parsed.password||!!parsed.search||!!parsed.hash||parsed.pathname!=='/';}catch{invalid=true;}
 }
 return {ready:missing.length===0&&!invalid,missing,invalid};
}
export function requireRankingsClient<T>(client:T|null,configuration:RankingsConfiguration):T {
 if(!configuration.ready||!client)throw {code:'RANKINGS_CONFIGURATION',message:'Rankings configuration is unavailable.'};
 return client;
}
export function rankingsFailure(error:unknown):{status:'unavailable'|'error';error:string} {
 const code=(error as {code?:string})?.code;
 if(code==='RANKINGS_CONFIGURATION')return {status:'unavailable',error:'Rankings is not configured for this deployment. Your game and saved progress are unchanged.'};
 if(['PGRST202','42P01','42883'].includes(code??''))return {status:'unavailable',error:'Rankings could not be reached in the configured service. Your game and saved progress are unchanged.'};
 if(['42501','PGRST301','PGRST302','PGRST303'].includes(code??''))return {status:'error',error:'Rankings access was denied. Check your sign-in and try again.'};
 if(code==='P0001')return {status:'error',error:'Please wait 10 seconds between Rankings updates.'};
 if(code==='22023')return {status:'error',error:'Rankings rejected this score or name. Check your entry and try again.'};
 return {status:'error',error:'Rankings is unavailable. Your game and personal best are kept; try again later.'};
}
