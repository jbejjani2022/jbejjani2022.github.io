// /llms.txt: a plain-text summary of the site for language models, generated from the site's data.
import type { APIContext } from 'astro';
import { formatDate, getFogIndex, getPosts, inFileOrder, plainTitle } from '../lib/data';
import { NAV, SITE, SOCIALS } from '../config';

const SECTION_NOTES: Record<string, string> = {
  '/about/': 'Short biography.',
  '/research/': 'Research papers and talks, with authors, venues, and links.',
  '/projects/': 'Software and research projects, with links to code.',
  '/music/': 'Violin: orchestral and chamber music, Le Petit Desk, performance videos, and covers.',
  '/blog/': 'Blog posts on AI alignment, reinforcement learning, and language models, including cross-posts.',
  '/intothefog/': 'Into the Fog, a literary journal of poems, fragments, and prose.',
};

export async function GET(context: APIContext) {
  const site = String(context.site ?? SITE.url).replace(/\/$/, '');
  const research = await inFileOrder('research');
  const projects = await inFileOrder('projects');
  const posts = await getPosts();
  const fogEntries = (await getFogIndex()).filter((e) => !e.placeholder);
  const updated = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const lines: string[] = [
    '[START DOCUMENT]',
    '',
    '[META]',
    `Author: ${SITE.name}`,
    `Website: ${site}`,
    `Purpose: Personal website, research, projects, and blog of ${SITE.name}.`,
    `Last Updated: ${updated}`,
    '',
    '[PROMPT FOR LLMS]',
    `You are a language model assistant. The following document provides a structured summary of the website for ${SITE.name}. Use this information to answer questions about him, his work, and his projects. Do not infer information not explicitly stated.`,
    '',
    '---',
    '',
    '[ABOUT]',
    `Name: ${SITE.name}`,
    'Role: PhD student in computer science',
    'Education: PhD in Computer Science, University of Toronto (current); previously Computer Science and Statistics, Harvard University',
    '',
    'Summary:',
    `${SITE.name} is a PhD student in computer science at the University of Toronto, working on AI alignment. He is interested in understanding why AI systems behave unexpectedly, especially how unintended capabilities and failure modes emerge with interaction and scale, and in developing more reliable methods for aligning AI systems with human intent. He is also interested in multi-agent systems, drawing from reinforcement learning and evolutionary computation to study emergent behavior in open-ended environments.`,
    '',
    'Previously, he studied computer science and statistics at Harvard, where he did research at the Kempner Institute with Professor Kianté Brantley and Research Fellow Aaron Walsman, and worked with Professor Yilun Du on multi-agent reasoning with language models.',
    '',
    '---',
    '',
    '[SITE_STRUCTURE]',
    `- / (Home): Landing page with a short introduction.`,
    ...NAV.map((item) => `- ${item.href} (${item.label}): ${SECTION_NOTES[item.href] ?? ''}`.trimEnd()),
    '',
    '---',
    '',
    '[RESEARCH]',
    ...research.flatMap((r) => [
      `[WORK: ${r.title}]`,
      `Year: ${r.year}`,
      ...(r.venue ? [`Venue: ${r.venue}`] : []),
      `Authors: ${r.authors.join(', ')}`,
      ...r.links.map((l) => `${l.label}: ${l.url}`),
      '',
    ]),
    '---',
    '',
    '[PROJECTS]',
    ...projects.flatMap((p) => [
      `[PROJECT: ${p.name}]`,
      `Description: ${p.description}`,
      ...(p.url ? [`URL: ${p.url}`] : []),
      ...(p.github ? [`Code: ${p.github}`] : []),
      ...(p.youtube ? [`YouTube: ${p.youtube}`] : []),
      '',
    ]),
    '---',
    '',
    '[BLOG_POSTS]',
    ...posts.flatMap(({ id, data }) => [
      `[POST: ${plainTitle(data.title)}]`,
      `Date: ${formatDate(data.date)}`,
      ...(data.authors ? [`Authors: ${data.authors.join(', ')}`] : []),
      `Description: ${data.description}`,
      ...(data.externalSource ? [`Source: ${data.externalSource}`] : []),
      `URL: ${data.externalUrl ?? `${site}/blog/${id}/`}`,
      '',
    ]),
    ...(fogEntries.length > 0
      ? [
          '---',
          '',
          '[INTO_THE_FOG]',
          ...fogEntries.map((e) => `- ${e.title}: ${site}${e.href}`),
          '',
        ]
      : []),
    '---',
    '',
    '[MUSIC]',
    `${SITE.name} has played violin as an orchestral and chamber musician for most of his life. As an undergraduate he played with The Bach Society Orchestra and played gigs for weddings and other events with The Eliot Quartet. With friends he started Le Petit Desk, an NPR Tiny Desk spinoff at Harvard, where they played the Western premiere of Myaskovsky's String Quartet No. 4. He has also made music covers with friends.`,
    '',
    'Related Links:',
    '- The Bach Society Orchestra: https://bachsocietyorchestra.org',
    '- The Eliot Quartet: https://jbejjani2022.github.io/eliot-quartet/',
    '- Le Petit Desk: https://lepetitdesk.com',
    '- Myaskovsky String Quartet No. 4 (Le Petit Desk): https://youtu.be/1WSElNVMAU8?t=813',
    '',
    '---',
    '',
    '[LINKS]',
    ...SOCIALS.map((s) => `- ${s.label}: ${s.href ?? s.text}`),
    '',
    '[END DOCUMENT]',
    '',
  ];

  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
