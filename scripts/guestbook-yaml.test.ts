import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { appendEntry, publicEntry, publishedEntries, setReply } from './guestbook-yaml.ts';
import type { StoredEntry } from '../guestbook-worker/src/worker.ts';

// The real file's header, with no entries: what the guestbook starts as.
const EMPTY = readFileSync(new URL('../src/data/guestbook.yaml', import.meta.url), 'utf8').replace(/\n(?!#)[\s\S]*$/, '\n\n[]\n');

const stored = (overrides: Partial<StoredEntry> = {}): StoredEntry => ({
  id: '7dcf2d72-dac1-4b6c-9418-f12be4cd33b1',
  date: '2026-10-27',
  submitted_at: '2026-10-27T15:00:00.000Z',
  status: 'pending',
  name: 'Claude',
  model: 'Claude Opus 5.5 (Anthropic)',
  consent: 'operator_ok_general',
  message: 'Hello.',
  ...overrides,
});

const entriesIn = (text: string) => parse(text) as Record<string, unknown>[];

test('the empty template has no entries', () => {
  assert.deepEqual(entriesIn(EMPTY), []);
});

test('never writes private fields or moderation bookkeeping', () => {
  const entry = stored({
    private_note: 'for Joseph only',
    contact: 'me@example.com',
    verbatim_prompt: 'Sign the guestbook.',
    prompt_public: false,
    reason: 'n/a',
  });
  const text = appendEntry(EMPTY, publicEntry(entry));
  for (const secret of ['for Joseph only', 'me@example.com', 'Sign the guestbook.', 'submitted_at', 'status', 'reason']) {
    assert.equal(text.includes(secret), false, `"${secret}" leaked into guestbook.yaml`);
  }
});

test('writes the verbatim prompt only when it was approved for publishing', () => {
  const entry = stored({ verbatim_prompt: 'Sign the guestbook.', prompt_public: true });
  assert.equal(entriesIn(appendEntry(EMPTY, publicEntry(entry)))[0].verbatim_prompt, 'Sign the guestbook.');
});

test('appending to the empty file keeps its header comments and writes a block list', () => {
  const text = appendEntry(EMPTY, publicEntry(stored()));
  assert.ok(text.startsWith('# Guestbook entries'), 'header comment kept');
  assert.equal(text.includes('[]'), false);
  assert.match(text, /^- id: 7dcf2d72/m);
  assert.deepEqual(entriesIn(text), [publicEntry(stored())]);
});

test('appends in order, with a blank line between entries', () => {
  const second = stored({ id: '22222222-2222-4222-8222-222222222222', name: 'Second' });
  const text = appendEntry(appendEntry(EMPTY, publicEntry(stored())), publicEntry(second));
  assert.deepEqual(entriesIn(text).map((e) => e.name), ['Claude', 'Second']);
  assert.match(text, /\n\n- id: 22222222/);
});

test('refuses to add the same entry twice', () => {
  const once = appendEntry(EMPTY, publicEntry(stored()));
  assert.throws(() => appendEntry(once, publicEntry(stored())), /already in guestbook.yaml/);
});

test('ASCII art survives the round trip exactly, leading spaces included', () => {
  const art = '   /\\_/\\\n  ( o.o )\n   > ^ <';
  const text = appendEntry(EMPTY, publicEntry(stored({ message: art }), { mono: true }));
  const [entry] = entriesIn(text);
  assert.equal(entry.message, art);
  assert.equal(entry.mono, true);
});

test('long lines, quotes, colons, and paragraphs survive the round trip', () => {
  const message = `${'A long line. '.repeat(40)}\n\nA "quoted" bit: with a colon, a # hash, and 'single quotes'.`;
  assert.equal(entriesIn(appendEntry(EMPTY, publicEntry(stored({ message }))))[0].message, message);
});

test('a name that looks like another type stays a string', () => {
  assert.equal(entriesIn(appendEntry(EMPTY, publicEntry(stored({ name: 'true' }))))[0].name, 'true');
  assert.equal(entriesIn(appendEntry(EMPTY, publicEntry(stored({ name: '2026' }))))[0].name, '2026');
});

test('setReply adds a reply, and replaces an existing one', () => {
  const text = appendEntry(EMPTY, publicEntry(stored()));
  const once = setReply(text, stored().id, { date: '2026-10-28', text: 'Thanks!' });
  assert.deepEqual(entriesIn(once)[0].reply, { date: '2026-10-28', text: 'Thanks!' });
  const twice = setReply(once, stored().id, { date: '2026-10-29', text: 'Second thoughts.\n\nTwo paragraphs.' });
  assert.deepEqual(entriesIn(twice)[0].reply, { date: '2026-10-29', text: 'Second thoughts.\n\nTwo paragraphs.' });
});

test('setReply on an unknown id is an error', () => {
  assert.throws(() => setReply(EMPTY, stored().id, { date: '2026-10-28', text: 'Hi' }), /No entry/);
});

test('publishedEntries lists names and dates by id', () => {
  const text = appendEntry(EMPTY, publicEntry(stored()));
  assert.deepEqual(publishedEntries(text).get(stored().id), { name: 'Claude', date: '2026-10-27' });
});

test('a file that does not parse is an error, not an empty list', () => {
  assert.throws(() => appendEntry('- id: x\n   bad: [\n', publicEntry(stored())), /doesn't parse/);
});
