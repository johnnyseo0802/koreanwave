// Pure builder. No network, credentials, or execution on import.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const inventory=[
 ['20261018000000','member_content_management','77b1a16f1b937bf5dcff48d8cdab3f0800fcd42df89593de2eb949fbea5cba7f'],
 ['20261018010000','selective_community_publication','0bd7e357d1d2b398df8184b354c3c769d22522ce62304b1a3ce470d3c4a79885'],
];
export function unwrap(text){
 const lines=text.replaceAll('\r\n','\n').trimEnd().split('\n');
 const first=lines.findIndex(x=>/^begin;\s*$/i.test(x));
 if(first<0||!/^commit;\s*$/i.test(lines.at(-1)))throw Error('TRANSACTION_WRAPPER_MISMATCH');
 lines.splice(first,1);lines.pop();
 if(lines.some(x=>/^\s*(begin|commit|rollback);\s*$/i.test(x)))throw Error('NESTED_TRANSACTION_REJECTED');
 return lines.join('\n');
}
const quote=s=>"'"+s.replaceAll("'","''")+"'";
export function buildPackage(root){
 const entries=inventory.map(([version,name,expected])=>{
  const raw=fs.readFileSync(path.join(root,'supabase/migrations',version+'_'+name+'.sql'));
  if(createHash('sha256').update(raw).digest('hex')!==expected)throw Error('REVIEWED_MIGRATION_HASH_MISMATCH');
  return {version,name,body:unwrap(raw.toString('utf8'))};
 });
 const history=`select member_deployment.assert_guards(false);
 create schema if not exists supabase_migrations;
 revoke all on schema supabase_migrations from public,anon,authenticated,service_role;
 create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
 revoke all on supabase_migrations.schema_migrations from public,anon,authenticated,service_role;
 do $$ begin
 if exists(select 1 from supabase_migrations.schema_migrations where version in ('20261018000000','20261018010000'))
 then raise exception 'Already recorded; inspect instead of retrying';end if;
 end $$;`;
 const chunks=entries.map(e=>e.body+'\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('+quote(e.version)+','+quote(e.name)+',array['+quote(e.body)+']);');
 // The caller MUST own the single transaction (psql --single-transaction).
 return {entries,sql:"set local lock_timeout='5s';\nset local statement_timeout='60s';\n"+history+'\n'+chunks.join('\n')+"\nselect member_deployment.install_guards(true);\nselect member_deployment.assert_guards(true);\nnotify pgrst,'reload schema';\n"};
}
