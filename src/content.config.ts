import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';

// YAML lists have no ids, so give each item its zero-padded position plus a slug of its name
// (so build errors say which item is wrong). Sorting by id (see src/lib/data.ts) then
// reproduces file order exactly.
function orderedList(text: string) {
  const data = parseYaml(text);
  if (!Array.isArray(data)) throw new Error('Expected a YAML list at the top level.');
  return data.map((item, i) => {
    const name = String(item?.title ?? item?.name ?? item?.scenario ?? '');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    return { id: `${String(i).padStart(4, '0')}-${slug}`, ...item };
  });
}

// Strict, so a typo like `venu:` fails the build instead of being silently ignored.
// `id` is the position added by orderedList().
const listItem = <T extends z.ZodRawShape>(shape: T) => z.object({ id: z.string(), ...shape }).strict();

const link = z.object({ label: z.string(), url: z.url() }).strict();

const research = defineCollection({
  loader: file('src/data/research.yaml', { parser: orderedList }),
  schema: listItem({
    title: z.string(),
    year: z.number().int(),
    venue: z.string().optional(), // peer-reviewed venue only
    authors: z.array(z.string()).min(1),
    links: z.array(link).default([]),
    image: z.string().optional(), // filename in src/assets/research/
  }),
});

const projects = defineCollection({
  loader: file('src/data/projects.yaml', { parser: orderedList }),
  schema: listItem({
    name: z.string(),
    url: z.url().optional(),
    github: z.url().optional(),
    youtube: z.url().optional(),
    description: z.string(),
  }),
});

const avalanches = defineCollection({
  loader: file('src/data/avalanches.yaml', { parser: orderedList }),
  schema: listItem({ scenario: z.string(), key: z.string() }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z
    .object({
      title: z.string(),
      date: z.coerce.date(),
      description: z.string(),
      authors: z.array(z.string()).optional(), // omit when sole author
      externalUrl: z.url().optional(), // cross-post: the list links out, no local page
      externalSource: z.string().optional(), // e.g. "LessWrong"
      toc: z.boolean().default(true),
      draft: z.boolean().default(false),
    })
    .strict(),
});

const fog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/fog' }),
  schema: z
    .object({
      title: z.string(),
      date: z.coerce.date(), // ordering only, never displayed
      // poem: lines break as written. prose, sketch, painting: normal paragraphs (images + optional caption).
      type: z.enum(['poem', 'prose', 'sketch', 'painting']).default('poem'),
      attribution: z.string().optional(), // for others' work; shown as "— Name"
      placeholder: z.boolean().default(false),
      draft: z.boolean().default(false),
    })
    .strict(),
});

export const collections = { research, projects, avalanches, blog, fog };
