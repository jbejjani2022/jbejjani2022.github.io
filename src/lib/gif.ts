import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import sharp from 'sharp';

// Animated GIFs in markdown get a pause / step-through player (src/scripts/gif-player.ts).
// The frames a GIF rests on (its "stops") are exported as stills at build time
// (src/pages/intothefog/frames/), so a paused GIF shows exactly one frame.
//
// A crossfade drawn into a GIF as a run of quick in-between frames is not exported: gifTimeline()
// recognises it and the player fades between the two stills itself, which is smoother and far
// less to download. Stepping by hand goes from stop to stop.
//
// A GIF can have variants: `x.gif` plus siblings named `x.<anything>.gif` (e.g. `x.swapped.gif`).
// Only `x.gif` goes in the markdown; the player picks one of them at random on every replay.

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

/** The other versions of a GIF: files beside `x.gif` named `x.<anything>.gif`, in name order. */
export function gifVariants(path: string): string[] {
  const prefix = `${gifName(path)}.`;
  return readdirSync(dirname(path))
    .filter((entry) => entry.startsWith(prefix) && entry.toLowerCase().endsWith('.gif') && entry !== basename(path))
    .sort()
    .map((entry) => join(dirname(path), entry));
}

const hashCache = new Map<string, Promise<string[]>>();

/** A fingerprint of each frame's pixels, to tell which frames two variants have in common. */
export function gifFrameHashes(path: string): Promise<string[]> {
  const key = `${path}:${statSync(path).mtimeMs}`;
  let hashes = hashCache.get(key);
  if (!hashes) {
    hashes = (async () => {
      const { pages = 1 } = await sharp(path).metadata();
      const out: string[] = [];
      for (let frame = 0; frame < pages; frame++) {
        const { data, info } = await sharp(path, { page: frame }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        out.push(createHash('sha1').update(`${info.width}x${info.height}:`).update(data).digest('hex'));
      }
      return out;
    })();
    hashCache.set(key, hashes);
  }
  return hashes;
}

/** A frame the GIF rests on, and how it gives way to the next one (a cut, unless `fade` is set). */
export interface GifStop {
  /** Index of the frame in the GIF. */
  frame: number;
  /** How long it shows, in milliseconds. */
  delay: number;
  /** Crossfade into the next stop: its length, and [time, opacity of the next stop] points, both 0–1. */
  fade?: { duration: number; keyframes: [number, number][] };
}

// In-between frames of a crossfade show this long at most; anything slower is a frame of its own.
const FADE_MAX_DELAY = 150;
// How far an in-between frame may be from an exact blend of its two ends (share of their difference).
const FADE_TOLERANCE = 0.05;

const timelineCache = new Map<string, Promise<GifStop[]>>();

/**
 * The GIF as stops. A run of quick frames that are each a blend of the frame before the run and
 * the frame after it is a crossfade: those frames are dropped and described by `fade` instead.
 */
export function gifTimeline(path: string): Promise<GifStop[]> {
  const key = `${path}:${statSync(path).mtimeMs}`;
  let timeline = timelineCache.get(key);
  if (!timeline) {
    timeline = buildTimeline(path);
    timelineCache.set(key, timeline);
  }
  return timeline;
}

async function buildTimeline(path: string): Promise<GifStop[]> {
  const delays = await gifDelays(path);
  const count = delays.length;
  const pixels = new Map<number, Promise<Buffer>>();
  const small = (frame: number) => {
    if (!pixels.has(frame)) {
      pixels.set(frame, sharp(path, { page: frame }).flatten({ background: '#fff' }).greyscale().resize({ width: 256 }).raw().toBuffer());
    }
    return pixels.get(frame)!;
  };

  /** Where `mid` sits between `from` (0) and `to` (1), or undefined if it isn't a blend of the two. */
  const blend = (from: Buffer, to: Buffer, mid: Buffer) => {
    let dot = 0;
    let span = 0;
    for (let i = 0; i < from.length; i++) {
      const d = to[i] - from[i];
      dot += (mid[i] - from[i]) * d;
      span += d * d;
    }
    if (span === 0) return undefined;
    const t = dot / span;
    let off = 0;
    for (let i = 0; i < from.length; i++) off += (mid[i] - from[i] - t * (to[i] - from[i])) ** 2;
    return off / span <= FADE_TOLERANCE ? t : undefined;
  };

  const stops: GifStop[] = [];
  for (let i = 0; i < count; ) {
    let end = i + 1; // the run of quick frames after frame i is i+1 … end-1
    while (end < count && delays[end] <= FADE_MAX_DELAY) end++;
    const stop: GifStop = { frame: i, delay: delays[i] };
    stops.push(stop);
    if (end > i + 1) {
      const from = await small(i);
      const to = await small(end % count);
      const keyframes: [number, number][] = [];
      const duration = delays.slice(i + 1, end).reduce((sum, delay) => sum + delay, 0);
      let elapsed = 0;
      let last = 0;
      for (let k = i + 1; k < end; k++) {
        const t = blend(from, to, await small(k));
        if (t === undefined || t < last - 0.02 || t > 1.02) break;
        last = Math.min(Math.max(t, last), 1);
        keyframes.push([(elapsed + delays[k] / 2) / duration, last]);
        elapsed += delays[k];
      }
      if (keyframes.length === end - i - 1) {
        stop.fade = { duration, keyframes };
        i = end;
        continue;
      }
    }
    i++;
  }
  return stops;
}
