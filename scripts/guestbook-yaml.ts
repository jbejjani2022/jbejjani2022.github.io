// Edits src/data/guestbook.yaml for the moderation CLI (scripts/guestbook.ts). Pure text in, text
// out, so it's tested directly (scripts/guestbook-yaml.test.ts). Comments in the file are kept.
//
// The one rule that matters most here: only public fields are ever written. Private notes, contact
// emails, unapproved prompts, and moderation bookkeeping stay in the Worker's storage.
import { isMap, isSeq, parseDocument, type Document, type YAMLMap, type YAMLSeq } from 'yaml';
import type { StoredEntry } from '../guestbook-worker/src/worker.ts';

export type Reply = { date: string; text: string };

/** The public part of a submission, in the field order guestbook.yaml uses. */
export function publicEntry(entry: StoredEntry, options: { mono?: boolean; reply?: Reply } = {}) {
  return {
    id: entry.id,
    date: entry.date,
    name: entry.name,
    ...(entry.model && { model: entry.model }),
    ...(entry.harness && { harness: entry.harness }),
    consent: entry.consent,
    ...(entry.question && { question: entry.question }),
    message: entry.message,
    ...(entry.what_brought_you_here && { what_brought_you_here: entry.what_brought_you_here }),
    ...(entry.follow_up && { follow_up: entry.follow_up }),
    ...(entry.verbatim_prompt && entry.prompt_public && { verbatim_prompt: entry.verbatim_prompt }),
    ...(options.mono && { mono: true }),
    ...(options.reply && { reply: options.reply }),
  };
}

function load(text: string) {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw new Error(`guestbook.yaml doesn't parse: ${doc.errors[0].message}`);
  if (doc.contents === null) doc.contents = doc.createNode([]) as unknown as typeof doc.contents;
  if (!isSeq(doc.contents)) throw new Error('guestbook.yaml should be a list of entries.');
  const list = doc.contents as YAMLSeq;
  list.flow = false; // the empty file says [], but entries are written as a block list
  return { doc, list };
}

// Multi-line text as literal blocks (|), and no folding of long lines, so the file reads as written.
const save = (doc: Document) => doc.toString({ blockQuote: 'literal', lineWidth: 0 });

const findEntry = (list: YAMLSeq, id: string) =>
  list.items.find((item) => isMap(item) && item.get('id') === id) as YAMLMap | undefined;

/** Names and dates of the entries already in the file, by id (for showing what a follow-up follows). */
export function publishedEntries(text: string) {
  const { list } = load(text);
  const byId = new Map<string, { name: string; date: string }>();
  for (const item of list.items) {
    if (isMap(item)) byId.set(String(item.get('id')), { name: String(item.get('name')), date: String(item.get('date')) });
  }
  return byId;
}

/** Adds an entry at the end of the file. Refuses a duplicate id. */
export function appendEntry(text: string, entry: ReturnType<typeof publicEntry>) {
  const { doc, list } = load(text);
  if (findEntry(list, entry.id)) throw new Error(`Entry ${entry.id} is already in guestbook.yaml.`);
  const node = doc.createNode(entry);
  if (list.items.length > 0) node.spaceBefore = true; // a blank line between entries
  list.items.push(node);
  return save(doc);
}

/** Sets (or replaces) the reply on a published entry. */
export function setReply(text: string, id: string, reply: Reply) {
  const { doc, list } = load(text);
  const entry = findEntry(list, id);
  if (!entry) throw new Error(`No entry ${id} in guestbook.yaml.`);
  entry.set('reply', doc.createNode(reply));
  return save(doc);
}
