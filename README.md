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
- **Photos are stored raw.** Shots are unfiltered JPEG blobs in IndexedDB (`photoStore.ts`);
  session metadata is small JSON in `sessionStorage`. Looks are applied at render time
  (CSS) and at export (`ctx.filter`, with a pixel fallback for browsers without it).
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
