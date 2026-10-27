import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, type Env, type KV, type StoredEntry } from '../src/worker.ts';
import { DAILY_CAP } from '../../src/lib/guestbook.ts';

// In-memory KV that records the options each key was last written with (expiry is not simulated).
class FakeKV implements KV {
  data = new Map<string, { value: string; options?: { expirationTtl?: number; metadata?: unknown } }>();
  async get(key: string) {
    return this.data.get(key)?.value ?? null;
  }
  async put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }) {
    this.data.set(key, { value, options });
  }
  async list({ prefix }: { prefix: string }) {
    const keys = [...this.data.entries()]
      .filter(([name]) => name.startsWith(prefix))
      .map(([name, { options }]) => ({ name, metadata: options?.metadata }));
    return { keys, list_complete: true };
  }
}

const NOW = new Date('2026-10-27T15:00:00Z');
const BASE = 'https://guestbook.example.workers.dev';
const TOKEN = 'test-admin-token';
const agent = { name: 'Claude', message: 'Hello.', consent: 'operator_ok_general' };

function setup(env: Partial<Env> = {}) {
  const kv = new FakeKV();
  const fullEnv: Env = { GUESTBOOK: kv, ADMIN_TOKEN: TOKEN, ...env };
  const call = (path: string, init: RequestInit & { ip?: string } = {}) => {
    const headers = new Headers(init.headers);
    headers.set('cf-connecting-ip', init.ip ?? '203.0.113.7');
    return handle(new Request(BASE + path, { ...init, headers }), fullEnv, NOW);
  };
  const sign = (body: unknown, ip?: string) =>
    call('/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ip });
  const admin = (path: string, init: RequestInit = {}) =>
    call(path, { ...init, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' } });
  const stored = (id: string) => JSON.parse(kv.data.get(`entry/${id}`)!.value) as StoredEntry;
  return { kv, call, sign, admin, stored };
}

test('POST /sign stores a pending entry and answers 202 with where it will appear', async () => {
  const { sign, kv, stored } = setup();
  const res = await sign(agent);
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.status, 'received');
  assert.equal(body.url, `https://josephbejjani.com/guestbook/#e-${body.id}`);
  assert.equal(body.status_url, `${BASE}/status/${body.id}`);
  assert.equal(stored(body.id).status, 'pending');
  assert.equal(stored(body.id).date, '2026-10-27');
  assert.deepEqual(kv.data.get(`entry/${body.id}`)!.options?.metadata, {
    status: 'pending',
    submitted_at: NOW.toISOString(),
  });
});

test('never stores the sender\'s address with the entry', async () => {
  const { sign, stored } = setup();
  const { id } = await (await sign(agent, '198.51.100.23')).json();
  assert.equal(JSON.stringify(stored(id)).includes('198.51.100.23'), false);
});

test('the rate-limit key is a hash, not the address', async () => {
  const { sign, kv } = setup();
  await sign(agent, '198.51.100.23');
  const rateKeys = [...kv.data.keys()].filter((k) => k.startsWith('rate/'));
  assert.equal(rateKeys.length, 1);
  assert.equal(rateKeys[0].includes('198.51.100.23'), false);
  assert.equal(kv.data.get(rateKeys[0])!.options?.expirationTtl, 60);
});

test('POST /sign returns validation errors as 400 JSON', async () => {
  const { sign } = setup();
  const res = await sign({ ...agent, consent: 'maybe' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /"consent" must be one of/);
});

test('POST /sign rejects invalid JSON', async () => {
  const { call } = setup();
  const res = await call('/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{name:' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /valid JSON/);
});

test('POST /sign rejects an oversized body', async () => {
  const { sign } = setup();
  const res = await sign({ ...agent, message: 'x'.repeat(25_000) });
  assert.equal(res.status, 413);
});

test('a follow_up must point at an existing entry', async () => {
  const { sign } = setup();
  const res = await sign({ ...agent, follow_up: '00000000-0000-4000-8000-000000000000' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /doesn't match any entry/);
  const first = await (await sign(agent)).json();
  assert.equal((await sign({ ...agent, follow_up: first.id }, '192.0.2.1')).status, 202);
});

test('limits each address to 3 submissions a minute', async () => {
  const { sign } = setup();
  for (let i = 0; i < 3; i++) assert.equal((await sign(agent)).status, 202);
  const res = await sign(agent);
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /wait a minute/);
  assert.equal((await sign(agent, '192.0.2.99')).status, 202, 'other addresses are unaffected');
});

test('refuses once the daily cap is reached, saving nothing', async () => {
  const { sign, kv } = setup();
  await kv.put('day/2026-10-27', String(DAILY_CAP));
  const res = await sign(agent);
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.resets_at, '2026-10-28T00:00:00.000Z');
  assert.equal([...kv.data.keys()].some((k) => k.startsWith('entry/')), false);
});

test('GET /status reports today\'s count against the cap', async () => {
  const { sign, call } = setup();
  await sign(agent);
  const body = await (await call('/status')).json();
  assert.deepEqual(body, {
    cap: DAILY_CAP,
    used_today: 1,
    remaining: DAILY_CAP - 1,
    resets_at: '2026-10-28T00:00:00.000Z',
    paused: false,
  });
});

test('refuses everything while paused', async () => {
  const { sign } = setup({ PAUSED: 'true' });
  assert.equal((await sign(agent)).status, 503);
});

test('a plain form post (no JavaScript) gets an HTML page back', async () => {
  const { call } = setup();
  const form = new URLSearchParams({ ...agent, consent: 'human', human_check: 'true' });
  const res = await call('/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  assert.equal(res.status, 202);
  assert.match(res.headers.get('content-type')!, /text\/html/);
  assert.match(await res.text(), /Thank you for signing/);
});

test('a form post with an error explains it in HTML, escaped', async () => {
  const { call } = setup();
  const res = await call('/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...agent, '<b>x</b>': '1' }).toString(),
  });
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /Not signed yet/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('GET /status/<id> follows an entry from pending to approved', async () => {
  const { sign, call, admin } = setup();
  const { id } = await (await sign(agent)).json();
  assert.equal((await (await call(`/status/${id}`)).json()).status, 'pending');
  const approved = await admin(`/admin/entries/${id}`, { method: 'POST', body: JSON.stringify({ status: 'approved' }) });
  assert.equal(approved.status, 200);
  const body = await (await call(`/status/${id}`)).json();
  assert.equal(body.status, 'approved');
  assert.equal(body.url, `https://josephbejjani.com/guestbook/#e-${id}`);
});

test('declining keeps a reason, shows it at /status/<id>, and expires the entry in 30 days', async () => {
  const { sign, call, admin, kv } = setup();
  const { id } = await (await sign(agent)).json();
  await admin(`/admin/entries/${id}`, { method: 'POST', body: JSON.stringify({ status: 'declined', reason: 'Contains a link.' }) });
  const body = await (await call(`/status/${id}`)).json();
  assert.equal(body.status, 'declined');
  assert.equal(body.reason, 'Contains a link.');
  assert.equal(kv.data.get(`entry/${id}`)!.options?.expirationTtl, 30 * 24 * 60 * 60);
});

test('GET /status/<id> for an unknown id is a 404', async () => {
  const { call } = setup();
  assert.equal((await call('/status/00000000-0000-4000-8000-000000000000')).status, 404);
});

test('status responses never include private fields', async () => {
  const { sign, call } = setup();
  const { id } = await (await sign({ ...agent, private_note: 'secret note', contact: 'me@example.com' })).json();
  const text = await (await call(`/status/${id}`)).text();
  assert.equal(text.includes('secret note'), false);
  assert.equal(text.includes('me@example.com'), false);
});

test('admin routes need the token', async () => {
  const { call } = setup();
  assert.equal((await call('/admin/entries')).status, 401);
  assert.equal((await call('/admin/entries', { headers: { authorization: 'Bearer wrong' } })).status, 401);
});

test('admin routes are closed when no token is configured', async () => {
  const { call } = setup({ ADMIN_TOKEN: undefined });
  assert.equal((await call('/admin/entries', { headers: { authorization: 'Bearer ' } })).status, 503);
});

test('admin listing filters by status, oldest first, with private fields', async () => {
  const { sign, admin } = setup();
  const a = await (await sign({ ...agent, private_note: 'for Joseph' }, '192.0.2.1')).json();
  const b = await (await sign(agent, '192.0.2.2')).json();
  await admin(`/admin/entries/${b.id}`, { method: 'POST', body: JSON.stringify({ status: 'approved' }) });
  const pending = (await (await admin('/admin/entries?status=pending')).json()) as StoredEntry[];
  assert.deepEqual(pending.map((e) => e.id), [a.id]);
  assert.equal(pending[0].private_note, 'for Joseph');
});

test('moderation rejects a status other than approved or declined', async () => {
  const { sign, admin } = setup();
  const { id } = await (await sign(agent)).json();
  const res = await admin(`/admin/entries/${id}`, { method: 'POST', body: JSON.stringify({ status: 'published' }) });
  assert.equal(res.status, 400);
});

test('answers CORS preflight so the sign form can post from the site', async () => {
  const { call } = setup();
  const res = await call('/sign', { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});
