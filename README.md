# GitHub Image Lightbox

A Chrome extension that opens image and video links on github.com in a smooth lightbox instead of downloading them or opening a new tab.

It works on links inside issue and pull request descriptions, comments, READMEs, release notes and gists:

- Text links to image files, such as `[IMG_0001.jpg](https://github.com/user-attachments/files/…/IMG_0001.jpg)`. These normally download.
- Inline images, which normally open in a new tab.
- `…/blob/…/photo.png` links, which load the raw file instead of GitHub's file page.
- Links to images on other sites.
- Links to video files (`.mp4`, `.mov`, `.webm`, `.m4v`), including attachments from private repos.
- Inline videos. Hover one and click the expand button in its top-right corner.

Every image and video on the page becomes part of one gallery, in page order. Videos start playing when you reach them and pause when you move on.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension` folder.
4. Reload any GitHub tabs that were already open.

## Controls

| Action | Mouse / trackpad | Keyboard |
| --- | --- | --- |
| Next / previous | Arrow buttons, thumbnails, drag sideways, two-finger swipe | `→` `←` `Home` `End`, and `Space` on images |
| Zoom (images) | Scroll wheel, pinch, double-click | `+` `-` `Z` (toggle 100%) `0` (fit) |
| Play / pause, mute, fullscreen (videos) | Native video controls | `Space` `M` `F` |
| Pan when zoomed | Drag, with momentum | `↑` `↓` |
| Close | Click outside the image, drag down | `Esc` |
| Open original / download | Top-right buttons | `O` / `D` |

Cmd-, Ctrl-, Shift- and middle-clicks still behave like normal links.

## Permissions

- **Access to all sites.** The extension loads images through its service worker when a direct load fails, such as an `http://` link on an `https://` page. Only GitHub requests carry your cookies. Images on other sites load only when you open them, never in the background.
- **Downloads.** Used by the download button.

Videos play inside a small player page that ships with the extension. GitHub's page security rules block most video hosts, including its own attachment storage, but they don't apply to the extension's own pages.

## Development

```sh
npm install
npm test                 # mocked GitHub page with GitHub's CSP
LIVE=1 npm test          # also runs against a real github.com issue
npm run icons            # re-render the icons
```
