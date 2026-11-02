import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f81f7"/>
      <stop offset="1" stop-color="#8957e5"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <rect x="22" y="28" width="84" height="72" rx="11" fill="none" stroke="#fff" stroke-width="9"/>
  <path d="M27 95 L53 64 L69 81 L80 70 L101 95 Z" fill="#fff"/>
  <circle cx="82" cy="49" r="8.5" fill="#fff"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style>` +
      `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`,
  );
  await page.screenshot({ path: resolve(`extension/icons/icon-${size}.png`), omitBackground: true });
}
await browser.close();
