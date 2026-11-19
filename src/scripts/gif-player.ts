// Pause / step-through for GIFs marked by src/plugins/rehype-gif-player.ts.
//
// The animated image is swapped for its stops (the frames it rests on), played on a timer with
// the GIF's own delays, so pausing holds exactly the frame on screen. Below the image:
//
//   playing:  pause
//   paused:   play  ←  2/5  →
//
// Clicking the image also toggles, and ←/→ step while the controls have focus (instead of
// changing piece, as they do elsewhere on the page).
//
// Every stop is its own <img>, stacked over the original and shown by opacity, so changing frame
// never waits on a download or a decode. Where the GIF crossfades between two stops the player
// fades one still into the other with the GIF's timing; stepping by hand skips the fades.
//
// A GIF with variants (data-gif-alt-*) starts on a random one and picks again at random every
// time it plays through its seam stop, which looks the same in all of them, so the change is
// carried by the GIF's own fades. Stepping forward through the seam by hand picks again too;
// stepping backward stays within the variant on screen.

interface Fade {
  duration: number;
  keyframes: Keyframe[];
}

interface Variant {
  frames: string[];
  delays: number[];
  fades: (Fade | undefined)[];
}

function button(label: string, text: string) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'gif-button';
  el.setAttribute('aria-label', label);
  el.textContent = text;
  return el;
}

/** "1100:0.023@0.006,0.068@0.020" -> an opacity animation for the incoming still. */
function parseFade(text: string | undefined): Fade | undefined {
  if (!text || text === '-') return undefined;
  const [duration, points] = text.split(':');
  const keyframes = points.split(',').map((point) => {
    const [offset, opacity] = point.split('@').map(Number);
    return { offset, opacity };
  });
  return { duration: Number(duration), keyframes: [{ offset: 0, opacity: 0 }, ...keyframes, { offset: 1, opacity: 1 }] };
}

function parseVariants(data: DOMStringMap): Variant[] {
  const lists = (main: string | undefined, alt: string | undefined) => [main ?? '', ...(alt ? alt.split('|') : [])];
  const delays = lists(data.gifDelays, data.gifAltDelays);
  const fades = lists(data.gifFades, data.gifAltFades);
  return lists(data.gifFrames, data.gifAltFrames).map((frames, i) => ({
    frames: frames.split(' '),
    delays: delays[i].split(' ').map(Number),
    fades: frames.split(' ').map((_, stop) => parseFade(fades[i]?.split(' ')[stop])),
  }));
}

function setup(figure: HTMLElement) {
  const img = figure.querySelector('img')!;
  const variants = parseVariants(figure.dataset);
  const seam = Number(figure.dataset.gifSeam ?? 0);
  const pick = () => variants[Math.floor(Math.random() * variants.length)];

  let variant = pick();
  let at = 0; // the stop on screen (while fading: the one fading out)
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer: number | undefined;
  let fading: { animation: Animation; layer: HTMLImageElement } | undefined;

  // The original image keeps the figure's size and shows the first stop until the stills are in.
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  img.src = variant.frames[0];
  const stage = document.createElement('div');
  stage.className = 'gif-stage';
  img.replaceWith(stage);
  stage.append(img);

  const layers = new Map<string, HTMLImageElement>();
  for (const src of new Set(variants.flatMap(({ frames }) => frames))) {
    const layer = new Image();
    layer.className = 'gif-frame';
    layer.alt = '';
    layer.setAttribute('aria-hidden', 'true');
    layer.src = src;
    layers.set(src, layer);
    stage.append(layer);
  }
  const loaded = Promise.all([...layers.values()].map((layer) => layer.decode().catch(() => undefined)));
  const layerAt = (stop: number) => layers.get(variant.frames[stop])!;
  let shown = layerAt(0);
  shown.classList.add('is-shown');

  const controls = document.createElement('div');
  controls.className = 'gif-controls';
  const toggle = button('Pause', 'pause');
  const step = document.createElement('span');
  step.className = 'gif-step';
  const prev = button('Previous frame', '←');
  const next = button('Next frame', '→');
  const counter = document.createElement('span');
  counter.setAttribute('aria-live', 'polite');
  step.append(prev, counter, next);
  controls.append(toggle, step);
  stage.after(controls);

  function render() {
    const layer = layerAt(at);
    if (layer !== shown) {
      shown.classList.remove('is-shown');
      layer.classList.add('is-shown');
      shown = layer;
    }
    counter.textContent = `${at + 1}/${variant.frames.length}`;
    toggle.textContent = playing ? 'pause' : 'play';
    toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    step.hidden = playing;
  }

  /** Land on a stop. Moving forward onto the seam is where the next variant is drawn. */
  function arrive(stop: number, forward = true) {
    at = stop;
    if (forward && variants.length > 1 && at === Math.min(seam, variant.frames.length - 1)) {
      variant = pick();
      at = Math.min(at, variant.frames.length - 1);
    }
    render();
  }

  function endFade() {
    if (!fading) return;
    fading.animation.onfinish = null;
    fading.animation.cancel();
    fading.layer.classList.remove('is-fading-in');
    fading = undefined;
  }

  function advance() {
    const to = (at + 1) % variant.frames.length;
    const fade = variant.fades[at];
    const layer = layerAt(to);
    if (!fade || layer === shown) {
      arrive(to);
      hold();
      return;
    }
    layer.classList.add('is-fading-in');
    const animation = layer.animate(fade.keyframes, { duration: fade.duration, fill: 'forwards' });
    fading = { animation, layer };
    animation.onfinish = () => {
      arrive(to);
      endFade();
      hold();
    };
  }

  function hold() {
    timer = window.setTimeout(advance, variant.delays[at]);
  }

  function setPlaying(value: boolean) {
    playing = value;
    window.clearTimeout(timer);
    timer = undefined;
    render();
    if (fading) {
      // Pausing mid-fade holds the fade where it is; playing picks it up again.
      if (playing) fading.animation.play();
      else fading.animation.pause();
    } else if (playing) {
      loaded.then(() => {
        if (playing && timer === undefined && !fading) hold();
      });
    }
  }

  function go(by: number) {
    const count = variant.frames.length;
    // Mid-fade, ← returns to the stop being left and → finishes the move.
    const stop = fading && by < 0 ? at : (at + by + count) % count;
    endFade();
    playing = false;
    arrive(stop, by > 0);
    setPlaying(false);
  }

  toggle.addEventListener('click', () => setPlaying(!playing));
  stage.addEventListener('click', () => setPlaying(!playing));
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  controls.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'ArrowRight') go(1);
    else return;
    event.preventDefault();
    event.stopPropagation(); // elsewhere on the page ←/→ go to the previous / next piece (FogNav)
  });

  figure.classList.add('gif-player');
  setPlaying(playing);
}

document.querySelectorAll<HTMLElement>('figure[data-gif-frames]').forEach(setup);
