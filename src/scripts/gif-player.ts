// Pause / step-through for GIFs marked by src/plugins/rehype-gif-player.ts.
//
// The animated image is swapped for its still frames, played on a timer with the GIF's own
// delays, so pausing holds exactly the frame on screen. Below the image:
//
//   playing:  pause
//   paused:   play  ←  2/5  →
//
// Clicking the image also toggles, and ←/→ step while the controls have focus (instead of
// changing piece, as they do elsewhere on the page).

function button(label: string, text: string) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'gif-button';
  el.setAttribute('aria-label', label);
  el.textContent = text;
  return el;
}

function setup(figure: HTMLElement) {
  const img = figure.querySelector('img')!;
  const frames = figure.dataset.gifFrames!.split(' ');
  const delays = figure.dataset.gifDelays!.split(' ').map(Number);

  let frame = 0;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer: number | undefined;

  // Show frame 0 instead of the animation; the other frames load in the background.
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  img.src = frames[0];
  const loaded = Promise.all(
    frames.map((src) => {
      const still = new Image();
      still.src = src;
      return still.decode().catch(() => undefined);
    }),
  );

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
  img.after(controls);

  function render() {
    img.src = frames[frame];
    counter.textContent = `${frame + 1}/${frames.length}`;
    toggle.textContent = playing ? 'pause' : 'play';
    toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    step.hidden = playing;
  }

  function tick() {
    timer = window.setTimeout(() => {
      frame = (frame + 1) % frames.length;
      render();
      tick();
    }, delays[frame]);
  }

  function setPlaying(value: boolean) {
    playing = value;
    window.clearTimeout(timer);
    timer = undefined;
    render();
    if (playing) {
      loaded.then(() => {
        if (playing && timer === undefined) tick();
      });
    }
  }

  function go(by: number) {
    frame = (frame + by + frames.length) % frames.length;
    setPlaying(false);
  }

  toggle.addEventListener('click', () => setPlaying(!playing));
  img.addEventListener('click', () => setPlaying(!playing));
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
