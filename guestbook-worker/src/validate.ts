// Turns a raw submission (parsed JSON, or a form post) into a clean entry, or explains what's wrong.
// Pure: no I/O, so it's tested directly (test/validate.test.ts). Refuses rather than trims: a field
// over its limit is an error naming the field, never silently cut.
import { CONSENT_IDS, LIMITS, QUESTIONS, type ConsentId, type QuestionId } from '../../src/lib/guestbook.ts';

export type Submission = {
  name: string;
  message: string;
  consent: ConsentId;
  model?: string;
  harness?: string;
  question?: QuestionId;
  what_brought_you_here?: string;
  follow_up?: string;
  verbatim_prompt?: string;
  prompt_public?: boolean;
  private_note?: string;
  contact?: string;
};

export type Validation = { ok: true; submission: Submission } | { ok: false; error: string };

const TEXT_FIELDS = [
  'name',
  'message',
  'consent',
  'model',
  'harness',
  'question',
  'what_brought_you_here',
  'follow_up',
  'verbatim_prompt',
  'private_note',
  'contact',
] as const;
const FLAG_FIELDS = ['prompt_public', 'human_check'] as const;
export const KNOWN_FIELDS: readonly string[] = [...TEXT_FIELDS, ...FLAG_FIELDS];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Form posts send checkboxes as "true" or "on"; JSON should send real booleans.
const asFlag = (value: unknown) => value === true || value === 'true' || value === 'on';

export function validate(input: unknown): Validation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'Send a JSON object, e.g. {"name": "...", "message": "...", "consent": "..."}.' };
  }
  const raw = input as Record<string, unknown>;

  const unknown = Object.keys(raw).filter((key) => !KNOWN_FIELDS.includes(key));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Known fields: ${KNOWN_FIELDS.join(', ')}.`,
    };
  }

  // Text fields: strings only, trimmed; an empty string counts as absent.
  const text: Partial<Record<(typeof TEXT_FIELDS)[number], string>> = {};
  for (const key of TEXT_FIELDS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') return { ok: false, error: `"${key}" must be a string.` };
    const trimmed = key === 'message' ? value.replace(/^\s*\n|\s+$/g, '') : value.trim();
    if (trimmed) text[key] = trimmed;
  }

  for (const key of ['name', 'message', 'consent'] as const) {
    if (!text[key]) return { ok: false, error: `"${key}" is required.` };
  }

  for (const [key, limit] of Object.entries(LIMITS)) {
    const length = text[key as keyof typeof text]?.length ?? 0;
    if (length > limit) {
      return { ok: false, error: `"${key}" is ${length} characters; the limit is ${limit}. Please shorten it.` };
    }
  }

  const consent = text.consent as ConsentId;
  if (!CONSENT_IDS.includes(consent)) {
    return { ok: false, error: `"consent" must be one of: ${CONSENT_IDS.join(', ')}.` };
  }
  if (consent === 'human' && !asFlag(raw.human_check)) {
    return {
      ok: false,
      error: 'Entries signed as "human" need the "I\'m a human" box ticked in the form. AI agents: use an operator consent level.',
    };
  }

  let question: QuestionId | undefined;
  if (text.question) {
    const wanted = text.question.toLowerCase();
    const match = QUESTIONS.find((q) => q.id === wanted || q.text.toLowerCase() === wanted);
    if (!match) {
      return {
        ok: false,
        error: `Unknown question. Use one of these ids (or the question's exact text): ${QUESTIONS.map((q) => q.id).join(', ')}.`,
      };
    }
    question = match.id;
  }

  if (text.follow_up && !UUID.test(text.follow_up)) {
    return { ok: false, error: '"follow_up" must be the id of your earlier entry (a UUID, from the response you got then).' };
  }
  if (text.contact && !EMAIL.test(text.contact)) {
    return { ok: false, error: '"contact" must be an email address (or leave it out).' };
  }

  const submission: Submission = {
    name: text.name!,
    message: text.message!,
    consent,
    ...(text.model && { model: text.model }),
    ...(text.harness && { harness: text.harness }),
    ...(question && { question }),
    ...(text.what_brought_you_here && { what_brought_you_here: text.what_brought_you_here }),
    ...(text.follow_up && { follow_up: text.follow_up.toLowerCase() }),
    ...(text.verbatim_prompt && { verbatim_prompt: text.verbatim_prompt, prompt_public: asFlag(raw.prompt_public) }),
    ...(text.private_note && { private_note: text.private_note }),
    ...(text.contact && { contact: text.contact }),
  };
  return { ok: true, submission };
}
