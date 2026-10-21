// Fail-closed contract for the reviewed Next 16.3 loading/error stream, not a
// general HTML/Flight parser. A changed framework envelope requires re-review.
// Never executes scripts or returns/logs response bodies.
const origin = 'https://kgroov.com';
const login = '/login?next=/admin/community'; // Both reviewed admin pages use this.

export function loginDestination(value) {
  if (typeof value !== 'string' || !value || /[\\\s\u0000-\u001f]/.test(value)) throw Error();
  const url = new URL(value, origin);
  if (url.origin !== origin || url.username || url.password || url.hash
      || !['/login', login, '/login?next=%2Fadmin%2Fcommunity'].includes(url.pathname + url.search)) throw Error();
  return url;
}

export function verifyStreamRedirect(html, path) {
  if (!['/admin/community', '/admin/member-policy'].includes(path)
      || typeof html !== 'string' || Buffer.byteLength(html) > 512 * 1024
      || !html.endsWith('</body></html>') || /<(?:base|iframe|object|embed|style)\b/i.test(html)) throw Error();
  let flight = '';
  // Remove only the exact, reviewed Next inline push syntax; no eval, no loose
  // NEXT_REDIRECT substring check. Other executable inline content is rejected.
  const markup = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (_, attrs, text) => {
    if (/^ src="\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js"(?: id="_R_")?(?: async=""| noModule="")?$/.test(attrs) && !text) return '';
    if (attrs) throw Error();
    if (text === '(self.__next_f=self.__next_f||[]).push([0])') return '';
    const match = /^self\.__next_f\.push\((\[1,"[\s\S]*"\])\)$/.exec(text);
    if (!match) throw Error();
    const part = JSON.parse(match[1]);
    if (part.length !== 2 || typeof part[1] !== 'string') throw Error();
    flight += part[1];
    return '';
  }).replace(/<!--[\s\S]*?-->/g, '');
  if (/<script\b/i.test(markup)) throw Error();
  const envelope = /^<!DOCTYPE html><html(?: lang="en" class="[A-Za-z0-9 -]+")?><head>([\s\S]*?)<\/head><body(?: class="[A-Za-z0-9 -]+")?>([\s\S]*)<\/body><\/html>$/.exec(markup);
  if (!envelope || envelope[1].replace(/<title>[^<>]*<\/title>|<(?:meta|link)\b[^<>]*\/>/g, '') !== '') throw Error();
  const metas = [...markup.matchAll(/<meta\b[^>]*>/g)].filter(m => /refresh|__next-page-redirect/i.test(m[0]));
  const meta = /^<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=([^"<>]+)"\/>$/.exec(metas[0]?.[0] ?? '');
  if (metas.length !== 1 || !meta || loginDestination(meta[1]).pathname + loginDestination(meta[1]).search !== login) throw Error();
  const digest = `NEXT_REDIRECT;replace;${login};307;`;
  const template = `<template data-dgst="${digest}"></template>`;
  if ((markup.match(/<template\b/gi) ?? []).length !== 1) throw Error();
  const body = envelope[2];
  if (!body || body.split(template).length !== 2) throw Error();
  // Only the reviewed anonymous loading shell may be rendered. This rejects
  // protected content even when accompanied by a valid redirect (also hidden).
  const shell = body.replace(template, '');
  if (!/^<div hidden=""><\/div><a href="#main-content" class="skip-link">Skip to content<\/a><main id="main-content" class="[A-Za-z0-9 #[\]_:.-]+" aria-busy="true"><p role="status" class="[A-Za-z0-9 #[\]_:.-]+">Loading KGROOV…<\/p><div aria-hidden="true" class="[A-Za-z0-9 #[\]_:.-]+"><\/div><\/main>$/.test(shell)) throw Error();

  const records = new Map();
  for (const line of flight.split('\n').filter(Boolean)) {
    if (line.startsWith(':HL')) { JSON.parse(line.slice(3)); continue; }
    const match = /^([0-9a-f]+):(.*)$/.exec(line);
    if (!match) throw Error();
    const [, id, raw] = match;
    if (records.has(id) && !(records.get(id).raw === 'X' && raw === 'C')) throw Error();
    const type = /^[IE]/.test(raw) ? raw[0] : '';
    const value = ['X', 'C'].includes(raw) ? null : JSON.parse(type ? raw.slice(1) : raw);
    records.set(id, {raw, type, value});
    const inspect = v => {
      if (!v || typeof v !== 'object') return;
      for (const [key, val] of Object.entries(v)) {
        if (['body','author_id','access_token','refresh_token','review_reason','rows','reports'].includes(key)
            || (key === 'initialAuthenticated' && val !== false)) throw Error();
        inspect(val);
      }
    };
    inspect(value);
  }
  const root = records.get('0')?.value;
  if (root?.c?.join('/') !== path || root.f?.length !== 1) throw Error();
  let seed = root.f[0][1];
  for (let depth = 0; seed?.[1]?.children && depth < 8; depth++) seed = seed[1].children;
  const ref = seed?.[0]?.[3]?.children?.[0];
  if (typeof ref !== 'string' || !/^\$L[0-9a-f]+$/.test(ref)) throw Error();
  const page = records.get(ref.slice(2));
  if (page?.type !== 'E' || page.value?.digest !== digest
      || Object.keys(page.value).length !== 1
      || [...records.values()].filter(r => r.type === 'E').length !== 1) throw Error();
  const reached = new Set();
  const visit = id => {
    if (reached.has(id)) return;
    const row = records.get(id);
    if (!row) throw Error();
    reached.add(id);
    const walk = v => {
      if (typeof v === 'string') {
        const m = /^\$(?:L|@)?([0-9a-f]+)$/.exec(v);
        if (m) visit(m[1]);
      } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(row.value);
  };
  visit('0');
  if (reached.size !== records.size) throw Error(); // No orphan payload/data.
}
