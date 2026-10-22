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
  and the saved photo matches the mirrored preview.

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

Production builds use the base path `/photobooth`; CI passes the real Pages path from
`actions/configure-pages` via `PAGES_BASE_PATH` (see `.github/workflows/deploy.yml`).
