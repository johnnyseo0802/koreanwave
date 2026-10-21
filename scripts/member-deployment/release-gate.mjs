// Trusted operator module, NOT an app endpoint or automatic deployment hook.
// No credentials, defaults, process.env access, logging or invocation on import.
// request is a credential-bearing, read-only Vercel API adapter supplied locally.
import fs from 'node:fs';
import { buildPackage, unwrap } from './package.mjs';
import { loginDestination, verifyStreamRedirect } from './stream-redirect.mjs';

export function vercelReader(token, teamId, fetcher = fetch) {
  if (typeof token !== 'string' || !token || !/^team_[A-Za-z0-9]+$/.test(teamId)) throw Error('VERCEL_CONFIGURATION_INVALID');
  return async path => {
    if (!/^\/v4\/aliases\/kgroov\.com$|^\/v13\/deployments\/dpl_[A-Za-z0-9]+$/.test(path)) throw Error('VERCEL_READ_PATH_DENIED');
    try {
      const response = await fetcher(`https://api.vercel.com${path}?teamId=${encodeURIComponent(teamId)}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw Error();
      const value = await response.json();
      // Never return environment/build/private response fields to the runner.
      return path.startsWith('/v4/')
        ? { projectId: value.projectId, deployment: { id: value.deployment?.id }, redirect: value.redirect, deletedAt: value.deletedAt }
        : { id: value.id, projectId: value.projectId, target: value.target, readyState: value.readyState, meta: { githubCommitSha: value.meta?.githubCommitSha } };
    } catch { throw Error('VERCEL_READ_UNAVAILABLE'); }
  };
}

export async function verifyPublicApplication(fetcher = fetch) {
  // Read-only, anonymous smoke; never sends Vercel/DB credentials to the app.
  try {
    for (const path of ['/', '/community', '/admin/community', '/admin/member-policy']) {
      const response = await fetcher(`https://kgroov.com${path}`, { method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (path.startsWith('/admin/')) {
        if (response.redirected) throw Error();
        if ([302,303,307,308].includes(response.status)) loginDestination(response.headers.get('location'));
        else {
          if (response.status !== 200 || response.headers.has('location')
              || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw Error();
          const reader = response.body?.getReader();
          if (!reader) throw Error();
          const chunks = []; let bytes = 0;
          try {
            for (;;) {
              const {done, value} = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > 512 * 1024) throw Error();
              chunks.push(value);
            }
          } finally { await reader.cancel().catch(() => {}); }
          verifyStreamRedirect(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)), path);
        }
      } else if (response.status !== 200 || !(await response.text()).includes('KGROOV')) throw Error();
    }
  } catch { throw Error('NEW_APPLICATION_SMOKE_FAILED'); }
}

export async function verifyDeployment(request, { sha, projectId, domain }) {
  if (!/^[0-9a-f]{40}$/.test(sha) || !/^prj_[A-Za-z0-9]+$/.test(projectId)
      || domain !== 'kgroov.com') throw Error('RELEASE_CONFIGURATION_INVALID');
  const alias = await request(`/v4/aliases/${domain}`);
  const deploymentId = alias?.deployment?.id;
  if (!/^dpl_[A-Za-z0-9]+$/.test(deploymentId ?? '') || alias.projectId !== projectId || alias.redirect || alias.deletedAt)
    throw Error('CURRENT_DOMAIN_UNVERIFIED');
  const deployment = await request(`/v13/deployments/${deploymentId}`);
  if (deployment.id !== deploymentId || deployment.projectId !== projectId
      || deployment.target !== 'production' || deployment.readyState !== 'READY'
      || deployment.meta?.githubCommitSha !== sha)
    throw Error('NEW_APPLICATION_NOT_READY');
  // Re-read alias to reject a switch during verification. Later changes remain
  // protected by DB RPC-only rules even if an old application is restored.
  const current = await request(`/v4/aliases/${domain}`);
  if (current?.deployment?.id !== deploymentId || current.projectId !== projectId)
    throw Error('CURRENT_DOMAIN_CHANGED');
  return deploymentId;
}

export async function releaseGate(db, request, config, root, appFetch = fetch) {
  if (!/^[0-9a-f]{40}$/.test(config.previousSha ?? '') || config.sha === config.previousSha)
    throw Error('NEW_REVIEWED_COMMIT_REQUIRED');
  const pkg = buildPackage(root); // exact reviewed A+B byte hashes
  const gate = (await db.query('select activation,candidate_sha from member_deployment.gate where singleton')).rows[0];
  if (!gate || !gate.candidate_sha || gate.candidate_sha !== config.sha)
    throw Error('CANDIDATE_NOT_PINNED');
  // Bound network work, without holding a DB lock. The adapter must also use
  // HTTPS, reject redirects, enforce a timeout and never print raw responses.
  let timer;
  let deploymentId;
  try {
    deploymentId = await Promise.race([
      (async () => {
        const before = await verifyDeployment(request, config);
        await verifyPublicApplication(appFetch);
        if (await verifyDeployment(request, config) !== before) throw Error();
        return before;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error()), 30000); }),
    ]);
  } catch { throw Error('APPLICATION_VERIFICATION_FAILED_GATE_REMAINS'); }
  finally { clearTimeout(timer); }
  await db.query('begin');
  try {
    await db.query("set local lock_timeout='5s';set local statement_timeout='60s'");
    const current = (await db.query('select activation,candidate_sha from member_deployment.gate where singleton for update')).rows[0];
    if (!current || current.activation !== gate.activation || current.candidate_sha !== config.sha)
      throw Error('GATE_CHANGED');
    for (const entry of pkg.entries) {
      const row = (await db.query('select name,statements from supabase_migrations.schema_migrations where version=$1', [entry.version])).rows[0];
      if (!row || row.name !== entry.name || row.statements?.length !== 1 || row.statements[0] !== entry.body)
        throw Error('MIGRATION_HISTORY_MISMATCH');
    }
    await db.query('update member_deployment.gate set verified_sha=$1,verified_deployment=$2,verified_at=clock_timestamp() where singleton', [config.sha, deploymentId]);
    await db.query(unwrap(fs.readFileSync(new URL('./gate-off.sql', import.meta.url), 'utf8')));
    await db.query('commit');
  } catch {
    await db.query('rollback');
    throw Error('RELEASE_DENIED_GATE_REMAINS');
  }
}
