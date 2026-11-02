import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const EXTENSION = resolve('extension');

export async function launchWithExtension() {
  const profile = await mkdtemp(join(tmpdir(), 'gh-lightbox-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return {
    context,
    worker,
    async dispose() {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    },
  };
}

export async function makeImages(context, specs) {
  const page = await context.newPage();
  await page.goto('about:blank');
  const out = {};
  for (const [name, spec] of Object.entries(specs)) {
    const dataUrl = await page.evaluate(({ w, h, label, hue, type }) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d');
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsl(${hue} 70% 45%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360} 70% 30%)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      for (let x = 0; x < w; x += 50) {
        g.beginPath();
        g.moveTo(x + 0.5, 0);
        g.lineTo(x + 0.5, h);
        g.stroke();
      }
      for (let y = 0; y < h; y += 50) {
        g.beginPath();
        g.moveTo(0, y + 0.5);
        g.lineTo(w, y + 0.5);
        g.stroke();
      }
      g.fillStyle = '#fff';
      g.font = `700 ${Math.round(Math.min(w, h) / 5)}px -apple-system, Helvetica, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, w / 2, h / 2);
      g.font = `500 ${Math.round(Math.min(w, h) / 22)}px -apple-system, Helvetica, sans-serif`;
      g.fillText(`${w} × ${h}`, w / 2, h / 2 + Math.min(w, h) / 6);
      return canvas.toDataURL(type, 0.9);
    }, spec);
    out[name] = Buffer.from(dataUrl.split(',')[1], 'base64');
  }
  await page.close();
  return out;
}

export async function viewerState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-github-image-lightbox]')?.shadowRoot;
    if (!root) return null;
    const slide = [...root.querySelectorAll('.slide')].find(s => /translate3d\(0px/.test(s.style.transform));
    const img = slide?.querySelector('img');
    const scale = Number(/scale\(([\d.e-]+)\)/.exec(img?.style.transform || '')?.[1] || 0);
    const translate = /translate3d\((-?[\d.e-]+)px, (-?[\d.e-]+)px/.exec(img?.style.transform || '');
    return {
      count: root.querySelector('.count')?.textContent ?? '',
      title: root.querySelector('.title')?.textContent ?? '',
      zoom: root.querySelector('.zoom')?.textContent ?? '',
      src: img?.src ?? '',
      nw: img?.naturalWidth ?? 0,
      nh: img?.naturalHeight ?? 0,
      opacity: Number(img?.style.opacity || 0),
      scale,
      x: translate ? Number(translate[1]) : 0,
      y: translate ? Number(translate[2]) : 0,
      error: Boolean(slide?.querySelector('.error')),
      styled: getComputedStyle(root.querySelector('.root')).position === 'absolute',
      thumbsLoaded: [...root.querySelectorAll('.thumb img.loaded')].length,
    };
  });
}

export async function waitForImage(page, expected = {}) {
  let state;
  await expectPoll(async () => {
    state = await viewerState(page);
    return Boolean(
      state &&
        state.nw > 0 &&
        state.opacity > 0.99 &&
        Math.abs(state.scale - 1) < 0.01 &&
        Object.entries(expected).every(([k, v]) => state[k] === v),
    );
  }, () => `viewer to show ${JSON.stringify(expected)}; last state ${JSON.stringify(state)}`);
  return state;
}

export async function expectPoll(fn, message, timeout = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for ${typeof message === 'function' ? message() : message}`);
}
