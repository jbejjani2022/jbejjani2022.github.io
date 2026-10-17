import type { Element, Root } from 'hast';
import type { VFile } from 'vfile';
import { dirname, resolve } from 'node:path';
import { visit } from 'unist-util-visit';
import { gifDelays, gifFrameUrl, gifName } from '../lib/gif.ts';

// Marks figures holding a GIF for the pause / step-through player (src/scripts/gif-player.ts):
//
//   <figure><img src="x.gif"></figure>
//     ->  <figure data-gif-frames="/…/0.webp …" data-gif-delays="1000 750 …"><img src="x.gif"></figure>
//
// The data goes on the figure (made by rehype-figures, which runs first) because Astro's image
// pipeline copies an <img>'s property names verbatim, so data attributes on it come out camelCased.
// Only Into the Fog pieces (src/content/fog/), whose GIFs live in src/assets/.
// Without JS the GIF just plays as usual.

export default function rehypeGifPlayer() {
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
      const delays = await gifDelays(path);
      if (delays.length < 2) continue; // a still GIF has nothing to pause
      const name = gifName(path);
      figure.properties.dataGifFrames = delays.map((_, i) => gifFrameUrl(name, i)).join(' ');
      figure.properties.dataGifDelays = delays.join(' ');
    }
  };
}
