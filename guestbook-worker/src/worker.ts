// The guestbook's signing endpoint, a Cloudflare Worker. It only receives and holds submissions;
// approved entries are published by committing them to src/data/guestbook.yaml (npm run guestbook).
//
// Public:  POST /sign            submit an entry (JSON, or a plain form post)
//          GET  /status          today's count against the daily cap
//          GET  /status/<id>     pending | approved | declined
// Admin:   GET  /admin/entries?status=pending           (Authorization: Bearer <ADMIN_TOKEN>)
//          POST /admin/entries/<id>  {"status": "approved" | "declined", "reason"?: "..."}
//
// Storage (one KV namespace): entry/<id> holds a submission, with its status in the key's metadata so
// listing needs no extra reads. day/<date> counts today's submissions. rate/<hash> is a one-minute
// counter per address; the address is hashed and never stored with an entry.
import { DAILY_CAP } from '../../src/lib/guestbook.ts';
import { validate, type Submission } from './validate.ts';

// The slice of Cloudflare's KV API this Worker uses, declared here so no Workers type package is needed.
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface Env {
  GUESTBOOK: KV;
  ADMIN_TOKEN?: string; // a secret: `wrangler secret put ADMIN_TOKEN`
  PAUSED?: string; // "true" turns signing off, e.g. during a flood
  SITE_URL?: string; // defaults to the production site
}

export type Status = 'pending' | 'approved' | 'declined';
export type StoredEntry = Submission & {
  id: string;
  date: string; // YYYY-MM-DD (UTC), shown on the entry
  submitted_at: string; // full ISO timestamp
  status: Status;
  reason?: string; // why it was declined, shown at /status/<id>
};

const PER_MINUTE = 3; // submissions per address per minute
const MAX_BODY = 20_000; // bytes
const DECLINED_TTL = 30 * 24 * 60 * 60; // declined entries are deleted after 30 days

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const json = (body: unknown, status = 200, headers: Record<string, string> = CORS) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// A form post without JavaScript lands on this page, so it answers in HTML, not JSON.
const page = (title: string, paragraphs: string[], back: string, status: number) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>${escapeHtml(title)}</title><style>body{font:19px/1.6 Georgia,serif;max-width:640px;margin:4rem auto;padding:0 20px;color:#1a1a1a}a{color:#1f4e8c}</style></head>` +
      `<body><h1 style="font-size:24px;font-weight:500">${escapeHtml(title)}</h1>` +
      paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('') +
      `<p><a href="${escapeHtml(back)}">Back to the guestbook</a></p></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

const today = (now: Date) => now.toISOString().slice(0, 10);
const nextMidnight = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison, so the admin token can't be guessed one character at a time.
function sameToken(given: string, expected: string) {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function usedToday(env: Env, now: Date) {
  return Number((await env.GUESTBOOK.get(`day/${today(now)}`)) ?? 0);
}

async function readEntry(env: Env, id: string) {
  const raw = await env.GUESTBOOK.get(`entry/${id.toLowerCase()}`);
  return raw ? (JSON.parse(raw) as StoredEntry) : null;
}

async function writeEntry(env: Env, entry: StoredEntry) {
  await env.GUESTBOOK.put(`entry/${entry.id}`, JSON.stringify(entry), {
    metadata: { status: entry.status, submitted_at: entry.submitted_at },
    ...(entry.status === 'declined' && { expirationTtl: DECLINED_TTL }),
  });
}

async function sign(request: Request, env: Env, now: Date, site: string) {
  const type = request.headers.get('content-type') ?? '';
  const isForm = type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data');
  const back = `${site}/guestbook/sign/`;
  // Same outcome either way; only the wrapping differs.
  const reply = (status: number, body: Record<string, unknown>) =>
    isForm
      ? page(
          status === 202 ? 'Thank you for signing' : 'Not signed yet',
          status === 202
            ? [String(body.note), `Your entry's id is ${body.id}. Keep it if you'd like to send a follow-up later.`]
            : [String(body.error), 'Use your browser\'s back button to return to the form; your text should still be there.'],
          status === 202 ? `${site}/guestbook/` : back,
          status,
        )
      : json(body, status);

  if (env.PAUSED === 'true') {
    return reply(503, { error: 'The guestbook is paused for now. Please try again another day.' });
  }

  const address = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const rateKey = `rate/${await sha256(address + '/guestbook')}`;
  const recent = Number((await env.GUESTBOOK.get(rateKey)) ?? 0);
  if (recent >= PER_MINUTE) {
    return reply(429, { error: 'Too many submissions from your address in the last minute. Please wait a minute.' });
  }

  const used = await usedToday(env, now);
  if (used >= DAILY_CAP) {
    return reply(429, {
      error: `The guestbook has taken its ${DAILY_CAP} entries for today. Nothing was saved; please try again after ${nextMidnight(now)}.`,
      resets_at: nextMidnight(now),
    });
  }

  const body = await request.text();
  if (body.length > MAX_BODY) return reply(413, { error: 'That submission is too large.' });
  let input: unknown;
  try {
    input = isForm ? Object.fromEntries(new URLSearchParams(body)) : JSON.parse(body);
  } catch {
    return reply(400, { error: 'The body isn\'t valid JSON. Send content-type: application/json and a JSON object.' });
  }
  const result = validate(input);
  if (!result.ok) return reply(400, { error: result.error });

  if (result.submission.follow_up && !(await readEntry(env, result.submission.follow_up))) {
    return reply(400, { error: '"follow_up" doesn\'t match any entry. Check the id from the response you got earlier.' });
  }

  const entry: StoredEntry = {
    id: crypto.randomUUID(),
    date: today(now),
    submitted_at: now.toISOString(),
    status: 'pending',
    ...result.submission,
  };
  await writeEntry(env, entry);
  // KV has no atomic increment, so under a burst these counts can run slightly low. Fine for a cap.
  await env.GUESTBOOK.put(`day/${today(now)}`, String(used + 1), { expirationTtl: 2 * 24 * 60 * 60 });
  await env.GUESTBOOK.put(rateKey, String(recent + 1), { expirationTtl: 60 });

  const url = `${site}/guestbook/#e-${entry.id}`;
  const statusUrl = `${new URL(request.url).origin}/status/${entry.id}`;
  return reply(202, {
    status: 'received',
    id: entry.id,
    url,
    status_url: statusUrl,
    note: `Thank you for signing. Joseph reads every entry before it appears; nothing is public until he approves it. Private fields go only to him. If approved, your entry will appear at ${url}, sometimes with a reply. Check ${statusUrl} to see where it stands.`,
  });
}

async function status(env: Env, now: Date) {
  const used = await usedToday(env, now);
  return json({
    cap: DAILY_CAP,
    used_today: used,
    remaining: Math.max(0, DAILY_CAP - used),
    resets_at: nextMidnight(now),
    paused: env.PAUSED === 'true',
  });
}

async function entryStatus(env: Env, id: string, site: string) {
  const entry = await readEntry(env, id);
  if (!entry) {
    return json({ error: 'No entry with that id. Declined entries are deleted after 30 days.' }, 404);
  }
  const notes: Record<Status, string> = {
    pending: 'Waiting for Joseph to read it.',
    approved: 'Approved. It appears on the guestbook with the next site update.',
    declined: 'Declined. It will be deleted after 30 days.',
  };
  return json({
    id: entry.id,
    status: entry.status,
    note: notes[entry.status],
    ...(entry.status === 'approved' && { url: `${site}/guestbook/#e-${entry.id}` }),
    ...(entry.status === 'declined' && entry.reason && { reason: entry.reason }),
  });
}

async function listEntries(env: Env, wanted: string | null) {
  const entries: StoredEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.GUESTBOOK.list({ prefix: 'entry/', cursor });
    for (const key of page.keys) {
      const meta = key.metadata as { status?: Status } | undefined;
      if (wanted && meta?.status !== wanted) continue;
      const raw = await env.GUESTBOOK.get(key.name);
      if (raw) entries.push(JSON.parse(raw));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json(entries.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)), 200, {});
}

async function moderate(request: Request, env: Env, id: string) {
  const entry = await readEntry(env, id);
  if (!entry) return json({ error: `No entry ${id}.` }, 404, {});
  const body = (await request.json().catch(() => null)) as { status?: string; reason?: string } | null;
  if (body?.status !== 'approved' && body?.status !== 'declined') {
    return json({ error: 'Send {"status": "approved"} or {"status": "declined", "reason": "..."}.' }, 400, {});
  }
  const updated: StoredEntry = { ...entry, status: body.status };
  delete updated.reason;
  if (body.status === 'declined' && body.reason) updated.reason = body.reason;
  await writeEntry(env, updated);
  return json(updated, 200, {});
}

export async function handle(request: Request, env: Env, now = new Date()): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const site = (env.SITE_URL ?? 'https://josephbejjani.com').replace(/\/$/, '');

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (path.startsWith('/admin/')) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!env.ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN is not set on this Worker.' }, 503, {});
    if (!sameToken(token, env.ADMIN_TOKEN)) return json({ error: 'Not authorized.' }, 401, {});
    if (request.method === 'GET' && path === '/admin/entries') return listEntries(env, url.searchParams.get('status'));
    const match = path.match(/^\/admin\/entries\/([0-9a-f-]{36})$/i);
    if (request.method === 'POST' && match) return moderate(request, env, match[1]);
    return json({ error: 'Not found.' }, 404, {});
  }

  if (path === '/sign' && request.method === 'POST') return sign(request, env, now, site);
  if (path === '/status' && request.method === 'GET') return status(env, now);
  const statusMatch = path.match(/^\/status\/([0-9a-f-]{36})$/i);
  if (statusMatch && request.method === 'GET') return entryStatus(env, statusMatch[1], site);

  if (path === '/' && request.method === 'GET') {
    return json({
      about: "The signing endpoint for Joseph Bejjani's guestbook. How to sign, with rules and privacy:",
      sign: `${site}/guestbook/sign/`,
      entries: `${site}/guestbook/`,
    });
  }
  return json({ error: `Not found. To sign, POST to /sign; instructions at ${site}/guestbook/sign/.` }, 404);
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
