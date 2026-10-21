// Offline regression for the hosted permission and business-conflict fixes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPackage} from '../scripts/member-deployment/package.mjs';
const on=fs.readFileSync('scripts/member-deployment/gate-on.sql','utf8');
const off=fs.readFileSync('scripts/member-deployment/gate-off.sql','utf8');
assert.doesNotMatch(on,/alter table storage\.objects|alter.*owner\s+to|set\s+role\s+supabase_storage_admin/i);
assert.doesNotMatch(off,/drop trigger .* on storage\.objects/i);
assert.match(on,/has_parameter_privilege\(oid,'session_replication_role','SET'\)/);
assert.match(on,/select storage_frozen into frozen from member_deployment\.gate where singleton for share/);
assert.match(on,/coalesce\(frozen,true\)/);
assert.match(on,/tgenabled='O'.*reject_storage_write/);
assert.match(on,/revoke all on all functions in schema member_deployment from public,anon,authenticated,service_role/);
assert.match(off,/Verified new application required/);
assert.match(off,/perform member_deployment\.assert_guards\(true\)/);
assert.match(off,/storage_frozen=false/);
const pkg=buildPackage(process.cwd());
for(const e of pkg.entries){assert.doesNotMatch(e.body,/errcode='40001'/);assert.match(e.body,/errcode='PT409'/);}
// Existing action treats ALL RPC errors as failure; no automatic retry added.
const actions=fs.readFileSync('src/app/community/member-actions.ts','utf8');
assert.match(actions,/if\(r\.error\|\|r\.data\?\.id!==id\)return failure/);
assert.doesNotMatch(actions,/retry\s*\(|setTimeout|while\s*\(/);
console.log('PASS: hosted Storage guard privilege contract, fail-closed gate and non-retrying business conflict codes.');
