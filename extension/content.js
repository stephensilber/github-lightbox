(() => {
  if (globalThis.__githubImageLightbox) return;
  globalThis.__githubImageLightbox = true;

  const IMAGE_PATH = /\.(jpe?g|jfif|pjpe?g|pjp|png|apng|gif|webp|avif|bmp|svg|ico)$/i;
  const MARKDOWN = '.markdown-body, .comment-body, [data-testid="markdown-body"]';
  const INLINE_HOSTS = new Set([
    'camo.githubusercontent.com',
    'private-user-images.githubusercontent.com',
    'user-images.githubusercontent.com',
  ]);
  const GAP = 48;
  const OMEGA = { open: 19, close: 24, zoom: 24, fine: 42, nav: 17, snap: 22, glide: 6 };
  const SVG = 'http://www.w3.org/2000/svg';
  const ICONS = {
    close: ['M6 6l12 12', 'M18 6L6 18'],
    prev: ['M15 18l-6-6 6-6'],
    next: ['M9 6l6 6-6 6'],
    external: ['M14 4h6v6', 'M20 4l-8 8', 'M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5'],
    download: ['M12 4v11', 'M7 10.5l5 5 5-5', 'M5 20h14'],
  };

  const CSS = `
:host { all: initial; }
.root {
  position: absolute; inset: 0; outline: none; overflow: hidden;
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  color: #f0f3f6; -webkit-font-smoothing: antialiased;
  user-select: none; -webkit-user-select: none;
}
.backdrop { position: absolute; inset: 0; background: rgb(8 10 13); opacity: 0; }
.stage { position: absolute; inset: 0; overflow: hidden; touch-action: none; }
.stage.zoomed { cursor: grab; }
.stage.grabbing { cursor: grabbing; }
.track { position: absolute; inset: 0; transform: translate3d(0, 0, 0); }
.slide { position: absolute; inset: 0; overflow: hidden; }
.img {
  position: absolute; display: block; max-width: none; max-height: none; margin: 0;
  transform-origin: 50% 50%; opacity: 0; -webkit-user-drag: none; user-select: none;
}
.img.pixelated { image-rendering: pixelated; }
.spinner {
  position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px;
  border-radius: 50%; border: 2.5px solid rgb(255 255 255 / 0.18); border-top-color: rgb(255 255 255 / 0.9);
  animation: spin 0.75s linear infinite, appear 0.2s 0.3s both;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes appear { from { opacity: 0; } to { opacity: 1; } }
.error {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: grid; gap: 14px; justify-items: center; text-align: center;
  font-size: 14px; color: rgb(240 243 246 / 0.75);
}
.error a {
  color: #fff; text-decoration: none; font-weight: 600;
  padding: 7px 14px; border-radius: 8px; background: rgb(255 255 255 / 0.12);
}
.error a:hover { background: rgb(255 255 255 / 0.2); }
.ui { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
.bar, .nav, .strip { transition: opacity 0.25s ease; }
.root.idle .bar, .root.idle .nav, .root.idle .strip { opacity: 0; pointer-events: none; }
.root.idle .stage { cursor: none; }
.bar {
  position: absolute; top: 0; left: 0; right: 0; height: 56px;
  display: flex; align-items: center; gap: 2px; padding: 0 10px 0 20px;
  background: linear-gradient(rgb(0 0 0 / 0.4), transparent);
}
.count { flex: none; margin-right: 12px; font-variant-numeric: tabular-nums; color: rgb(240 243 246 / 0.6); }
.count:empty { display: none; }
.title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
button {
  font: inherit; color: inherit; margin: 0; padding: 0; border: 0; background: none;
  cursor: pointer; pointer-events: auto; -webkit-tap-highlight-color: transparent;
}
button:focus { outline: none; }
button:focus-visible, a:focus-visible { outline: 2px solid #4493f8; outline-offset: 2px; }
svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.btn {
  flex: none; width: 36px; height: 36px; border-radius: 8px;
  display: grid; place-items: center; color: rgb(240 243 246 / 0.85);
  transition: background 0.15s, color 0.15s;
}
.btn:hover { background: rgb(255 255 255 / 0.1); color: #fff; }
.zoom { width: auto; min-width: 52px; padding: 0 8px; font-size: 12px; font-variant-numeric: tabular-nums; color: rgb(240 243 246 / 0.6); }
.zoom:empty { display: none; }
.nav {
  position: absolute; top: 50%; width: 44px; height: 44px; margin-top: -22px; border-radius: 50%;
  display: grid; place-items: center; color: #fff; background: rgb(255 255 255 / 0.08);
  transition: opacity 0.25s ease, background 0.15s, transform 0.15s;
}
.nav:hover { background: rgb(255 255 255 / 0.16); }
.nav:active { transform: scale(0.94); }
.nav.prev { left: 14px; }
.nav.next { right: 14px; }
.nav:disabled { opacity: 0; pointer-events: none; }
.strip {
  position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%);
  max-width: calc(100% - 32px); display: flex; gap: 6px; padding: 6px;
  overflow-x: auto; scrollbar-width: none; border-radius: 12px; background: rgb(255 255 255 / 0.06);
  pointer-events: auto;
}
.strip::-webkit-scrollbar { display: none; }
.thumb {
  position: relative; flex: none; width: 52px; height: 52px; border-radius: 7px; overflow: hidden;
  background: rgb(255 255 255 / 0.07); opacity: 0.5; transition: opacity 0.15s;
}
.thumb:hover { opacity: 0.85; }
.thumb[aria-current="true"] { opacity: 1; }
.thumb::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px transparent; transition: box-shadow 0.15s; }
.thumb[aria-current="true"]::after { box-shadow: inset 0 0 0 2px #fff; }
.thumb img { display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.2s; }
.thumb img.loaded { opacity: 1; }
@media (max-width: 639px) {
  .nav { display: none; }
  .bar { padding-left: 14px; }
}
`;

  const srcCache = new Map();
  const pending = new Map();
  let sheet = null;
  let active = null;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function parseUrl(href) {
    try {
      return new URL(href, location.href);
    } catch {
      return null;
    }
  }

  function isGitHubHost(host) {
    return host === 'github.com' || host.endsWith('.github.com') || host.endsWith('.githubusercontent.com');
  }

  function rawUrl(url) {
    if (url.hostname === 'github.com') {
      const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
      if (m) return `${url.origin}/${m[1]}/${m[2]}/raw/${m[3]}`;
    }
    return url.href;
  }

  function fileName(url) {
    let name = url.pathname.split('/').pop() || '';
    try {
      name = decodeURIComponent(name);
    } catch {}
    return /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(name) || /^[0-9a-f]{20,}$/i.test(name) ? '' : name;
  }

  function titleFor(a, img, url) {
    const alt = img?.getAttribute('alt')?.trim();
    if (alt && !/^(image|img|screenshot|untitled)$/i.test(alt)) return alt;
    const text = a.textContent.trim();
    if (text && !/^https?:\/\//i.test(text)) return text;
    return fileName(url);
  }

  function describe(a) {
    if (!a.closest(MARKDOWN)) return null;
    const url = parseUrl(a.href);
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
    const img = a.querySelector('img');
    const imgSrc = img ? img.currentSrc || img.src : '';
    const raw = rawUrl(url);
    const isImageFile =
      IMAGE_PATH.test(url.pathname) || (url.hostname === 'github.com' && url.pathname.startsWith('/user-attachments/assets/'));
    const wrapsItself = Boolean(imgSrc) && (imgSrc === url.href || imgSrc === raw || INLINE_HOSTS.has(url.hostname));
    if (!isImageFile && !wrapsItself) return null;
    const src = wrapsItself ? imgSrc : raw;
    return {
      src,
      href: url.href,
      thumb: imgSrc || null,
      source: imgSrc ? img : null,
      title: titleFor(a, img, url),
      trusted: isGitHubHost(parseUrl(src)?.hostname || ''),
    };
  }

  function collect(clicked) {
    const items = [];
    const seen = new Map();
    let index = 0;
    for (const a of document.querySelectorAll('a[href]')) {
      if (!a.closest(MARKDOWN)) continue;
      if (a !== clicked && !a.getClientRects().length) continue;
      const item = describe(a);
      if (!item) continue;
      let i = seen.get(item.src);
      if (i === undefined) {
        i = items.push(item) - 1;
        seen.set(item.src, i);
      } else if (a === clicked) {
        items[i] = item;
      }
      if (a === clicked) index = i;
    }
    return { items, index };
  }

  function fromBase64(data) {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(data);
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // GitHub's CSP blocks most third-party image hosts, so a failed direct load is retried through the
  // service worker and shown from a blob: URL, which the CSP allows.
  function viaBackground(url) {
    let request = pending.get(url);
    if (!request) {
      request = Promise.resolve()
        .then(() => chrome.runtime.sendMessage({ type: 'fetch-image', url }))
        .then(res => {
          if (!res?.ok) throw new Error(res?.error || 'Image request failed');
          const src = URL.createObjectURL(new Blob([fromBase64(res.data)], { type: res.type }));
          srcCache.set(url, src);
          return src;
        });
      request.catch(() => pending.delete(url));
      pending.set(url, request);
    }
    return request;
  }

  function loadInto(img, src) {
    return new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = src;
    });
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    el.append(...children);
    return el;
  }

  function icon(name) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONS[name]) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  function button(cls, label, iconName, onClick) {
    const b = h('button', { type: 'button', class: cls, 'aria-label': label, title: label });
    if (iconName) b.append(icon(iconName));
    b.addEventListener('click', onClick);
    return b;
  }

  function adoptStyles(root) {
    try {
      if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
      }
      root.adoptedStyleSheets = [sheet];
    } catch {
      root.append(h('style', {}, CSS));
    }
  }

  function rubber(v, lo, hi, dim) {
    const resist = d => (1 - 1 / ((d * 0.55) / dim + 1)) * dim;
    if (v < lo) return lo - resist(lo - v);
    if (v > hi) return hi + resist(v - hi);
    return v;
  }

  function axisBounds(size, view, center) {
    const lo = size / 2 - center;
    const hi = view - center - size / 2;
    if (size <= view) {
      const v = clamp(0, lo, hi);
      return [v, v];
    }
    return [hi, lo];
  }

  function velocity(samples, now) {
    const a = samples[0];
    const b = samples[samples.length - 1];
    if (samples.length < 2 || now - b[2] > 80) return [0, 0];
    const dt = Math.max(0.016, (b[2] - a[2]) / 1000);
    return [clamp((b[0] - a[0]) / dt, -6000, 6000), clamp((b[1] - a[1]) / dt, -6000, 6000)];
  }

  // Critically damped spring solved in closed form, so it stays stable at any frame time. Springs that
  // share an omega and start at rest move in lockstep, which keeps the zoom anchor under the cursor.
  class Spring {
    constructor(value, eps) {
      this.p = value;
      this.t = value;
      this.v = 0;
      this.w = OMEGA.snap;
      this.eps = eps;
    }

    set(value) {
      this.p = this.t = value;
      this.v = 0;
    }

    to(target, w, v) {
      this.t = target;
      if (w) this.w = w;
      if (v !== undefined) this.v = v;
    }

    step(dt) {
      if (this.p === this.t && this.v === 0) return false;
      const w = this.w;
      const x0 = this.p - this.t;
      const b = this.v + w * x0;
      const e = Math.exp(-w * dt);
      this.p = this.t + (x0 + b * dt) * e;
      this.v = (this.v - w * b * dt) * e;
      if (Math.abs(this.p - this.t) < this.eps && Math.abs(this.v) < this.eps * 20) {
        this.p = this.t;
        this.v = 0;
        return false;
      }
      return true;
    }
  }

  class Slide {
    constructor(box, item, index) {
      this.box = box;
      this.item = item;
      this.index = index;
      this.s = new Spring(1, 0.0005);
      this.x = new Spring(0, 0.1);
      this.y = new Spring(0, 0.1);
      this.a = new Spring(0, 0.003);
      this.nw = this.nh = this.fw = this.fh = 0;
      this.maxS = 4;
      this.started = this.ready = this.failed = this.dead = false;
      this.img = h('img', { class: 'img', alt: item.title, draggable: 'false', decoding: 'async' });
      this.img.addEventListener('load', () => this.loaded());
      this.img.addEventListener('error', () => this.errored());
      this.spinner = h('div', { class: 'spinner' });
      this.el = h('div', { class: 'slide' }, this.img, this.spinner);
    }

    start(priority) {
      if (this.started) return;
      this.started = true;
      const cached = srcCache.get(this.item.src);
      this.direct = !cached;
      this.img.fetchPriority = priority;
      this.img.src = cached || this.item.src;
    }

    async loaded() {
      await this.img.decode().catch(() => {});
      if (this.dead || this.ready) return;
      this.nw = this.img.naturalWidth || 1200;
      this.nh = this.img.naturalHeight || 900;
      this.ready = true;
      this.spinner.remove();
      this.box.slideReady(this);
    }

    errored() {
      if (this.dead || this.ready) return;
      if (this.direct) {
        this.direct = false;
        viaBackground(this.item.src).then(
          src => {
            if (!this.dead) this.img.src = src;
          },
          () => this.fail(),
        );
      } else {
        this.fail();
      }
    }

    fail() {
      if (this.dead || this.failed) return;
      this.failed = true;
      this.spinner.remove();
      this.el.append(
        h(
          'div',
          { class: 'error' },
          h('div', {}, 'Couldn’t preview this image'),
          h('a', { href: this.item.href, target: '_blank', rel: 'noopener noreferrer' }, 'Open link'),
        ),
      );
    }

    destroy() {
      this.dead = true;
      this.el.remove();
    }
  }

  class Lightbox {
    constructor(items, index, anchor) {
      this.items = items;
      this.index = index;
      this.anchor = anchor;
      this.slides = new Map();
      this.open = new Spring(0, 0.003);
      this.track = new Spring(0, 0.1);
      this.raf = 0;
      this.last = 0;
      this.drag = null;
      this.closing = this.dead = this.revealed = this.dismissing = false;
      this.hidden = null;
      this.zoomText = null;
      this.thumbs = null;
      this.thumbQueue = [];
      this.thumbBusy = 0;
      this.thumbsOn = false;
      this.wheelAcc = 0;
      this.lastWheel = 0;
      this.tick = this.tick.bind(this);
      this.build();
      this.measure();
      this.sync();
      this.updateUi(true);
      this.open.to(1, OMEGA.open);
      this.kick();
      this.root.focus({ preventScroll: true });
      this.thumbTimer = setTimeout(() => this.unlockThumbs(), 1200);
    }

    get cur() {
      return this.slides.get(this.index);
    }

    build() {
      this.host = document.createElement('div');
      this.host.setAttribute('data-github-image-lightbox', '');
      this.host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:block;margin:0;padding:0;border:0;';
      this.shadow = this.host.attachShadow({ mode: 'open' });
      adoptStyles(this.shadow);

      this.backdrop = h('div', { class: 'backdrop' });
      this.trackEl = h('div', { class: 'track' });
      this.stage = h('div', { class: 'stage' }, this.trackEl);
      this.countEl = h('span', { class: 'count' });
      this.titleEl = h('span', { class: 'title' });
      this.zoomBtn = button('btn zoom', 'Toggle zoom (Z)', null, () => this.toggleZoom());
      const bar = h(
        'div',
        { class: 'bar' },
        this.countEl,
        this.titleEl,
        this.zoomBtn,
        button('btn', 'Open original (O)', 'external', () => this.openOriginal()),
        button('btn', 'Download (D)', 'download', () => this.download()),
        button('btn', 'Close (Esc)', 'close', () => this.close()),
      );
      this.prevBtn = button('nav prev', 'Previous (←)', 'prev', () => this.go(-1));
      this.nextBtn = button('nav next', 'Next (→)', 'next', () => this.go(1));
      this.ui = h('div', { class: 'ui' }, bar);
      if (this.items.length > 1) this.ui.append(this.prevBtn, this.nextBtn, this.buildStrip());
      this.root = h(
        'div',
        { class: 'root', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Image viewer', tabindex: '-1' },
        this.backdrop,
        this.stage,
        this.ui,
      );
      this.shadow.append(this.root);
      document.documentElement.append(this.host);

      this.stage.addEventListener('pointerdown', e => this.pointerDown(e));
      this.stage.addEventListener('pointermove', e => this.pointerMove(e));
      this.stage.addEventListener('pointerup', e => this.pointerUp(e, true));
      this.stage.addEventListener('pointercancel', e => this.pointerUp(e, false));
      this.stage.addEventListener('dblclick', e => this.doubleClick(e));
      this.root.addEventListener('wheel', e => this.wheel(e), { passive: false });
      this.root.addEventListener('pointermove', () => this.poke());
      this.onKey = e => this.key(e);
      this.onResize = () => this.resize();
      this.onLeave = () => this.destroy();
      addEventListener('keydown', this.onKey, true);
      addEventListener('resize', this.onResize);
      addEventListener('popstate', this.onLeave);
      document.addEventListener('turbo:before-visit', this.onLeave);
    }

    buildStrip() {
      this.strip = h('div', { class: 'strip' });
      this.io = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this.io.unobserve(entry.target);
            this.thumbQueue.push(this.thumbs[Number(entry.target.dataset.i)]);
          }
          this.pumpThumbs();
        },
        { root: this.strip, rootMargin: '0px 240px' },
      );
      this.thumbs = this.items.map((item, i) => {
        const img = h('img', { alt: '', draggable: 'false', decoding: 'async' });
        img.addEventListener('load', () => img.classList.add('loaded'));
        const b = button('thumb', item.title ? `Image ${i + 1}: ${item.title}` : `Image ${i + 1}`, null, () => this.goTo(i));
        b.dataset.i = String(i);
        b.append(img);
        this.strip.append(b);
        const thumb = { b, img, item, done: false };
        if (item.thumb) {
          img.src = item.thumb;
          thumb.done = true;
        } else {
          this.io.observe(b);
        }
        return thumb;
      });
      return this.strip;
    }

    unlockThumbs() {
      if (this.thumbsOn) return;
      this.thumbsOn = true;
      this.pumpThumbs();
    }

    pumpThumbs() {
      if (!this.thumbsOn || this.dead) return;
      while (this.thumbBusy < 2 && this.thumbQueue.length) {
        const thumb = this.thumbQueue.shift();
        // Links to non-GitHub hosts only load once you navigate to them, so opening the viewer
        // doesn't ping every third-party server mentioned on the page.
        if (thumb.done || (!thumb.item.trusted && !srcCache.has(thumb.item.src))) continue;
        thumb.done = true;
        this.thumbBusy++;
        this.loadThumb(thumb).finally(() => {
          this.thumbBusy--;
          this.pumpThumbs();
        });
      }
    }

    async loadThumb(thumb) {
      thumb.img.fetchPriority = 'low';
      const cached = srcCache.get(thumb.item.src);
      try {
        await loadInto(thumb.img, cached || thumb.item.src);
      } catch {
        if (cached || this.dead) return;
        try {
          await loadInto(thumb.img, await viaBackground(thumb.item.src));
        } catch {}
      }
    }

    fillThumb(slide) {
      const thumb = this.thumbs?.[slide.index];
      if (!thumb || thumb.done) return;
      thumb.done = true;
      thumb.img.src = slide.img.currentSrc || slide.img.src;
    }

    measure() {
      this.vw = this.host.clientWidth || innerWidth;
      this.vh = this.host.clientHeight || innerHeight;
      const compact = this.vw < 640;
      const multiple = this.items.length > 1;
      this.padX = compact ? 8 : 72;
      this.padTop = compact ? 48 : 60;
      this.padBottom = multiple ? (compact ? 76 : 88) : compact ? 16 : 40;
      this.cx = this.vw / 2;
      this.cy = this.padTop + (this.vh - this.padTop - this.padBottom) / 2;
      this.pitch = this.vw + GAP;
    }

    fit(slide) {
      if (!slide.ready) return;
      const aw = Math.max(80, this.vw - this.padX * 2);
      const ah = Math.max(80, this.vh - this.padTop - this.padBottom);
      const r = Math.min(1, aw / slide.nw, ah / slide.nh);
      slide.fw = slide.nw * r;
      slide.fh = slide.nh * r;
      slide.maxS = Math.max(4, (slide.nw / slide.fw) * 4);
      const style = slide.img.style;
      style.width = `${slide.fw}px`;
      style.height = `${slide.fh}px`;
      style.left = `${this.cx - slide.fw / 2}px`;
      style.top = `${this.cy - slide.fh / 2}px`;
    }

    bounds(slide, s) {
      const [minX, maxX] = axisBounds(slide.fw * s, this.vw, this.cx);
      const [minY, maxY] = axisBounds(slide.fh * s, this.vh, this.cy);
      return { minX, maxX, minY, maxY };
    }

    sync() {
      const lo = Math.max(0, this.index - 1);
      const hi = Math.min(this.items.length - 1, this.index + 1);
      for (const [i, slide] of this.slides) {
        if (i < lo || i > hi) {
          slide.destroy();
          this.slides.delete(i);
        }
      }
      for (let i = lo; i <= hi; i++) {
        let slide = this.slides.get(i);
        if (!slide) {
          slide = new Slide(this, this.items[i], i);
          this.slides.set(i, slide);
          this.trackEl.append(slide.el);
        }
        slide.el.style.transform = `translate3d(${(i - this.index) * this.pitch}px,0,0)`;
      }
      this.cur.start('high');
      for (const [i, slide] of this.slides) {
        if (i !== this.index && (slide.item.trusted || srcCache.has(slide.item.src))) slide.start('low');
      }
    }

    slideReady(slide) {
      if (this.closing) return;
      this.fit(slide);
      this.fillThumb(slide);
      if (slide.index !== this.index) {
        slide.a.set(1);
        this.render();
        return;
      }
      if (!this.revealed) {
        this.reveal(slide);
      } else {
        slide.a.set(0);
        slide.s.set(0.97);
        slide.a.to(1, OMEGA.snap);
        slide.s.to(1, OMEGA.snap);
      }
      this.unlockThumbs();
      this.updateUi();
      this.kick();
    }

    reveal(slide) {
      this.revealed = true;
      const r = this.sourceRect(slide.item);
      if (r) {
        slide.s.set(r.width / slide.fw);
        slide.x.set(r.left + r.width / 2 - this.cx - this.track.p);
        slide.y.set(r.top + r.height / 2 - this.cy);
        slide.a.set(1);
        this.hideSource(slide.item.source);
        slide.s.to(1, OMEGA.open);
        slide.x.to(0, OMEGA.open);
        slide.y.to(0, OMEGA.open);
      } else {
        slide.s.set(0.94);
        slide.a.set(0);
        slide.s.to(1, OMEGA.open);
        slide.a.to(1, OMEGA.open);
      }
    }

    sourceRect(item) {
      const el = item.source;
      if (!el?.isConnected) return null;
      const r = el.getBoundingClientRect();
      const visible = r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < this.vh && r.left < this.vw;
      return visible ? r : null;
    }

    hideSource(el) {
      if (this.hidden?.el === el) return;
      this.restoreSource();
      if (!el) return;
      this.hidden = { el, visibility: el.style.visibility };
      el.style.visibility = 'hidden';
    }

    restoreSource() {
      if (!this.hidden) return;
      this.hidden.el.style.visibility = this.hidden.visibility;
      this.hidden = null;
    }

    kick() {
      if (this.raf || this.dead) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }

    tick(now) {
      this.raf = 0;
      if (this.dead) return;
      const dt = clamp((now - this.last) / 1000, 0, 0.05);
      this.last = now;
      let moving = this.open.step(dt);
      moving = this.track.step(dt) || moving;
      for (const slide of this.slides.values()) {
        moving = slide.s.step(dt) || moving;
        moving = slide.x.step(dt) || moving;
        moving = slide.y.step(dt) || moving;
        moving = slide.a.step(dt) || moving;
      }
      this.render();
      if (this.closing) {
        if (this.open.p < 0.05) this.host.style.pointerEvents = 'none';
        if (!moving) return this.destroy();
      }
      if (moving) this.raf = requestAnimationFrame(this.tick);
      else if (!this.closing) this.restoreSource();
    }

    dismissAmount() {
      const cur = this.cur;
      return this.dismissing && cur ? Math.min(1, Math.abs(cur.y.p) / (this.vh * 0.5)) : 0;
    }

    render() {
      this.trackEl.style.transform = `translate3d(${this.track.p}px,0,0)`;
      const cur = this.cur;
      const dismiss = this.dismissAmount();
      const open = clamp(this.open.p, 0, 1);
      this.backdrop.style.opacity = String(open * (1 - dismiss * 0.8));
      this.ui.style.opacity = String(open * (1 - dismiss));
      for (const slide of this.slides.values()) {
        if (!slide.ready) continue;
        const s = slide.s.p * (slide === cur ? 1 - dismiss * 0.12 : 1);
        slide.img.style.transform = `translate3d(${slide.x.p}px,${slide.y.p}px,0) scale(${s})`;
        slide.img.style.opacity = String(clamp(slide.a.p, 0, 1));
      }
      if (!cur?.ready) return;
      const pct = Math.round(((cur.s.p * cur.fw) / cur.nw) * 100);
      const text = `${pct}%`;
      if (text !== this.zoomText) {
        this.zoomText = text;
        this.zoomBtn.textContent = text;
        cur.img.classList.toggle('pixelated', pct >= 400);
      }
      this.stage.classList.toggle('zoomed', cur.s.t > 1.001);
    }

    updateUi(initial) {
      const n = this.items.length;
      const item = this.items[this.index];
      this.countEl.textContent = n > 1 ? `${this.index + 1} / ${n}` : '';
      this.titleEl.textContent = item.title || '';
      this.titleEl.title = item.title || '';
      this.prevBtn.disabled = this.index === 0;
      this.nextBtn.disabled = this.index === n - 1;
      if (!this.cur?.ready) {
        this.zoomText = null;
        this.zoomBtn.textContent = '';
      }
      if (this.thumbs) {
        this.thumbs.forEach((thumb, i) => thumb.b.setAttribute('aria-current', String(i === this.index)));
        const b = this.thumbs[this.index].b;
        this.strip.scrollTo({
          left: b.offsetLeft - (this.strip.clientWidth - b.offsetWidth) / 2,
          behavior: initial ? 'instant' : 'smooth',
        });
      }
      this.render();
    }

    go(delta, velocity) {
      if (this.closing || !delta) return;
      const next = this.index + delta;
      if (next < 0 || next >= this.items.length) {
        if (velocity === undefined) this.track.to(0, OMEGA.snap, -Math.sign(delta) * 900);
        this.kick();
        return;
      }
      const prev = this.cur;
      if (prev?.ready) {
        prev.s.to(1, OMEGA.nav);
        prev.x.to(0, OMEGA.nav);
        prev.y.to(0, OMEGA.nav);
      }
      this.restoreSource();
      this.dismissing = false;
      this.index = next;
      this.track.p = clamp(this.track.p + Math.sign(delta) * this.pitch, -2 * this.pitch, 2 * this.pitch);
      this.track.to(0, OMEGA.nav, velocity ?? this.track.v);
      this.sync();
      this.updateUi();
      this.poke();
      this.kick();
    }

    goTo(i) {
      if (i !== this.index) this.go(i - this.index);
    }

    zoomTo(slide, scale, px, py, w = OMEGA.zoom) {
      if (!slide?.ready || this.closing) return;
      const ns = clamp(scale, 1, slide.maxS);
      const k = ns / slide.s.t;
      const b = this.bounds(slide, ns);
      const nx = clamp(px - this.cx - (px - this.cx - slide.x.t) * k, b.minX, b.maxX);
      const ny = clamp(py - this.cy - (py - this.cy - slide.y.t) * k, b.minY, b.maxY);
      slide.s.to(ns, w);
      slide.x.to(nx, w);
      slide.y.to(ny, w);
      this.dismissing = false;
      this.poke();
      this.kick();
    }

    toggleZoom(px = this.vw / 2, py = this.vh / 2) {
      const cur = this.cur;
      if (!cur?.ready) return;
      if (cur.s.t > 1.001) this.zoomTo(cur, 1, px, py);
      else this.zoomTo(cur, Math.max(2.5, cur.nw / cur.fw), px, py);
    }

    hitImage(x, y) {
      const cur = this.cur;
      if (!cur?.ready) return false;
      const r = cur.img.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    pointerDown(e) {
      if (e.button !== 0 || this.closing || this.drag || e.target.closest('.error')) return;
      this.stage.setPointerCapture(e.pointerId);
      this.drag = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        mode: null,
        onImage: this.hitImage(e.clientX, e.clientY),
        samples: [[e.clientX, e.clientY, e.timeStamp]],
      };
    }

    pointerMove(e) {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      d.samples.push([e.clientX, e.clientY, e.timeStamp]);
      while (d.samples.length > 2 && e.timeStamp - d.samples[0][2] > 100) d.samples.shift();
      const cur = this.cur;
      if (!d.mode) {
        const mx = e.clientX - d.sx;
        const my = e.clientY - d.sy;
        if (Math.hypot(mx, my) < 6) return;
        const ready = cur?.ready;
        d.mode = ready && cur.s.t > 1.001 ? 'pan' : Math.abs(mx) >= Math.abs(my) || !ready ? 'swipe' : 'dismiss';
        d.sx = e.clientX;
        d.sy = e.clientY;
        d.bt = this.track.p;
        this.track.set(this.track.p);
        if (ready) {
          d.bx = cur.x.p;
          d.by = cur.y.p;
          cur.x.set(cur.x.p);
          cur.y.set(cur.y.p);
          if (d.mode === 'pan') cur.s.set(cur.s.p);
        }
        this.dismissing = d.mode === 'dismiss';
        this.stage.classList.add('grabbing');
      }
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.mode === 'pan') {
        const b = this.bounds(cur, cur.s.p);
        cur.x.set(rubber(d.bx + dx, b.minX, b.maxX, this.vw));
        cur.y.set(rubber(d.by + dy, b.minY, b.maxY, this.vh));
      } else if (d.mode === 'swipe') {
        const t = d.bt + dx;
        const atEdge = (this.index === 0 && t > 0) || (this.index === this.items.length - 1 && t < 0);
        this.track.set(atEdge ? rubber(t, 0, 0, this.vw) : t);
      } else {
        cur.x.set(d.bx + dx);
        cur.y.set(d.by + dy);
      }
      this.render();
    }

    pointerUp(e, released) {
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      this.stage.classList.remove('grabbing');
      if (!d.mode) {
        if (released && !d.onImage) this.close();
        return;
      }
      const [vx, vy] = velocity(d.samples, e.timeStamp);
      const cur = this.cur;
      if (d.mode === 'pan') {
        this.glide(cur, vx, vy);
      } else if (d.mode === 'swipe') {
        const off = this.track.p;
        const threshold = Math.min(this.pitch * 0.18, 140);
        const dir = off < -threshold || (vx < -400 && off < 0) ? 1 : off > threshold || (vx > 400 && off > 0) ? -1 : 0;
        const target = this.index + dir;
        if (dir && target >= 0 && target < this.items.length) this.go(dir, vx);
        else this.track.to(0, OMEGA.snap, vx);
      } else if (Math.abs(cur.y.p) > 110 || (Math.abs(vy) > 700 && Math.sign(vy) === Math.sign(cur.y.p))) {
        this.close(vy);
      } else {
        cur.x.to(0, OMEGA.snap, vx);
        cur.y.to(0, OMEGA.snap, vy);
      }
      this.kick();
    }

    glide(slide, vx, vy) {
      const b = this.bounds(slide, slide.s.p);
      const gx = slide.x.p + vx / OMEGA.glide;
      const gy = slide.y.p + vy / OMEGA.glide;
      const tx = clamp(gx, b.minX, b.maxX);
      const ty = clamp(gy, b.minY, b.maxY);
      slide.x.to(tx, tx === gx ? OMEGA.glide : OMEGA.snap, vx);
      slide.y.to(ty, ty === gy ? OMEGA.glide : OMEGA.snap, vy);
    }

    doubleClick(e) {
      const cur = this.cur;
      if (!cur?.ready || this.closing) return;
      if (cur.s.t > 1.001 || this.hitImage(e.clientX, e.clientY)) this.toggleZoom(e.clientX, e.clientY);
    }

    wheel(e) {
      e.preventDefault();
      if (this.closing) return;
      if (this.strip && e.composedPath().includes(this.strip)) {
        this.strip.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        return;
      }
      const cur = this.cur;
      if (!cur?.ready || this.drag) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.vh : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      const gap = e.timeStamp - this.lastWheel;
      this.lastWheel = e.timeStamp;
      if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) {
        if (cur.s.t > 1.001) {
          const b = this.bounds(cur, cur.s.t);
          cur.x.to(clamp(cur.x.t - dx, b.minX, b.maxX), OMEGA.fine);
          this.kick();
        } else {
          this.wheelSwipe(dx, gap);
        }
        return;
      }
      if (!dy) return;
      // Notched mouse wheels report wheelDeltaY in steps of 120; trackpads and pinches stream small deltas.
      const notches = !e.ctrlKey && e.wheelDeltaY && e.wheelDeltaY % 120 === 0 ? -e.wheelDeltaY / 120 : 0;
      const amount = e.ctrlKey ? dy * 0.012 : notches ? notches * 0.22 : dy * 0.0035;
      this.zoomTo(cur, cur.s.t * Math.exp(-amount), e.clientX, e.clientY, notches ? OMEGA.zoom : OMEGA.fine);
    }

    // Trackpad momentum keeps sending wheel events after a flick, so one gesture is allowed to
    // change the image once and has to go quiet before the next swipe counts.
    wheelSwipe(dx, gap) {
      if (gap > 200) {
        this.wheelAcc = 0;
        this.wheelLocked = false;
      }
      if (this.wheelLocked) return;
      this.wheelAcc += dx;
      if (Math.abs(this.wheelAcc) > 60) {
        this.wheelLocked = true;
        this.go(Math.sign(this.wheelAcc));
      }
    }

    key(e) {
      if (this.dead || e.metaKey || e.ctrlKey || e.altKey) return;
      e.stopImmediatePropagation();
      if (this.closing) return;
      const target = e.composedPath()[0];
      if ((e.key === 'Enter' || e.key === ' ') && target instanceof HTMLElement && target.matches('button, a')) return;
      const cur = this.cur;
      const step = 120;
      switch (e.key) {
        case 'Escape':
          this.close();
          break;
        case 'ArrowLeft':
          this.go(-1);
          break;
        case 'ArrowRight':
        case ' ':
          this.go(e.shiftKey ? -1 : 1);
          break;
        case 'Home':
          this.goTo(0);
          break;
        case 'End':
          this.goTo(this.items.length - 1);
          break;
        case '+':
        case '=':
          this.zoomTo(cur, (cur?.s.t || 1) * 1.5, this.vw / 2, this.vh / 2);
          break;
        case '-':
        case '_':
          this.zoomTo(cur, (cur?.s.t || 1) / 1.5, this.vw / 2, this.vh / 2);
          break;
        case '0':
          this.zoomTo(cur, 1, this.vw / 2, this.vh / 2);
          break;
        case 'z':
        case 'Z':
          this.toggleZoom();
          break;
        case 'o':
        case 'O':
          this.openOriginal();
          break;
        case 'd':
        case 'D':
          this.download();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          if (cur?.ready && cur.s.t > 1.001) {
            const b = this.bounds(cur, cur.s.t);
            cur.y.to(clamp(cur.y.t + (e.key === 'ArrowUp' ? step : -step), b.minY, b.maxY), OMEGA.zoom);
            this.kick();
          }
          break;
        case 'Tab':
          this.trapFocus(e);
          return;
        default:
          return;
      }
      e.preventDefault();
    }

    trapFocus(e) {
      e.preventDefault();
      const focusable = [...this.root.querySelectorAll('button:not(:disabled), a[href]')].filter(el => el.getClientRects().length);
      if (!focusable.length) return;
      const i = focusable.indexOf(this.shadow.activeElement);
      const next = e.shiftKey ? (i <= 0 ? focusable.length - 1 : i - 1) : (i + 1) % focusable.length;
      focusable[next].focus();
    }

    poke() {
      this.root.classList.remove('idle');
      clearTimeout(this.idleTimer);
      const cur = this.cur;
      if (cur?.ready && cur.s.t > 1.001) this.idleTimer = setTimeout(() => this.root.classList.add('idle'), 2000);
    }

    resize() {
      this.measure();
      for (const [i, slide] of this.slides) {
        slide.el.style.transform = `translate3d(${(i - this.index) * this.pitch}px,0,0)`;
        if (!slide.ready) continue;
        this.fit(slide);
        const s = clamp(slide.s.t, 1, slide.maxS);
        const b = this.bounds(slide, s);
        slide.s.set(s);
        slide.x.set(clamp(slide.x.t, b.minX, b.maxX));
        slide.y.set(clamp(slide.y.t, b.minY, b.maxY));
      }
      this.track.set(0);
      this.render();
    }

    openOriginal() {
      window.open(this.items[this.index].href, '_blank', 'noopener,noreferrer');
    }

    download() {
      const item = this.items[this.index];
      Promise.resolve()
        .then(() => chrome.runtime.sendMessage({ type: 'download', url: item.src }))
        .then(res => {
          if (!res?.ok) throw new Error(res?.error);
        })
        .catch(() => window.open(item.href, '_blank', 'noopener,noreferrer'));
    }

    close(vy) {
      if (this.closing || this.dead) return;
      const cur = this.cur;
      const dismiss = this.dismissAmount();
      this.closing = true;
      this.open.to(0, OMEGA.close);
      this.track.to(0, OMEGA.close);
      const r = cur?.ready ? this.sourceRect(cur.item) : null;
      if (r && Math.abs(this.track.p) < this.pitch / 2) {
        cur.s.p *= 1 - dismiss * 0.12;
        this.dismissing = false;
        this.hideSource(cur.item.source);
        cur.s.to(r.width / cur.fw, OMEGA.close);
        cur.x.to(r.left + r.width / 2 - this.cx, OMEGA.close);
        cur.y.to(r.top + r.height / 2 - this.cy, OMEGA.close);
      } else if (cur?.ready && this.dismissing) {
        cur.y.to(Math.sign(cur.y.p || vy || 1) * this.vh, 12, vy);
        cur.a.to(0, 18);
      } else if (cur?.ready) {
        cur.a.to(0, OMEGA.close);
        cur.s.to(cur.s.t * 0.94, OMEGA.close);
      }
      this.kick();
      this.safety = setTimeout(() => this.destroy(), 1000);
    }

    destroy() {
      if (this.dead) return;
      this.dead = true;
      cancelAnimationFrame(this.raf);
      clearTimeout(this.safety);
      clearTimeout(this.idleTimer);
      clearTimeout(this.thumbTimer);
      removeEventListener('keydown', this.onKey, true);
      removeEventListener('resize', this.onResize);
      removeEventListener('popstate', this.onLeave);
      document.removeEventListener('turbo:before-visit', this.onLeave);
      this.io?.disconnect();
      for (const slide of this.slides.values()) slide.destroy();
      this.host.remove();
      this.restoreSource();
      if (active === this) active = null;
      if (this.anchor?.isConnected) this.anchor.focus({ preventScroll: true });
    }
  }

  addEventListener(
    'click',
    e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!a || !describe(a)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const { items, index } = collect(a);
      if (!items.length) return;
      active?.destroy();
      active = new Lightbox(items, index, a);
    },
    true,
  );
})();
