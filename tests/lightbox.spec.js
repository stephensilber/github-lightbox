import { expect, test } from '@playwright/test';
import http from 'node:http';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expectPoll, launchWithExtension, makeImages, viewerState, waitForImage } from './helpers.js';

const SHOTS = process.env.SHOTS_DIR || resolve('test-results/shots');

const GITHUB_CSP = [
  "default-src 'none'",
  "img-src 'self' data: blob: github.githubassets.com media.githubusercontent.com camo.githubusercontent.com " +
    'avatars.githubusercontent.com github-cloud.s3.amazonaws.com objects.githubusercontent.com ' +
    'user-images.githubusercontent.com private-user-images.githubusercontent.com ' +
    'github-production-user-asset-6210df.s3.amazonaws.com objects-origin.githubusercontent.com *.githubusercontent.com',
  "style-src 'unsafe-inline' github.githubassets.com",
  'script-src github.githubassets.com',
].join('; ');

const externalHits = [];
let images;
let app;

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
  app = await launchWithExtension();
  images = await makeImages(app.context, {
    one: { w: 2400, h: 1600, label: 'IMG 0001', hue: 210, type: 'image/jpeg' },
    two: { w: 1600, h: 2400, label: 'IMG 0002', hue: 20, type: 'image/jpeg' },
    inline: { w: 1200, h: 800, label: 'Inline', hue: 140, type: 'image/png' },
    diagram: { w: 900, h: 600, label: 'Blob link', hue: 280, type: 'image/png' },
    external: { w: 1000, h: 700, label: 'External', hue: 330, type: 'image/jpeg' },
  });
  const ctx = app.context;
  const attachment = (body, type, name) => route =>
    route.fulfill({ body, headers: { 'content-type': type, 'content-disposition': `attachment; filename="${name}"` } });
  await ctx.route('https://github.com/user-attachments/files/111/IMG_0001.jpg', attachment(images.one, 'image/jpeg', 'IMG_0001.jpg'));
  await ctx.route('https://github.com/user-attachments/files/112/IMG_0002.JPG', attachment(images.two, 'image/jpeg', 'IMG_0002.JPG'));
  await ctx.route('https://github.com/user-attachments/files/9/outside.jpg', attachment(images.one, 'image/jpeg', 'outside.jpg'));
  await ctx.route('https://private-user-images.githubusercontent.com/**', route =>
    route.fulfill({ body: images.inline, contentType: 'image/png' }),
  );
  await ctx.route('https://github.com/acme/widgets/raw/main/docs/diagram.png', route =>
    route.fulfill({ body: images.diagram, contentType: 'image/png' }),
  );
  await ctx.route('https://camo.githubusercontent.com/**', route =>
    route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="20"><rect width="90" height="20" rx="3" fill="#2da44e"/></svg>',
      contentType: 'image/svg+xml',
    }),
  );
  await ctx.route('https://photos.example.net/external.jpg', route => {
    externalHits.push(route.request().frame?.() ? 'page' : 'worker');
    return route.fulfill({ body: images.external, contentType: 'image/jpeg' });
  });
  await ctx.route('https://ci.example/**', route => route.fulfill({ body: '<h1>CI</h1>', contentType: 'text/html' }));
  await ctx.route('https://github.com/acme/widgets/issues/1', route =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': GITHUB_CSP },
      body: `<!doctype html><html><head><title>Issue</title>
<style>
  body { font: 14px/1.5 -apple-system, sans-serif; margin: 0; background: #fff; color: #1f2328; }
  main { max-width: 860px; margin: 32px auto; padding: 0 24px; }
  .markdown-body { border: 1px solid #d1d9e0; border-radius: 6px; padding: 16px 24px; }
  a { color: #0969da; }
</style></head><body>
<nav><a href="https://github.com/user-attachments/files/9/outside.jpg">outside.jpg</a></nav>
<main>
  <h1>Photos from the site visit</h1>
  <div class="markdown-body">
    <p>Here are the photos: <a href="https://github.com/user-attachments/files/111/IMG_0001.jpg">IMG_0001.jpg</a>
       and <a href="https://github.com/user-attachments/files/112/IMG_0002.JPG">IMG_0002.JPG</a>.</p>
    <p><a target="_blank" rel="noopener noreferrer" href="https://private-user-images.githubusercontent.com/1/2-inline.png?jwt=abc"><img id="inline" alt="Image" width="300" src="https://private-user-images.githubusercontent.com/1/2-inline.png?jwt=abc" style="max-width:100%"></a></p>
    <p>See also the <a href="https://github.com/acme/widgets/blob/main/docs/diagram.png">architecture diagram</a>
       and an <a href="https://photos.example.net/external.jpg">external photo</a>.</p>
    <p>A <a href="https://example.com/docs">regular link</a> and a badge:
       <a href="https://ci.example/build"><img id="badge" alt="build" src="https://camo.githubusercontent.com/badge.svg"></a></p>
  </div>
  <div class="markdown-body" style="display:none"><a href="https://github.com/user-attachments/files/111/IMG_0001.jpg">hidden duplicate</a></div>
</main></body></html>`,
    }),
  );
});

test.afterAll(async () => {
  await app?.dispose();
});

test('image links open a zoomable, navigable lightbox instead of downloading', async () => {
  const page = await app.context.newPage();
  const errors = [];
  const downloads = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !/Content Security Policy/.test(m.text()) && errors.push(m.text()));
  page.on('download', d => downloads.push(d.suggestedFilename()));
  await page.goto('https://github.com/acme/widgets/issues/1');
  const box = page.locator('[data-github-image-lightbox]');

  await page.getByRole('link', { name: 'IMG_0001.jpg' }).click();
  await expect(box).toBeAttached();
  let state = await waitForImage(page, { count: '1 / 5', nw: 2400 });
  expect(state.styled).toBe(true);
  expect(state.title).toBe('IMG_0001.jpg');
  expect(page.url()).toBe('https://github.com/acme/widgets/issues/1');
  await page.screenshot({ path: join(SHOTS, '01-open-text-link.png') });

  await page.keyboard.press('ArrowRight');
  state = await waitForImage(page, { count: '2 / 5', nw: 1600, nh: 2400 });
  await page.screenshot({ path: join(SHOTS, '02-next-portrait.png') });

  await page.keyboard.press('ArrowRight');
  await waitForImage(page, { count: '3 / 5', nw: 1200 });

  await page.keyboard.press('ArrowRight');
  state = await waitForImage(page, { count: '4 / 5', nw: 900, title: 'architecture diagram' });
  expect(state.src).toBe('https://github.com/acme/widgets/raw/main/docs/diagram.png');

  await page.keyboard.press('ArrowRight');
  state = await waitForImage(page, { count: '5 / 5', nw: 1000 });
  console.log(`external image loaded via ${state.src.startsWith('blob:') ? 'service worker fallback (blob:)' : 'direct <img>'}; requests: ${externalHits.join(', ')}`);
  await page.screenshot({ path: join(SHOTS, '03-external-host.png') });

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect((await viewerState(page)).count).toBe('5 / 5');

  await page.keyboard.press('Home');
  state = await waitForImage(page, { count: '1 / 5' });
  const fitZoom = parseInt(state.zoom, 10);

  await page.mouse.move(900, 380);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
  await expectPoll(async () => (await viewerState(page)).scale > 2, 'wheel zoom');
  await page.waitForTimeout(500);
  state = await viewerState(page);
  expect(parseInt(state.zoom, 10)).toBeGreaterThan(fitZoom * 2);
  await page.screenshot({ path: join(SHOTS, '04-wheel-zoom.png') });

  const before = state;
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(600, 400, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  state = await viewerState(page);
  expect(state.count).toBe('1 / 5');
  expect(state.x).toBeLessThan(before.x - 50);

  await page.keyboard.press('0');
  await waitForImage(page, { count: '1 / 5' });
  await expectPoll(async () => Math.abs((await viewerState(page)).x) < 0.5, 'zoom reset to settle at the centre');

  await page.mouse.dblclick(720, 450);
  await expectPoll(async () => (await viewerState(page)).scale > 2, 'double-click zoom');
  await page.mouse.dblclick(720, 450);
  await waitForImage(page, { count: '1 / 5' });

  await page.mouse.move(1000, 450);
  await page.mouse.down();
  await page.mouse.move(500, 455, { steps: 6 });
  await page.mouse.up();
  await waitForImage(page, { count: '2 / 5' });

  await page.locator('[data-github-image-lightbox] .thumb').nth(3).click();
  await waitForImage(page, { count: '4 / 5' });
  await expectPoll(async () => (await viewerState(page)).thumbsLoaded >= 4, 'thumbnails to load');
  await page.screenshot({ path: join(SHOTS, '05-thumbnail-jump.png') });

  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);

  await page.locator('#inline').click();
  await expect(box).toBeAttached();
  let flight;
  await expectPoll(async () => (flight = await viewerState(page))?.nw > 0, 'inline image to start its open animation');
  expect(flight.scale).toBeLessThan(0.9);
  await waitForImage(page, { count: '3 / 5', nw: 1200 });
  await page.mouse.click(40, 160);
  await expect(box).toHaveCount(0);
  await expect(page.locator('#inline')).toBeVisible();

  await page.getByRole('link', { name: 'IMG_0002.JPG' }).click();
  await waitForImage(page, { count: '2 / 5' });
  await page.mouse.move(720, 400);
  await page.mouse.down();
  await page.mouse.move(725, 700, { steps: 10 });
  await page.mouse.up();
  await expect(box).toHaveCount(0);

  const popup = app.context.waitForEvent('page');
  await page.getByRole('link', { name: 'IMG_0001.jpg' }).click({ modifiers: ['Meta'] });
  await (await popup).close().catch(() => {});
  await page.waitForTimeout(200);
  await expect(box).toHaveCount(0);

  expect(downloads).toEqual([]);
  expect(errors).toEqual([]);

  await page.locator('#badge').click();
  await page.waitForURL('https://ci.example/build');
  await page.close();
});

test('falls back to the service worker when the page blocks a load, and shows an error for broken links', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/local.jpg') res.writeHead(200, { 'content-type': 'image/jpeg' }).end(images.external);
    else res.writeHead(404).end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const local = `http://127.0.0.1:${server.address().port}/local.jpg`;
  const page = await app.context.newPage();
  await page.route('https://github.com/user-attachments/files/113/missing.jpg', route =>
    route.fulfill({ status: 404, body: 'Not Found', contentType: 'text/plain' }),
  );
  await page.route('https://github.com/acme/widgets/issues/2', route =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': GITHUB_CSP },
      body: `<!doctype html><div class="markdown-body">
        <a href="https://github.com/user-attachments/files/113/missing.jpg">missing.jpg</a>
        <a href="${local}">local.jpg</a></div>`,
    }),
  );
  try {
    await page.goto('https://github.com/acme/widgets/issues/2');
    await page.getByRole('link', { name: 'local.jpg' }).click();
    const state = await waitForImage(page, { count: '2 / 2', nw: 1000 });
    expect(state.src.startsWith('blob:')).toBe(true);
    await page.keyboard.press('ArrowLeft');
    const error = page.locator('[data-github-image-lightbox] .error');
    await expect(error).toBeVisible();
    await expect(error.getByRole('link', { name: 'Open link' })).toHaveAttribute(
      'href',
      'https://github.com/user-attachments/files/113/missing.jpg',
    );
    await page.screenshot({ path: join(SHOTS, '06-broken-link.png') });
  } finally {
    await page.close();
    server.close();
  }
});

test('trackpad swipes, pinch zoom and window resizes', async () => {
  const page = await app.context.newPage();
  try {
    await page.goto('https://github.com/acme/widgets/issues/1');
    await page.getByRole('link', { name: 'IMG_0001.jpg' }).click();
    await waitForImage(page, { count: '1 / 5' });

    await page.mouse.move(720, 450);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(30, 0);
    await waitForImage(page, { count: '2 / 5' });

    await page.waitForTimeout(250);
    await page.keyboard.down('Control');
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -8);
    await page.keyboard.up('Control');
    await expectPoll(async () => (await viewerState(page)).scale > 1.5, 'pinch zoom');

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(100);
    const state = await viewerState(page);
    expect(state.count).toBe('2 / 5');
    const rect = await page.evaluate(() => {
      const root = document.querySelector('[data-github-image-lightbox]').shadowRoot;
      const img = [...root.querySelectorAll('.slide')].find(s => /translate3d\(0px/.test(s.style.transform)).querySelector('img');
      img.style.transform = 'none';
      const r = img.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(700);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(900);
  } finally {
    await page.close();
  }
});
