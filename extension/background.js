const MAX_BYTES = 80 * 1024 * 1024;
const MAYBE_IMAGE = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'text/plain', 'text/xml', 'application/xml']);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'fetch-image') {
    fetchImage(message.url).then(sendResponse);
    return true;
  }
  if (message?.type === 'download') {
    chrome.downloads.download({ url: message.url }).then(
      () => sendResponse({ ok: true }),
      error => sendResponse({ ok: false, error: String(error?.message || error) }),
    );
    return true;
  }
  return false;
});

async function fetchImage(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { ok: false, error: 'Unsupported URL' };
    // Cookies only go to GitHub, which needs them for private attachments. Other hosts get an anonymous request.
    const res = await fetch(parsed, { credentials: isGitHub(parsed.hostname) ? 'include' : 'omit' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const header = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const length = Number(res.headers.get('content-length') || 0);
    if ((!header.startsWith('image/') && !MAYBE_IMAGE.has(header)) || length > MAX_BYTES) {
      res.body?.cancel();
      return { ok: false, error: length > MAX_BYTES ? 'Image is too large' : `Not an image (${header})` };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = header.startsWith('image/') ? header : sniff(bytes, parsed);
    if (!type) return { ok: false, error: 'Not an image' };
    return { ok: true, type, data: toBase64(bytes) };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function isGitHub(host) {
  return host === 'github.com' || host.endsWith('.github.com') || host.endsWith('.githubusercontent.com');
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function sniff(b, url) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (ascii(b, 0, 3) === 'GIF') return 'image/gif';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(b, 4, 8) === 'ftyp' && /^avi[fs]/.test(ascii(b, 8, 12))) return 'image/avif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if (/\.svg$/i.test(url.pathname) && /<svg[\s>]/i.test(ascii(b, 0, Math.min(b.length, 4096)))) return 'image/svg+xml';
  return '';
}

function toBase64(bytes) {
  if (typeof bytes.toBase64 === 'function') return bytes.toBase64();
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
