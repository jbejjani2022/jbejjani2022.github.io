import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, plainTitle } from '../../lib/data';
import { SITE } from '../../config';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `${SITE.name} · Blog`,
    description: 'Writing by Joseph Bejjani on AI alignment, reinforcement learning, and language models.',
    site: context.site ?? SITE.url,
    items: posts.map(({ id, data }) => ({
      title: plainTitle(data.title),
      pubDate: data.date,
      description: data.description,
      // Cross-posts link straight to where they were published.
      link: data.externalUrl ?? `/blog/${id}/`,
    })),
  });
}
