import { getCollection, type CollectionEntry } from 'astro:content';

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

/** Items from a YAML list collection, in file order. */
export async function inFileOrder<C extends 'research' | 'projects' | 'avalanches'>(
  collection: C,
): Promise<CollectionEntry<C>['data'][]> {
  const entries = (await getCollection(collection)) as CollectionEntry<C>[];
  return entries.sort(byId).map((entry) => entry.data);
}

/** Blog posts, newest first. Drafts are hidden in production builds. */
export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Into the Fog pieces, newest first. Drafts are hidden in production builds. */
export async function getPieces() {
  const pieces = await getCollection('fog', ({ data }) => import.meta.env.DEV || !data.draft);
  return pieces.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const OWNER = 'Joseph Bejjani';

/** Author strings starting with the owner's name render bold (keeping any trailing "*"). */
export const isOwner = (author: string) => author.startsWith(OWNER);

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** One entry in the Into the Fog index: a markdown piece, or a standalone page like Avalanches. */
export type FogEntry = { title: string; href: string; date: Date; placeholder: boolean };

// Into the Fog pages that aren't markdown pieces. `date` places them in the index (newest first).
const FOG_PAGES: FogEntry[] = [
  { title: 'Avalanches', href: '/intothefog/avalanches/', date: new Date('2024-01-01'), placeholder: false },
];

/** Everything listed on the Into the Fog index, newest first. Also defines prev/next order. */
export async function getFogIndex(): Promise<FogEntry[]> {
  const pieces = (await getPieces()).map(({ id, data }) => ({
    title: data.title,
    href: `/intothefog/${id}/`,
    date: data.date,
    placeholder: data.placeholder,
  }));
  return [...pieces, ...FOG_PAGES].sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

// Blog titles may mark italics Markdown-style, e.g. "Can AI Write New *War & Peace*?".
const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** A title as HTML, with *asterisk* spans in <em>. Everything else is escaped. */
export const titleHtml = (title: string) => escapeHtml(title).replace(/\*([^*]+)\*/g, '<em>$1</em>');

/** A title as plain text (for <title>, RSS, and llms.txt): asterisks removed. */
export const plainTitle = (title: string) => title.replace(/\*([^*]+)\*/g, '$1');
