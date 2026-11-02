import { expect, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expectPoll, launchWithExtension, makeImages, viewerState } from './helpers.js';

const SHOTS = process.env.SHOTS_DIR || resolve('test-results/shots');
const MEDIA_CSP =
  'media-src github.com user-images.githubusercontent.com secured-user-images.githubusercontent.com ' +
  'private-user-images.githubusercontent.com github-production-user-asset-6210df.s3.amazonaws.com gist.github.com github.githubassets.com';
const CSP = [
  "default-src 'none'",
  "img-src 'self' data: blob: *.githubusercontent.com",
  MEDIA_CSP,
  "style-src 'unsafe-inline'",
  'frame-src viewscreen.githubusercontent.com notebooks.githubusercontent.com',
].join('; ');
const INLINE_VIDEO = 'https://private-user-images.githubusercontent.com/1/9-0f0e0d0c-1b1a-4c3d-9e8f-123456789abc.mp4?jwt=abc';

let app;
const attachmentRequests = [];

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
  app = await launchWithExtension();
  const landscape = await readFile(resolve('tests/fixtures/landscape.webm'));
  const portrait = await readFile(resolve('tests/fixtures/portrait.webm'));
  const { photo } = await makeImages(app.context, { photo: { w: 1600, h: 1000, label: 'Photo', hue: 190, type: 'image/jpeg' } });
  const ctx = app.context;
  await ctx.route('https://github.com/user-attachments/files/114/screen-recording.mov', async route => {
    attachmentRequests.push(route.request().serviceWorker() ? 'worker' : 'page');
    return route.fulfill({ status: 302, headers: { location: 'https://objects.githubusercontent.com/github-production-repository-file-5c1aeb/1/114?X-Amz-Signature=abc' } });
  });
  await ctx.route('https://objects.githubusercontent.com/**', route =>
    route.fulfill({ body: landscape, headers: { 'content-type': 'video/quicktime', 'content-disposition': 'attachment; filename="screen-recording.mov"' } }),
  );
  await ctx.route('https://private-user-images.githubusercontent.com/**', route =>
    route.fulfill({ body: portrait, contentType: 'video/mp4' }),
  );
  await ctx.route('https://github.com/user-attachments/files/115/photo.jpg', route =>
    route.fulfill({ body: photo, headers: { 'content-type': 'image/jpeg', 'content-disposition': 'attachment' } }),
  );
  await ctx.route('https://github.com/acme/widgets/pull/3', route =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': CSP },
      body: `<!doctype html><html><head><style>
  body { font: 14px/1.5 -apple-system, sans-serif; margin: 0; }
  main { max-width: 860px; margin: 32px auto; padding: 0 24px; }
  .markdown-body { border: 1px solid #d1d9e0; border-radius: 6px; padding: 16px 24px; }
  video { display: block; max-height: 320px; }
</style></head><body><main>
  <h1>Add onboarding flow</h1>
  <div class="markdown-body">
    <p>Recording: <a href="https://github.com/user-attachments/files/114/screen-recording.mov">screen-recording.mov</a></p>
    <p>Screenshot: <a href="https://github.com/user-attachments/files/115/photo.jpg">photo.jpg</a></p>
    <details open><summary>portrait.mp4</summary>
      <video id="inline-video" src="${INLINE_VIDEO}" controls muted></video>
    </details>
  </div>
</main></body></html>`,
    }),
  );
});

test.afterAll(async () => {
  await app?.dispose();
});

function player(page, fragment) {
  return page.frames().find(f => f.url().includes('player.html') && decodeURIComponent(f.url()).includes(fragment));
}

async function playback(page, fragment) {
  const frame = player(page, fragment);
  if (!frame) return null;
  return frame
    .evaluate(() => {
      const v = document.querySelector('video');
      return { width: v.videoWidth, height: v.videoHeight, paused: v.paused, muted: v.muted, time: v.currentTime };
    })
    .catch(() => null);
}

async function waitForPlayback(page, fragment, check, label) {
  let last;
  await expectPoll(async () => {
    last = await playback(page, fragment);
    return Boolean(last && check(last));
  }, () => `${label}; last ${JSON.stringify(last)}`);
  return last;
}

async function waitForVideoSlide(page, count) {
  await expectPoll(async () => {
    const s = await viewerState(page);
    return s?.count === count && s.tag === 'iframe' && s.opacity > 0.99 && Math.abs(s.scale - 1) < 0.01;
  }, `video slide ${count}`);
}

test('video links and inline videos play in the viewer', async () => {
  const page = await app.context.newPage();
  const downloads = [];
  const errors = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('https://github.com/acme/widgets/pull/3');
  const box = page.locator('[data-github-image-lightbox]');

  await page.getByRole('link', { name: 'screen-recording.mov' }).click();
  await waitForVideoSlide(page, '1 / 3');
  const first = await waitForPlayback(page, 'objects.githubusercontent.com', p => !p.paused && p.time > 0.2, 'linked video playing');
  expect([first.width, first.height]).toEqual([640, 360]);
  expect(first.muted).toBe(false);
  expect(attachmentRequests).toEqual(['worker']);
  expect((await viewerState(page)).zoom).toBe('');
  await page.screenshot({ path: join(SHOTS, 'video-01-linked.png') });

  await page.keyboard.press('ArrowRight');
  await expectPoll(async () => (await viewerState(page))?.count === '2 / 3', 'photo slide');
  await waitForPlayback(page, 'objects.githubusercontent.com', p => p.paused, 'linked video paused after leaving it');

  await page.keyboard.press('ArrowRight');
  await waitForVideoSlide(page, '3 / 3');
  const inline = await waitForPlayback(page, 'private-user-images', p => !p.paused && p.time > 0.2, 'inline video playing');
  expect([inline.width, inline.height]).toEqual([360, 640]);
  expect(inline.muted).toBe(false);
  expect(await page.locator('#inline-video').evaluate(v => v.paused)).toBe(true);

  await page.keyboard.press(' ');
  await waitForPlayback(page, 'private-user-images', p => p.paused, 'space pauses');
  await page.keyboard.press(' ');
  await waitForPlayback(page, 'private-user-images', p => !p.paused, 'space resumes');

  await player(page, 'private-user-images').locator('video').focus();
  await page.keyboard.press('ArrowLeft');
  await expectPoll(async () => (await viewerState(page))?.count === '2 / 3', 'arrow key forwarded from the player');

  await page.keyboard.press('ArrowRight');
  await waitForVideoSlide(page, '3 / 3');
  await page.mouse.move(720, 420);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(-30, 0);
  await expectPoll(async () => (await viewerState(page))?.count === '2 / 3', 'trackpad swipe over the player');

  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);

  await page.locator('#inline-video').hover();
  const expand = page.locator('[data-github-image-lightbox-expand]').getByRole('button', { name: 'Open in viewer' });
  await expect(expand).toBeVisible();
  await page.screenshot({ path: join(SHOTS, 'video-02-expand-button.png') });
  await expand.click();
  await waitForVideoSlide(page, '3 / 3');
  const expanded = await waitForPlayback(page, 'private-user-images', p => !p.paused && p.time > 0.2, 'expanded inline video playing');
  expect(expanded.muted).toBe(false);
  await page.screenshot({ path: join(SHOTS, 'video-03-inline-expanded.png') });
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
  await expect(page.locator('#inline-video')).toBeVisible();

  expect(downloads).toEqual([]);
  expect(errors).toEqual([]);
  await page.close();
});
