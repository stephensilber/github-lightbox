import { expect, test, chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { EXTENSION, expectPoll } from './helpers.js';

// Playwright's request interception hides SameSite cookies on service-worker requests, so this test
// serves a fake github.com over real HTTPS to check that private attachments get the session cookie.
test('video attachments that need your GitHub session play in the viewer', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gh-lightbox-tls-'));
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=github.com',
      '-addext', 'subjectAltName=DNS:github.com,DNS:objects.githubusercontent.com',
      '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'),
    ], { stdio: 'ignore' });
  } catch {
    test.skip(true, 'openssl is not available');
  }

  const clip = await readFile(resolve('tests/fixtures/landscape.webm'));
  const attachmentCookies = [];
  const server = https.createServer(
    { key: await readFile(join(dir, 'key.pem')), cert: await readFile(join(dir, 'cert.pem')) },
    (req, res) => {
      const host = req.headers.host.split(':')[0];
      if (host === 'github.com' && req.url === '/acme/private/pull/7') {
        res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'none'; media-src github.com; style-src 'unsafe-inline'" });
        res.end('<!doctype html><div class="markdown-body"><a href="/user-attachments/files/7/demo.mov">demo.mov</a></div>');
      } else if (host === 'github.com' && req.url === '/user-attachments/files/7/demo.mov') {
        attachmentCookies.push(req.headers.cookie || '');
        if (!/user_session=secret-session/.test(req.headers.cookie || '')) return res.writeHead(404).end('Not Found');
        res.writeHead(302, { location: 'https://objects.githubusercontent.com/github-production-repository-file/7?sig=1' }).end();
      } else if (host === 'objects.githubusercontent.com') {
        res.writeHead(200, { 'content-type': 'video/quicktime', 'content-disposition': 'attachment; filename="demo.mov"' }).end(clip);
      } else {
        res.writeHead(404).end();
      }
    },
  );
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const profile = await mkdtemp(join(tmpdir(), 'gh-lightbox-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      `--host-resolver-rules=MAP github.com:443 127.0.0.1:${port}, MAP objects.githubusercontent.com:443 127.0.0.1:${port}`,
      '--ignore-certificate-errors',
    ],
  });
  try {
    await context.addCookies([
      { name: 'user_session', value: 'secret-session', domain: 'github.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' },
    ]);
    const page = await context.newPage();
    await page.goto('https://github.com/acme/private/pull/7');
    await page.getByRole('link', { name: 'demo.mov' }).click();
    let state;
    await expectPoll(async () => {
      const frame = page.frames().find(f => f.url().includes('player.html'));
      state = await frame
        ?.evaluate(() => {
          const v = document.querySelector('video');
          return { playing: !v.paused && v.currentTime > 0.2, src: v.currentSrc };
        })
        .catch(() => null);
      return Boolean(state?.playing);
    }, () => `private attachment to play; last ${JSON.stringify(state)}; cookies ${JSON.stringify(attachmentCookies)}`);
    expect(state.src).toContain('objects.githubusercontent.com');
    expect(attachmentCookies).toEqual([expect.stringContaining('user_session=secret-session')]);
  } finally {
    await context.close();
    server.close();
    await rm(profile, { recursive: true, force: true });
    await rm(dir, { recursive: true, force: true });
  }
});
