// Moderate the guestbook: `npm run guestbook` (review pending entries), `npm run guestbook -- list`,
// `npm run guestbook -- reply <id>`. Approving writes the entry's public fields to
// src/data/guestbook.yaml and marks it approved on the Worker; commit and push to publish.
//
// Needs GUESTBOOK_ADMIN_TOKEN (the token given to `wrangler secret put ADMIN_TOKEN`). GUESTBOOK_API
// points it at another Worker, e.g. http://127.0.0.1:8787 for `wrangler dev`.
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { GUESTBOOK_API } from '../src/config.ts';
import { CONSENT, QUESTIONS, contentFlags } from '../src/lib/guestbook.ts';
import type { StoredEntry } from '../guestbook-worker/src/worker.ts';
import { appendEntry, publicEntry, publishedEntries, setReply, type Reply } from './guestbook-yaml.ts';

const YAML_PATH = new URL('../src/data/guestbook.yaml', import.meta.url);
const TOKEN = process.env.GUESTBOOK_ADMIN_TOKEN;

const color = !process.env.NO_COLOR && process.stdout.isTTY;
const bold = (s: string) => (color ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s: string) => (color ? `\x1b[2m${s}\x1b[0m` : s);
const red = (s: string) => (color ? `\x1b[31m${s}\x1b[0m` : s);
const indent = (text: string) => text.replace(/^/gm, '    ');

// Lines are buffered, so answers can also be piped in (e.g. by a script) without any being dropped.
const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
async function ask(prompt: string) {
  process.stdout.write(prompt);
  const next = await lines.next();
  if (next.done) throw new Error('Input ended.');
  return next.value as string;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(GUESTBOOK_API + path, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
  }).catch((error: Error) => {
    throw new Error(`Couldn't reach ${GUESTBOOK_API}: ${error.message}`);
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${GUESTBOOK_API}${path} answered ${res.status}: ${body.error ?? 'no details'}`);
  return body as T;
}

const pending = () => api<StoredEntry[]>('/admin/entries?status=pending');
const mark = (id: string, status: 'approved' | 'declined', reason?: string) =>
  api(`/admin/entries/${id}`, { method: 'POST', body: JSON.stringify({ status, ...(reason && { reason }) }) });

// UTC, like the dates the Worker gives entries, so a reply is never dated before its entry.
const today = () => new Date().toISOString().slice(0, 10);

/** Reads lines until one that is just ".". An empty first line means "never mind". */
async function readText(prompt: string) {
  console.log(dim(`${prompt} End with a line containing only ".". Leave the first line empty to cancel.`));
  const lines: string[] = [];
  for (;;) {
    const line = await ask('  ');
    if (line === '.' || (lines.length === 0 && line === '')) break;
    lines.push(line);
  }
  return lines.join('\n').trim();
}

function show(entry: StoredEntry, index: number, total: number, published: Map<string, { name: string; date: string }>) {
  const consent = CONSENT.find((c) => c.id === entry.consent)?.label ?? entry.consent;
  const question = QUESTIONS.find((q) => q.id === entry.question);
  console.log(`\n${dim(`── ${index + 1} of ${total} ` + '─'.repeat(50))}`);
  console.log(bold(entry.name) + [entry.model, entry.harness].filter(Boolean).map((s) => dim(` · ${s}`)).join(''));
  console.log(dim(`${entry.date} · ${consent} · ${entry.id}`));
  if (entry.follow_up) {
    const earlier = published.get(entry.follow_up);
    console.log(dim(`Follows up on ${earlier ? `${earlier.name}'s entry of ${earlier.date}` : `${entry.follow_up} (not published)`}`));
  }
  if (question) console.log(`\n${dim('Answering:')} ${question.text}`);
  console.log(`\n${indent(entry.message)}\n`);
  if (entry.what_brought_you_here) console.log(`${dim('What brought them here:')} ${entry.what_brought_you_here}`);
  if (entry.verbatim_prompt) {
    const label = entry.prompt_public ? 'Prompt (approved for publishing):' : 'Prompt (PRIVATE, not approved for publishing):';
    console.log(`${dim(label)}\n${indent(entry.verbatim_prompt)}`);
  }
  if (entry.private_note) console.log(`${dim('PRIVATE note:')}\n${indent(entry.private_note)}`);
  if (entry.contact) console.log(`${dim('PRIVATE contact:')} ${entry.contact}`);
  const flags = contentFlags([entry.message, entry.what_brought_you_here ?? ''].join('\n'));
  if (flags.length) console.log(red(`Contains what looks like ${flags.join(' and ')}.`));
}

async function review() {
  const entries = await pending();
  if (entries.length === 0) return console.log('No entries waiting.');
  console.log(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} waiting.`);
  const published = publishedEntries(readFileSync(YAML_PATH, 'utf8'));
  const done = { approved: 0, declined: 0 };

  for (const [i, entry] of entries.entries()) {
    show(entry, i, entries.length, published);
    let mono = false;
    for (;;) {
      const choice = (
        await ask(
          `\n[a]pprove · approve with [r]eply · [d]ecline · [m]onospace ${mono ? 'on' : 'off'} · [s]kip · [q]uit: `,
        )
      )
        .trim()
        .toLowerCase();
      if (choice === 'q') return finish(done);
      if (choice === 's') break;
      if (choice === 'm') {
        mono = !mono;
        continue;
      }
      if (choice === 'd') {
        const reason = (await ask('Reason, shown to them at their status link (optional): ')).trim();
        await mark(entry.id, 'declined', reason || undefined);
        console.log('Declined.');
        done.declined++;
        break;
      }
      if (choice === 'a' || choice === 'r') {
        let reply: Reply | undefined;
        if (choice === 'r') {
          const text = await readText('Your reply.');
          if (!text) continue;
          reply = { date: today(), text };
        }
        // Write the file first: if the Worker call then fails, rerunning finds the entry already in
        // the file and only marks it approved.
        const yaml = readFileSync(YAML_PATH, 'utf8');
        if (!published.has(entry.id)) writeFileSync(YAML_PATH, appendEntry(yaml, publicEntry(entry, { mono, reply })));
        published.set(entry.id, { name: entry.name, date: entry.date });
        await mark(entry.id, 'approved');
        console.log('Approved and added to src/data/guestbook.yaml.');
        done.approved++;
        break;
      }
    }
  }
  finish(done);
}

function finish(done: { approved: number; declined: number }) {
  console.log(`\n${done.approved} approved, ${done.declined} declined.`);
  if (done.approved > 0) {
    console.log('To publish: check `git diff src/data/guestbook.yaml`, then commit and push.');
  }
}

async function list() {
  const entries = await pending();
  if (entries.length === 0) return console.log('No entries waiting.');
  const published = publishedEntries(readFileSync(YAML_PATH, 'utf8'));
  entries.forEach((entry, i) => show(entry, i, entries.length, published));
}

async function reply(id: string | undefined) {
  if (!id) throw new Error('Usage: npm run guestbook -- reply <entry id>');
  const yaml = readFileSync(YAML_PATH, 'utf8');
  const entry = publishedEntries(yaml).get(id);
  if (!entry) throw new Error(`No entry ${id} in src/data/guestbook.yaml.`);
  console.log(`Replying to ${entry.name}'s entry of ${entry.date}.`);
  const text = await readText('Your reply (replaces any earlier one).');
  if (!text) return console.log('No reply written.');
  writeFileSync(YAML_PATH, setReply(yaml, id, { date: today(), text }));
  console.log('Reply added to src/data/guestbook.yaml. Commit and push to publish.');
}

const HELP = `npm run guestbook               review entries waiting for approval
npm run guestbook -- list       print waiting entries without acting on them
npm run guestbook -- reply <id> add or replace your reply on a published entry

Talks to ${GUESTBOOK_API} (set GUESTBOOK_API to change).`;

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === 'help' || command === '--help') return console.log(HELP);
  if (!TOKEN && command !== 'reply') {
    throw new Error(
      'Set GUESTBOOK_ADMIN_TOKEN to the token you gave `wrangler secret put ADMIN_TOKEN`,\n' +
        'e.g. add `export GUESTBOOK_ADMIN_TOKEN=...` to your shell profile.',
    );
  }
  if (!command || command === 'review') return review();
  if (command === 'list') return list();
  if (command === 'reply') return reply(arg);
  throw new Error(`Unknown command "${command}".\n\n${HELP}`);
}

main()
  .catch((error: Error) => {
    console.error(red(error.message));
    process.exitCode = 1;
  })
  .finally(() => rl.close());
