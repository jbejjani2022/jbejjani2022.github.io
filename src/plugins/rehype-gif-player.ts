import type { Element, Root } from 'hast';
import type { VFile } from 'vfile';
import { dirname, resolve } from 'node:path';
import { visit } from 'unist-util-visit';
import { gifFrameHashes, gifFrameUrl, gifName, gifTimeline, gifVariants, type GifStop } from '../lib/gif.ts';

// Marks figures holding a GIF for the pause / step-through player (src/scripts/gif-player.ts):
//
//   <figure><img src="x.gif"></figure>
//     ->  <figure data-gif-frames="/…/0.webp …" data-gif-delays="1000 750 …"><img src="x.gif"></figure>
//
// One entry per stop (a frame the GIF rests on, see src/lib/gif.ts). When the GIF has crossfades,
// data-gif-fades says how each stop gives way to the next: "-" for a cut, or
// "<milliseconds>:<time>@<opacity>,…" for a fade.
//
// The data goes on the figure (made by rehype-figures, which runs first) because Astro's image
// pipeline copies an <img>'s property names verbatim, so data attributes on it come out camelCased.
// Only Into the Fog pieces (src/content/fog/), whose GIFs live in src/assets/.
// Without JS the GIF just plays as usual.
//
// Variants (x.gif plus x.<anything>.gif beside it) add the same three lists for each variant,
// variants separated by "|", as data-gif-alt-frames / -delays / -fades, and
//
//   data-gif-seam="8"   the stop at which the player may change variant
//
// The seam is the last stop that looks the same in every variant, so a change of variant is never
// a jump: whatever differs fades out and back in with the GIF's own fades. Stops a variant shares
// with x.gif reuse x.gif's stills, so they are downloaded once. Variants with nothing in common
// change when the GIF starts over.
//
// Astro caches rendered markdown (.astro/data-store.json) and does not notice edits to this file.
// After changing what it outputs, bump the `version` option in astro.config.mjs to redo the cache.

const fades = (stops: GifStop[]) =>
  stops
    .map(({ fade }) =>
      fade ? `${fade.duration}:${fade.keyframes.map(([at, opacity]) => `${at.toFixed(3)}@${opacity.toFixed(3)}`).join(',')}` : '-',
    )
    .join(' ');

export default function rehypeGifPlayer(_options?: { version?: number }) {
  return async (tree: Root, file: VFile) => {
    if (!(file.path ?? '').replaceAll('\\', '/').includes('/src/content/fog/')) return;
    const gifs: [Element, string][] = [];
    visit(tree, 'element', (node, _, parent) => {
      const src = node.properties.src;
      if (
        node.tagName === 'img' &&
        parent?.type === 'element' &&
        parent.tagName === 'figure' &&
        typeof src === 'string' &&
        /\.gif$/i.test(src) &&
        !/^[a-z]+:/i.test(src)
      ) {
        gifs.push([parent, src]);
      }
    });

    for (const [figure, src] of gifs) {
      const path = resolve(dirname(file.path), decodeURI(src));
      const stops = await gifTimeline(path);
      if (stops.length < 2) continue; // a still GIF has nothing to pause
      const name = gifName(path);
      const frames = stops.map(({ frame }) => gifFrameUrl(name, frame));
      const hasFades = (list: GifStop[]) => list.some(({ fade }) => fade);
      figure.properties.dataGifFrames = frames.join(' ');
      figure.properties.dataGifDelays = stops.map(({ delay }) => delay).join(' ');
      if (hasFades(stops)) figure.properties.dataGifFades = fades(stops);

      const variants = gifVariants(path);
      if (variants.length === 0) continue;
      const hashes = await gifFrameHashes(path);
      const shared = stops.map(() => true); // stop i looks the same in every variant
      const alt = { frames: [] as string[], delays: [] as string[], fades: [] as string[] };
      for (const variant of variants) {
        const variantName = gifName(variant);
        const variantStops = await gifTimeline(variant);
        const variantHashes = await gifFrameHashes(variant);
        const same = (i: number) =>
          variantStops.length === stops.length && variantHashes[variantStops[i].frame] === hashes[stops[i].frame];
        alt.frames.push(variantStops.map(({ frame }, i) => (same(i) ? frames[i] : gifFrameUrl(variantName, frame))).join(' '));
        alt.delays.push(variantStops.map(({ delay }) => delay).join(' '));
        alt.fades.push(fades(variantStops));
        stops.forEach((_, i) => (shared[i] &&= same(i)));
      }
      figure.properties.dataGifAltFrames = alt.frames.join('|');
      figure.properties.dataGifAltDelays = alt.delays.join('|');
      figure.properties.dataGifAltFades = alt.fades.join('|');
      figure.properties.dataGifSeam = String(Math.max(shared.lastIndexOf(true), 0));
    }
  };
}
