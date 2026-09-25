// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import remarkFogBreaks from './src/plugins/remark-fog-breaks.ts';
import rehypeSidenotes from './src/plugins/rehype-sidenotes.ts';
import rehypeFigures from './src/plugins/rehype-figures.ts';

const SITE = 'https://josephbejjani.com';
const LESSWRONG_POST =
  'https://www.lesswrong.com/posts/AJANBeJb2p39su6F9/cs2881r-week-8-when-agents-prefer-hacking-to-failure';

const redirects = {
  '/mechagogue-jax/': '/blog/mechagogue-jax/',
  '/perplexing-poem-prompt/': '/blog/perplexing-poem-prompt/',
  '/misalignment-inoculation/': '/blog/misalignment-inoculation/',
  '/when-agents-prefer-hacking-to-failure/': LESSWRONG_POST,
  '/design/': '/projects/',
  '/feed.xml': '/blog/rss.xml',
  '/misc/': '/intothefog/avalanches/',
};

// Pages that exist but should not be advertised in the sitemap.
const SITEMAP_EXCLUDE = ['/camino/', '/404', ...Object.keys(redirects)];

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  redirects,
  // Markdown images (blog posts, Into the Fog) get a srcset so browsers download a size that fits.
  image: { layout: 'constrained' },
  integrations: [
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.some((path) => new URL(page).pathname.startsWith(path)),
    }),
  ],
  markdown: {
    shikiConfig: { theme: 'github-light' },
    processor: unified({
      remarkPlugins: [remarkMath, remarkFogBreaks],
      rehypePlugins: [
        rehypeKatex,
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 },
            // Empty on purpose: the "#" is drawn in CSS so it never leaks into heading text.
            content: [],
          },
        ],
        [rehypeExternalLinks, { target: '_blank', rel: ['noopener'] }],
        rehypeSidenotes,
        rehypeFigures,
      ],
    }),
  },
});
