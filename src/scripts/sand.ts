// "Invisible ink" for elements marked data-sand (see src/components/Lightly.astro).
//
// A canvas laid over the text is filled with flickering grains on the page background, which hides
// the text. Moving the pointer (or a finger) over it warms the cells underneath; warm cells are
// transparent, and cool back down on their own, so the sand drifts back over the text.
//
// Each cell is one CSS pixel and holds a "heat": 0 is fully covered, 1 or more is fully clear. The
// brush stamps heat well above 1 at its centre, so the middle of a stroke stays clear for a few
// seconds while its edges close in first.
//
// The sand's top edge can follow a drawn line: the canvas's data-surface lists, at evenly spaced
// columns, how far below the canvas top the sand starts, as fractions of the canvas width. Its bottom
// edge thins out to nothing.

const INK = 26; // grain colour, the site's --text (#1a1a1a)
const PAPER = 255; // cover colour, the site's --bg
const DENSITY = 0.18; // share of pixels that are grains
const GRAIN_FPS = 10; // how often the grains reshuffle
const BRUSH_RADIUS = 42; // CSS px
const BRUSH_HEAT = 2.6; // heat stamped at the brush centre
const COOLING = 0.44; // heat lost per second
const BOTTOM_FADE = 34; // CSS px over which the sand thins out at the bottom
const STROKE_GAP_MS = 120; // moves further apart than this are separate strokes

// A cheap integer hash: the same (x, y, seed) always gives the same 32 random bits.
function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

function setupSand(el: HTMLElement) {
  const canvas = el.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const surface = (canvas.dataset.surface ?? '0').split(' ').map(Number);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let scale = 1; // device pixels per cell
  let cols = 0;
  let rows = 0;
  let heat = new Float32Array(0);
  let depth = new Float32Array(0); // how much sand a cell can hold: 0 above the surface, 1 well inside
  let image: ImageData | undefined;
  let pixels = new Uint32Array(0);

  let seed = 1;
  let warm = false; // any cell above 0
  let dirty = true;
  let visible = false;
  let raf = 0;
  let lastFrame = 0;
  let lastGrain = 0;
  let stroke: { x: number; y: number; time: number } | undefined;

  function resize() {
    const w = Math.ceil(canvas.clientWidth);
    const h = Math.ceil(canvas.clientHeight);
    if (w === cols && h === rows) return;
    cols = w;
    rows = h;
    scale = Math.min(2, Math.max(1, Math.round(devicePixelRatio)));
    heat = new Float32Array(cols * rows);
    depth = new Float32Array(cols * rows);
    for (let cx = 0; cx < cols; cx++) {
      // Interpolate the surface at this column.
      const at = (cx / Math.max(1, cols - 1)) * (surface.length - 1);
      const i = Math.min(surface.length - 1, Math.floor(at));
      const next = surface[Math.min(surface.length - 1, i + 1)];
      const top = (surface[i] + (next - surface[i]) * (at - i)) * cols;
      for (let cy = 0; cy < rows; cy++) {
        const below = Math.min(1, Math.max(0, cy + 1 - top));
        const above = Math.min(1, (rows - cy) / BOTTOM_FADE);
        depth[cy * cols + cx] = below * above;
      }
    }
    warm = false;
    canvas.width = cols * scale;
    canvas.height = rows * scale;
    image = cols && rows ? ctx.createImageData(canvas.width, canvas.height) : undefined;
    pixels = image ? new Uint32Array(image.data.buffer) : new Uint32Array(0);
    dirty = true;
    wake();
  }

  function draw() {
    if (!image) return;
    const width = cols * scale;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        const cool = depth[i] * (1 - Math.min(1, heat[i]));
        // Paper fades smoothly; grains thin out as they fade, so the edge of a stroke looks scattered.
        const paperAlpha = cool * cool * (3 - 2 * cool) * 255;
        const grainAlpha = Math.sqrt(cool) * 255;
        const grainChance = DENSITY * cool * 0x10000;
        for (let sy = 0; sy < scale; sy++) {
          const py = cy * scale + sy;
          for (let sx = 0; sx < scale; sx++) {
            const px = cx * scale + sx;
            const h = hash(px, py, seed);
            if ((h & 0xffff) < grainChance) {
              const shade = INK + (((h >>> 16) & 0xff) * 150) / 255;
              pixels[py * width + px] = (grainAlpha << 24) | (shade << 16) | (shade << 8) | shade;
            } else {
              pixels[py * width + px] = (paperAlpha << 24) | (PAPER << 16) | (PAPER << 8) | PAPER;
            }
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function stamp(x: number, y: number) {
    const x0 = Math.max(0, Math.floor(x - BRUSH_RADIUS));
    const x1 = Math.min(cols - 1, Math.ceil(x + BRUSH_RADIUS));
    const y0 = Math.max(0, Math.floor(y - BRUSH_RADIUS));
    const y1 = Math.min(rows - 1, Math.ceil(y + BRUSH_RADIUS));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const d2 = ((cx - x) ** 2 + (cy - y) ** 2) / BRUSH_RADIUS ** 2;
        if (d2 >= 1) continue;
        const i = cy * cols + cx;
        heat[i] = Math.max(heat[i], BRUSH_HEAT * (1 - d2) ** 2);
      }
    }
    warm = true;
  }

  function brush(e: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    // Fill in between pointer events so a fast swipe leaves a continuous trail.
    if (stroke && e.timeStamp - stroke.time < STROKE_GAP_MS) {
      const steps = Math.ceil(Math.hypot(x - stroke.x, y - stroke.y) / (BRUSH_RADIUS / 3));
      for (let s = 1; s < steps; s++) {
        stamp(stroke.x + ((x - stroke.x) * s) / steps, stroke.y + ((y - stroke.y) * s) / steps);
      }
    }
    stamp(x, y);
    stroke = { x, y, time: e.timeStamp };
    wake();
  }

  function cool(seconds: number) {
    warm = false;
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] > 0) {
        heat[i] = Math.max(0, heat[i] - COOLING * seconds);
        warm = true;
      }
    }
  }

  function frame(time: number) {
    raf = 0;
    if (warm) {
      cool(Math.min(0.1, (time - lastFrame) / 1000));
      dirty = true;
    }
    lastFrame = time;
    if (!still && time - lastGrain >= 1000 / GRAIN_FPS) {
      seed++;
      lastGrain = time;
      dirty = true;
    }
    if (dirty) {
      draw();
      dirty = false;
    }
    wake();
  }

  // Keep animating only while on screen, and (with reduced motion) only while something is changing.
  function wake() {
    if (raf || !visible) return;
    if (still && !warm && !dirty) return;
    raf = requestAnimationFrame((time) => {
      if (!lastFrame) lastFrame = time;
      frame(time);
    });
  }

  el.addEventListener('pointerdown', brush);
  el.addEventListener('pointermove', brush);
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    lastFrame = 0;
    wake();
  }).observe(el);
  resize();
}

document.querySelectorAll<HTMLElement>('[data-sand]').forEach(setupSand);
