import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/lib/guestbook.ts';

test('question ids are unique', () => {
  const ids = QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every linked phrase appears in its question', () => {
  for (const q of QUESTIONS) {
    if ('link' in q) assert.ok(q.text.includes(q.link.text), `"${q.link.text}" is not in "${q.text}"`);
  }
});
