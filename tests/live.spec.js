import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchWithExtension, waitForImage } from './helpers.js';

const SHOTS = process.env.SHOTS_DIR || resolve('test-results/shots');
const ISSUE = process.env.LIVE_ISSUE || 'https://github.com/KiwiHC16/Abeille/issues/2801';

test.skip(!process.env.LIVE, 'set LIVE=1 to run against github.com');

test('works on a real github.com issue under GitHub’s CSP', async () => {
  await mkdir(SHOTS, { recursive: true });
  const app = await launchWithExtension();
  try {
    const page = await app.context.newPage();
    const downloads = [];
    page.on('download', d => downloads.push(d.suggestedFilename()));
    await page.goto(ISSUE, { waitUntil: 'domcontentloaded' });
    const box = page.locator('[data-github-image-lightbox]');

    const inline = page.locator('.markdown-body a[href] > img').first();
    await inline.scrollIntoViewIfNeeded();
    await inline.click();
    const first = await waitForImage(page);
    console.log('inline image', first.count || '1 / 1', `${first.nw}×${first.nh}`, new URL(first.src).host);
    await page.screenshot({ path: join(SHOTS, 'live-01-inline.png') });
    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);

    await page.evaluate(() => {
      const div = document.createElement('div');
      div.className = 'markdown-body';
      div.style.cssText = 'position:fixed;top:80px;left:20px;z-index:99;background:#fff;padding:12px;border:1px solid #888';
      for (const [text, href] of [
        ['vscode-code.png', 'https://github.com/microsoft/vscode/blob/main/resources/linux/code.png'],
        ['wikimedia.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/1280px-Fronalpstock_big.jpg'],
      ]) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        a.style.marginRight = '16px';
        div.append(a);
      }
      document.body.append(div);
    });

    await page.getByRole('link', { name: 'vscode-code.png' }).click();
    const blob = await waitForImage(page, { title: 'vscode-code.png' });
    console.log('blob link', `${blob.nw}×${blob.nh}`, blob.src.startsWith('blob:') ? 'via service worker' : 'direct', blob.src.slice(0, 80));

    await page.keyboard.press('ArrowRight');
    const external = await waitForImage(page, { title: 'wikimedia.jpg' });
    console.log('external link', `${external.nw}×${external.nh}`, external.src.startsWith('blob:') ? 'via service worker' : 'direct');
    await page.screenshot({ path: join(SHOTS, 'live-02-external.png') });
    expect(downloads).toEqual([]);
  } finally {
    await app.dispose();
  }
});
