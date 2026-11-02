# GitHub Image Lightbox

A Chrome extension that opens image links on github.com in a smooth, zoomable lightbox instead of downloading them or opening a new tab.

It works on links inside issue and pull request descriptions, comments, READMEs, release notes and gists:

- Text links to image files, such as `[IMG_0001.jpg](https://github.com/user-attachments/files/…/IMG_0001.jpg)`. These normally download.
- Inline images, which normally open in a new tab.
- `…/blob/…/photo.png` links, which load the raw file instead of GitHub's file page.
- Links to images on other sites.

Every image link on the page becomes part of one gallery, in page order.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension` folder.
4. Reload any GitHub tabs that were already open.

## Controls

| Action | Mouse / trackpad | Keyboard |
| --- | --- | --- |
| Next / previous | Arrow buttons, thumbnails, drag sideways, two-finger swipe | `→` `←` `Space` `Shift+Space` `Home` `End` |
| Zoom | Scroll wheel, pinch, double-click | `+` `-` `Z` (toggle 100%) `0` (fit) |
| Pan when zoomed | Drag, with momentum | `↑` `↓` |
| Close | Click outside the image, drag down | `Esc` |
| Open original / download | Top-right buttons | `O` / `D` |

Cmd-, Ctrl-, Shift- and middle-clicks still behave like normal links.

## Permissions

- **Access to all sites.** The extension loads images through its service worker when a direct load fails, such as an `http://` link on an `https://` page. Only GitHub requests carry your cookies. Images on other sites load only when you open them, never in the background.
- **Downloads.** Used by the download button.

## Development

```sh
npm install
npm test                 # mocked GitHub page with GitHub's CSP
LIVE=1 npm test          # also runs against a real github.com issue
npm run icons            # re-render the icons
```
