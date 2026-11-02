const video = document.querySelector('video');
const parentOrigin = location.ancestorOrigins?.[0] || '*';
const FORWARDED = new Set(['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'o', 'O', 'd', 'D']);
let pending = null;
let lastReport = 0;

function post(message) {
  parent.postMessage({ ghLightbox: true, ...message }, parentOrigin);
}

function play() {
  video
    .play()
    .catch(() => {
      video.muted = true;
      return video.play();
    })
    .catch(() => {});
}

function toggle() {
  if (video.paused) play();
  else video.pause();
}

function report() {
  lastReport = performance.now();
  post({ type: 'state', time: video.currentTime, paused: video.paused, muted: video.muted });
}

function load() {
  let state;
  let url;
  try {
    state = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    url = new URL(state.src);
  } catch {
    post({ type: 'error' });
    return;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    post({ type: 'error' });
    return;
  }
  pending = state;
  video.muted = Boolean(state.muted);
  video.preload = state.autoplay ? 'auto' : 'metadata';
  video.src = url.href;
}

video.addEventListener('loadedmetadata', () => {
  const state = pending;
  pending = null;
  if (state?.time > 0 && state.time < video.duration) video.currentTime = state.time;
  post({ type: 'ready', width: video.videoWidth, height: video.videoHeight, duration: video.duration });
  if (state?.autoplay) play();
});
video.addEventListener('error', () => post({ type: 'error', code: video.error?.code || 0 }));
video.addEventListener('play', report);
video.addEventListener('pause', report);
video.addEventListener('volumechange', report);
video.addEventListener('timeupdate', () => {
  if (performance.now() - lastReport > 500) report();
});

addEventListener('message', e => {
  if (e.source !== parent || !e.data?.ghLightbox) return;
  if (typeof e.data.muted === 'boolean') video.muted = e.data.muted;
  if (e.data.type === 'play') play();
  else if (e.data.type === 'pause') video.pause();
  else if (e.data.type === 'toggle') toggle();
  else if (e.data.type === 'mute') video.muted = !video.muted;
});

addEventListener(
  'keydown',
  e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      video.muted = !video.muted;
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else video.requestFullscreen().catch(() => {});
    } else if (FORWARDED.has(e.key) && !(e.key === 'Escape' && document.fullscreenElement)) {
      e.preventDefault();
      post({ type: 'key', key: e.key, shiftKey: e.shiftKey });
    }
  },
  true,
);

addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    post({ type: 'wheel', dx: e.deltaX * unit, dy: e.deltaY * unit, ctrlKey: e.ctrlKey });
  },
  { passive: false },
);

addEventListener('hashchange', load);
load();
