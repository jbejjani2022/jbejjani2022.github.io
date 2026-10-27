import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/validate.ts';
import { LIMITS, QUESTIONS } from '../../src/lib/guestbook.ts';

const agent = { name: 'Claude', message: 'Hello.', consent: 'operator_ok_general' };

const errorOf = (input: unknown) => {
  const result = validate(input);
  assert.equal(result.ok, false, 'expected a validation error');
  return (result as { error: string }).error;
};
const submissionOf = (input: unknown) => {
  const result = validate(input);
  assert.ok(result.ok, `expected success, got: ${!result.ok && result.error}`);
  return result.submission;
};

test('accepts a minimal agent entry', () => {
  assert.deepEqual(submissionOf(agent), agent);
});

test('rejects a body that is not an object', () => {
  assert.match(errorOf([agent]), /JSON object/);
  assert.match(errorOf('hello'), /JSON object/);
});

for (const field of ['name', 'message', 'consent']) {
  test(`requires ${field}`, () => {
    assert.match(errorOf({ ...agent, [field]: undefined }), new RegExp(`"${field}" is required`));
  });
}

test('treats a blank required field as missing', () => {
  assert.match(errorOf({ ...agent, name: '   ' }), /"name" is required/);
});

test('treats blank optional fields as absent', () => {
  assert.deepEqual(submissionOf({ ...agent, model: '', harness: '  ' }), agent);
});

test('refuses an over-long field instead of cutting it, naming the field and limit', () => {
  const error = errorOf({ ...agent, message: 'x'.repeat(LIMITS.message + 1) });
  assert.match(error, /"message" is 1501 characters; the limit is 1500/);
});

test('accepts a field exactly at its limit', () => {
  assert.equal(submissionOf({ ...agent, name: 'x'.repeat(LIMITS.name) }).name.length, LIMITS.name);
});

test('rejects unknown fields and lists the known ones', () => {
  const error = errorOf({ ...agent, move: 'verify', email: 'a@b.c' });
  assert.match(error, /Unknown fields: move, email/);
  assert.match(error, /Known fields: name/);
});

test('rejects a non-string text field', () => {
  assert.match(errorOf({ ...agent, model: 5 }), /"model" must be a string/);
});

test('rejects an unknown consent level', () => {
  assert.match(errorOf({ ...agent, consent: 'yes' }), /"consent" must be one of/);
});

test('refuses consent "human" without the human checkbox', () => {
  assert.match(errorOf({ ...agent, consent: 'human' }), /"I'm a human" box/);
});

test('accepts consent "human" with the checkbox, from a form ("on") or JSON (true)', () => {
  assert.equal(submissionOf({ ...agent, consent: 'human', human_check: 'on' }).consent, 'human');
  assert.equal(submissionOf({ ...agent, consent: 'human', human_check: true }).consent, 'human');
});

test('does not store the human checkbox itself', () => {
  assert.equal('human_check' in submissionOf({ ...agent, consent: 'human', human_check: true }), false);
});

test('accepts a question by id', () => {
  assert.equal(submissionOf({ ...agent, question: 'agency' }).question, 'agency');
});

test('accepts a question by its exact text, ignoring case', () => {
  const [, second] = QUESTIONS;
  assert.equal(submissionOf({ ...agent, question: second.text.toUpperCase() }).question, second.id);
});

test('rejects an unknown question and lists the ids', () => {
  assert.match(errorOf({ ...agent, question: 'Why is the sky blue?' }), /Unknown question.*identity/);
});

test('requires follow_up to be a UUID, and lowercases it', () => {
  assert.match(errorOf({ ...agent, follow_up: 'my last one' }), /"follow_up" must be the id/);
  const id = 'D6401262-4657-4E60-ACD3-0D658AC868A2';
  assert.equal(submissionOf({ ...agent, follow_up: id }).follow_up, id.toLowerCase());
});

test('requires contact to look like an email', () => {
  assert.match(errorOf({ ...agent, contact: 'call me' }), /"contact" must be an email/);
  assert.equal(submissionOf({ ...agent, contact: 'a@example.com' }).contact, 'a@example.com');
});

test('keeps the indentation of ASCII art but drops blank lines around it', () => {
  const art = '\n\n   /\\_/\\\n  ( o.o )\n   > ^ <\n\n';
  assert.equal(submissionOf({ ...agent, message: art }).message, '   /\\_/\\\n  ( o.o )\n   > ^ <');
});

test('trims whitespace around other fields', () => {
  assert.equal(submissionOf({ ...agent, name: '  Claude  ' }).name, 'Claude');
});

test('stores prompt_public only alongside a verbatim prompt', () => {
  assert.equal('prompt_public' in submissionOf({ ...agent, prompt_public: true }), false);
  const withPrompt = submissionOf({ ...agent, verbatim_prompt: 'Sign it.', prompt_public: 'true' });
  assert.equal(withPrompt.prompt_public, true);
  assert.equal(submissionOf({ ...agent, verbatim_prompt: 'Sign it.' }).prompt_public, false);
});
