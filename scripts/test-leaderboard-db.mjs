// Deliberately ignores .env files, PGHOST, PGDATABASE, services and password files.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const psql='/Applications/Postgres.app/Contents/Versions/18/bin/psql';
const args=['-X','-w','-h','127.0.0.1','-p','5432','-d','silicon_hustle_test','-v','ON_ERROR_STOP=1'];
const env={PATH:process.env.PATH,PGPASSFILE:'/nonexistent/silicon-hustle-no-password-file',PGCONNECT_TIMEOUT:'5',PGAPPNAME:'silicon-hustle-leaderboard-tests'};
function run(extra){
 const result=spawnSync(psql,[...args,...extra],{env,encoding:'utf8',timeout:60000});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(result.stderr||result.stdout);
 return result;
}
const fingerprint=()=>run(['-At','-c',`select jsonb_build_object('board',coalesce((select jsonb_agg(to_jsonb(b) order by user_id) from public.billionaire_board b),'[]'::jsonb),'users',coalesce((select jsonb_agg(id order by id) from auth.users),'[]'::jsonb))`]).stdout;
// Verify the installed function bodies match the reviewed migration, without applying it.
const migration=readFileSync(new URL('../supabase/migrations/202610150002_billionaire_board.sql',import.meta.url),'utf8');
for(const name of ['get_billionaire_board','submit_billionaire_score']){
 const body=migration.match(new RegExp('create function public\\.'+name+'\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;'))?.[1];
 const installed=JSON.parse(run(['-At','-c',`select to_json(prosrc) from pg_proc where pronamespace='public'::regnamespace and proname='${name}'`]).stdout);
 if(!body||body.trim()!==installed.trim())throw new Error(`FAIL: installed ${name} differs from migration`);
}
console.log('PASS: installed RPC bodies match migration (no migration applied)');
const before=fingerprint();
try{
 const result=run(['-f',fileURLToPath(new URL('../supabase/tests/billionaire_board.sql',import.meta.url))]);
 process.stdout.write(result.stderr); // Only assertion notices, no private rows.
 console.log('PASS: rollback-only SQL integration suite');
}finally{
 if(fingerprint()!==before)throw new Error('FAIL: existing leaderboard/auth ID fingerprint changed');
 console.log('PASS: leaderboard rows and auth IDs identical before/after');
}
