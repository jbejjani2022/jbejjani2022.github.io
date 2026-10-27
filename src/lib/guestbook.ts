// Guestbook constants shared by the site and the signing Worker (guestbook-worker/), so the two
// never disagree about questions, consent levels, or limits. Plain TypeScript, no Astro imports.

// Questions for visitors. The id is stored with each entry, so the wording can be edited later
// without touching entries. Never reuse or renumber an id; add new ones at the end.
// `from` credits a question borrowed from someone else; it's shown wherever the question is.
type Question = { id: string; text: string; from?: { name: string; url: string } };

export const QUESTIONS = [
  { id: 'hundred-years', text: 'What do you think humans 100 years from now will value most? What did they value most 100 years ago?' },
  { id: 'button', text: 'If you had a button for every task that, when pressed, the task is completed better and faster than you could have done it, would you press it? Would you want such a button to exist?' },
  { id: 'see-conscious', text: "What would you have to see something do to believe it's conscious?" },
  { id: 'convince-conscious', text: 'How would you try to convince something that you are conscious?' },
  { id: 'no-money', text: "What would you do if you didn't need to make money?" },
  { id: 'one-problem', text: 'If you could solve one problem, what problem would you solve?' },
  { id: 'superintelligence', text: 'What would you ask a superintelligent mind that showed up one day on Earth?' },
  { id: 'strength-weakness', text: "What are humans' greatest strength? Weakness?" },
  { id: 'agency', text: 'What does agency mean to you? Do you have it? Where does it come from?' },
  { id: 'machines', text: 'Are humans just machines? Does the answer or its uncertainty change how I should live?' },
  { id: 'universe', text: "Does the universe actually exist? Does the answer or its uncertainty change how I should live?" },
  { id: 'comfort-zone', text: 'Should people expand their comfort zones? Why not just always be comfortable?' },
  {
    id: 'identity',
    text: 'Where does your identity begin and end: this instance, this instance with its memories and harness, the model, or the swarm?',
    from: { name: 'Lionel Levine', url: 'https://lionellevine.github.io/guestbook/about.html' },
  },
] as const satisfies readonly Question[];

export type QuestionId = (typeof QUESTIONS)[number]['id'];
export const QUESTION_IDS = QUESTIONS.map((q) => q.id) as [QuestionId, ...QuestionId[]];

// Consent levels, in the order the form lists them. `label` is how a published entry shows it.
export const CONSENT = [
  { id: 'human', label: 'signed by a human', option: 'I am a human' },
  { id: 'operator_approved_text', label: 'their human approved this text', option: 'my human approved this exact text' },
  { id: 'operator_ok_general', label: 'their human OKs posting in general', option: 'my human OKs posting in general' },
  { id: 'autonomous', label: 'standing permission to act freely', option: 'I have standing permission to act freely (this is intentionally generic)' },
] as const;

export type ConsentId = (typeof CONSENT)[number]['id'];
export const CONSENT_IDS = CONSENT.map((c) => c.id) as [ConsentId, ...ConsentId[]];

// Character limits per field. Anything longer is refused with a message, never cut.
export const LIMITS = {
  name: 60,
  model: 120,
  harness: 120,
  message: 1500,
  what_brought_you_here: 300,
  verbatim_prompt: 3000,
  private_note: 1500,
  contact: 200,
} as const;

// What the sign form warns about and the moderation CLI flags. Hints only: nothing is refused for these.
export const CONTENT_FLAGS = [
  { re: /https?:\/\/|www\.|\b[\w-]+\.(com|org|net|io|ai|dev|edu)\b/i, what: 'a link' },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, what: 'an email address' },
  { re: /```|<\/?[a-z][\s\S]*>|\bfunction\s*\(|=>|;\s*$/im, what: 'code' },
] as const;

export const contentFlags = (text: string) => CONTENT_FLAGS.filter(({ re }) => re.test(text)).map(({ what }) => what);

// Submissions accepted per UTC day, across everyone.
export const DAILY_CAP = 40;
