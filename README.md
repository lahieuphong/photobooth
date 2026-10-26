# Photobooth

Story-first photobooth that runs fully in the browser and is deployed as a static site to
GitHub Pages: <https://lahieuphong.github.io/photobooth/>.

## User flow

```
Welcome → Experience → Ready → Capture → Review → Studio → Result
                                  ↑          │
                                  └ retake ──┘
```

| Route | Purpose |
|---|---|
| `/welcome` | Cover screen |
| `/experience` | Pick one of the presets in `config/experiences.ts` (shot count, layout, default look and frame, pose prompts) |
| `/ready` | Camera permission, live preview, countdown (0 / 5 / 10 / 15 s) |
| `/capture` | Takes the 4 or 6 shots, or a single retake |
| `/review` | Contact sheet; retake any single shot and keep/replace it |
| `/studio` | Look, frame and compatible layout; never modifies the original photos |
| `/result` | Final print, PNG download (`photobooth-YYYYMMDD-HHmmss.png`), edit again or new session |

There is no payment or package step. Every route is guarded (`domain/routeGuard.ts`): a deep
link or reload without a fitting session redirects to the nearest valid screen.

## Architecture

```
app/(photobooth)/<route>/page.tsx      thin route files
src/features/photobooth/
  components/screens/<route>/           one screen component per route
  components/shared/                    camera viewport, print composition, controls, layout
  config/                               routes, screen steps, experience presets
  domain/                               pure rules: session, route guard, layouts, frames, looks
  hooks/                                useCamera, usePhotoboothSession, usePhotoUrls
  services/camera|export|storage/       MediaStream, canvas export, persistence
tests/                                  node:test unit tests for the domain rules
```

- **One geometry source.** `domain/layouts.ts` defines every slot in a 1200×1566 print.
  The on-screen print, the generated frame SVG and the PNG export all derive from it.
  Export decodes, draws and closes one source photo at a time, including layouts that
  repeat a shot, so a six-shot print does not keep six decoded bitmaps alive together.
- **Photos are stored raw.** Shots are unfiltered JPEG blobs in IndexedDB (`photoStore.ts`);
  session metadata is small JSON in `sessionStorage`. Looks are applied at render time
  (CSS) and at export (`ctx.filter`, with a pixel fallback for browsers without it).
  Object URLs are retired after the replacement snapshot commits and on unmount.
  Derived caches are bounded: 128 decoded-photo ids and 64 frame overlays; evicting
  either only recomputes a value and never deletes stored photos.
- **Camera.** Ready and Capture share one `MediaStream` (`cameraStream.ts`), so moving
  between them never opens the camera twice. The front camera is preferred and mirrored,
  and the saved photo matches the mirrored preview. Startup has a 12 s watchdog: a request
  that never settles is reported (never duplicated, since `getUserMedia` cannot be
  cancelled) and a late stream is still used.
- **Sessions and storage.** Each tab owns its session through a Web Lock and refreshes a
  heartbeat in IndexedDB every minute, independent of user activity. Garbage collection
  only removes ended sessions, or sessions no tab holds whose heartbeat is older than 24 h
  (kiosk: idle timeout + 5 min). Photos that had to fall back to memory are tracked one by
  one, so warnings reflect the current session only.
- **Kiosk mode** (shared devices): open any page once with `?kiosk=1` (15 min) or
  `?kiosk=<minutes>`; `?kiosk=off` turns it off. Idle sessions are warned, then ended and
  their photos deleted; capture and export are never interrupted.
- **Motion and input.** `useSweetMotion` observes the actual `BrandPage` scroller,
  batches geometry reads before animation writes, and pauses ambient motion when
  hidden or outside the viewport. Content stays visible without JavaScript or
  IntersectionObserver; reduced motion disables nonessential effects. Experience
  and Studio share radio keyboard behavior (arrows, Home/End and one tab stop).
- **Loading.** Below-the-fold marketing compositions use native lazy loading.
  Static `picture` sources let the browser choose 160/320 px demo variants or the
  unchanged master, even with `images.unoptimized`. `MarketingPhoto` uses native
  image decoding without client image state; session previews retain `SoftImage`.
  Hero photos stay eager; the
  two marketing headlines paint without opacity/entrance delays. Fonts are
  registered once in the root layout: only Be Vietnam Pro 400 and the single
  Baloo 2 Latin/Vietnamese variable subset preload. Secondary interface weights
  and decorative fonts load on demand; Newsreader uses the actual UI weight, 400.
  The hero's fixed “Photobooth” label has its own 1.2 KB Newsreader subset with
  identical glyphs; camera messages keep the complete Vietnamese face. The
  screen-reader-only mobile hint does not download the handwriting face.
  A denied session-storage read is reported separately
  from an empty session, so starting over never overwrites unreadable metadata.

## Development

The lockfile is Yarn 1. If your global `yarn` is Yarn 2+, run scripts through Corepack so
the lockfile is not rewritten:

```bash
corepack yarn@1.22.22 install --frozen-lockfile
corepack yarn@1.22.22 dev        # http://localhost:3000/welcome
corepack yarn@1.22.22 lint
corepack yarn@1.22.22 typecheck
corepack yarn@1.22.22 test       # needs Node ≥ 22.18 (runs .ts tests natively)
corepack yarn@1.22.22 build      # static export to ./out
```

### End-to-end tests

Playwright smoke tests (`tests/e2e`) run against the production export served under the
real base path, in Chromium with its built-in fake camera — a synthetic test pattern, so
they are mocked-camera tests, not a substitute for real devices.

```bash
corepack yarn@1.22.22 playwright install --no-shell chromium   # once per machine (full Chromium)
corepack yarn@1.22.22 build                         # the tests serve ./out under /photobooth
corepack yarn@1.22.22 test:e2e
```

`E2E_BASE_PATH` and `E2E_PORT` override the defaults (`/photobooth`, `4173`). The server
refuses to start if `./out` was built for a different base path. On failure, traces and
screenshots are kept in `test-results/` (`yarn playwright show-trace <trace.zip>`).

Production builds use the base path `/photobooth`; CI passes the real Pages path from
`actions/configure-pages` via `PAGES_BASE_PATH` (see `.github/workflows/deploy.yml`).

CI order: install → typecheck → lint → unit tests → build → static export check → E2E →
deploy. Pull requests run every gate but never deploy; a failing gate blocks the deploy.

## Demo photos

Welcome and Experience use 22 local WebP sample photos (4 Quick 4, 4 Editorial,
4 Duo, 6 Story 6 and 4 Play). Quick 4 uses the gentle smile / peace sign / cheek
wink / happy smile collection; Play uses the V-sign wink / laugh / pout /
finger-heart collection. Demo URLs are kept in `config/demoPhotos.ts` and never
enter camera capture, session storage or PNG export.

Only optimized photos in `public/images/demo/` are published. Original collections
stay in the ignored `design-inputs/` directory. `scripts/demo-collections.json`
records their original filenames, SHA-256 checksums, photo corners, perspective
correction and small edge trims that remove printed stickers.

To reproduce the assets, supply the five original collections in a local folder:

```bash
corepack yarn@1.22.22 demo:assets --import-from ./original-collections
```

The processor preserves original files and refuses to replace differing existing
outputs. To review a specific correction separately:

```bash
corepack yarn@1.22.22 demo:assets --only editorial/01,duo/01,duo/04 --output-dir ./test-results/demo-review
```

No original photos, QA screenshots or contact sheets are needed for a normal build.

After regenerating the 22 published masters, run `corepack yarn@1.22.22 demo:variants`.
This derives uncropped 160/320 px demo WebPs at quality 88 and lossless logo variants,
and records real photo master
widths in `config/demoImageVariants.ts`. Masters are never overwritten; high-density
or large displays can still select them. These sources are marketing-only and never
enter a camera session or PNG export.

The checked-in Baloo 2 v1.700 WOFF2 retains 333 Latin, Vietnamese, combining-mark and
UI-symbol codepoints in one request, with the same 400–800
variable weight axis. Its OFL license is beside the font in
`components/shared/brand/assets/`. To reproduce it, install `fonttools[woff]==4.57.0`
in a separate Python environment and run
`python scripts/subset-bubble-font.py <Baloo2-master.ttf>`.
The script verifies the upstream SHA-256 before subsetting and
preserves timestamps for deterministic output. The master is available from
[google/fonts at 8e0cd05](https://github.com/google/fonts/blob/8e0cd05881f3ae5e933ba4161103005a3e841ce0/ofl/baloo2/Baloo2%5Bwght%5D.ttf).
Font generation is optional build tooling, not a runtime or normal-build dependency.

`scripts/subset-print-label-font.py <Newsreader-400-italic.woff2>` reproduces the
fixed label subset with the same tooling. Its pinned upstream URL and SHA-256 are
in the script; the OFL license is beside the subset. If the label text changes,
update the subset and verify its glyphs before publishing.
