// This module only reads account/game snapshots. It never changes save behavior.
export type BoardGame={snapshot:string;value:number};
type Account={id:string;is_anonymous?:boolean};
export type AttributionApi={identity():Promise<Account|null>;savedGame(id:string):Promise<{user_id:string;game_state:unknown}|null>;current():BoardGame|null};
function ordered(value:unknown):unknown {
 if(Array.isArray(value))return value.map(ordered);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordered(v)]));
 return value;
}
export function sameBoardSnapshot(a:unknown,b:unknown){return JSON.stringify(ordered(a))===JSON.stringify(ordered(b));}
export async function attributedPeak(expected:string,api:AttributionApi):Promise<number>{
 const game=api.current();
 if(!game)throw Error('Open your saved game before publishing.');
 const user=await api.identity();
 if(!user||user.id!==expected||user.is_anonymous)throw Error('Sign in with the account that owns this saved game.');
 const row=await api.savedGame(expected);
 if(!row||row.user_id!==expected||!sameBoardSnapshot(row.game_state,JSON.parse(game.snapshot)))throw Error('Your displayed game must match this account’s cloud save. Resolve the existing save choice or wait for cloud sync, then publish again.');
 const finalUser=await api.identity();
 const latest=api.current();
 if(!finalUser||finalUser.id!==expected||finalUser.is_anonymous||!latest||latest.snapshot!==game.snapshot)throw Error('Account or game changed during verification. No score was submitted.');
 if(!Number.isSafeInteger(game.value)||game.value<0||game.value>1_000_000_000_000)throw Error('Valuation is outside the supported range.');
 return game.value;
}
