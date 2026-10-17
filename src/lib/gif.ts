import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import sharp from 'sharp';

// Animated GIFs in markdown get a pause / step-through player (src/scripts/gif-player.ts).
// Each frame is exported as its own still at build time (src/pages/intothefog/frames/),
// so a paused GIF shows exactly one frame.

const ASSETS = join(process.cwd(), 'src/assets');

/** URL of one still frame of a GIF, keyed by the GIF's file name without extension. */
export const gifFrameUrl = (name: string, frame: number) => `/intothefog/frames/${name}/${frame}.webp`;

export const gifName = (path: string) => basename(path, '.gif');

/** Every GIF under src/assets, by name. Names must be unique so frame URLs don't collide. */
export function allGifs(): Map<string, string> {
  const gifs = new Map<string, string>();
  for (const entry of readdirSync(ASSETS, { recursive: true, encoding: 'utf8' })) {
    if (!entry.toLowerCase().endsWith('.gif')) continue;
    const name = gifName(entry);
    if (gifs.has(name)) {
      throw new Error(`Two GIFs named "${name}" in src/assets (${gifs.get(name)}, ${entry}); rename one.`);
    }
    gifs.set(name, join(ASSETS, entry));
  }
  return gifs;
}

/** How long each frame shows, in milliseconds. */
export async function gifDelays(path: string): Promise<number[]> {
  const { pages = 1, delay } = await sharp(path).metadata();
  // Browsers treat missing or near-zero delays as 100ms.
  return Array.from({ length: pages }, (_, i) => (delay?.[i] && delay[i] > 10 ? delay[i] : 100));
}

/** One fully composited frame as a WebP still. */
export const gifFrame = (path: string, frame: number) =>
  sharp(path, { page: frame }).webp({ lossless: true }).toBuffer();
