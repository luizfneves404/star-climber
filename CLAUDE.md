# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Star Climber is a 3D scale-of-the-universe visualization (React 19 + TypeScript + Vite + Three.js via React Three Fiber/Drei). You start standing on a true-scale Mount Everest and free-fly outward until the whole Earth — then the solar system — comes into view. The core challenge it solves is rendering seamlessly across ~27 orders of magnitude when float32 only holds ~7.

## Commands

```bash
pnpm install      # pnpm is enforced (preinstall runs only-allow pnpm)
pnpm dev          # Vite dev server
pnpm build        # tsc -b && vite build  (type-checks, then builds)
pnpm lint         # eslint .
```

There is **no automated test suite**. The scale/seam behavior cannot be unit-tested — it is verified manually (see "Verifying changes" below). `pnpm build` and `pnpm lint` are the only static checks.

## Architecture — read these docs first

Two docs are load-bearing and must be read before touching the relevant code:

- **`docs/floating-origin-spike.md`** — the current scale mechanism (floating
  origin + log depth) and the open question it is de-risking. Read before
  changing anything in `src/world/`, `src/player/`, or `src/scene/`.
- **`docs/PROJECT_NOTES.md`** — project intent, milestone history, and planned next steps.

Note: `docs/tier-system.md` describes the **superseded** approach (canonical
normalization, discrete tiers, opacity cross-fade, two canvases). It was removed
in Milestone 5; the doc is kept only as a historical record.

### The big idea: floating origin (camera-relative rendering)

The whole world is authored and simulated in **absolute Earth-centered meters
(float64)**. Rendering is in **meters**, with the camera pinned at render-space
origin `(0,0,0)` — only its orientation changes. Every object is drawn
camera-relative:

```
renderPosition = absolutePositionMeters − playerPositionMeters
```

This subtraction happens **in JS (float64), per object, every frame**
(`src/world/FloatingGroup.tsx`), and the small result is assigned to the object's
local position. **Crucially, it must not** be expressed as one large translation
on a shared parent group — that bakes the huge offset into a float32 matrix and
destroys precision before the GPU subtracts. Doing the subtract at float64 first
is the point: near-camera objects come out at ~meters (precise), far ones huge
but sub-pixel (imprecision invisible). One continuous scene, no tiers, no
cross-fade, no normalization.

**Single canvas (under test).** There is currently **one** `<Canvas>` with
`logarithmicDepthBuffer: true`. The open hypothesis (see the spike doc) is that,
because we render in meters, one log-depth canvas resolves both 1 cm-apart summit
boxes and the Sun at 1 AU — making the old two-canvas split unnecessary. If the
close boxes z-fight in practice, the documented fallback is a second normal-depth
canvas for human-scale geometry only.

### State flow (everything is absolute meters internally)

- `src/player/playerStore.ts` — Zustand. The player's `position` (Vector3,
  absolute Earth-centered **meters**, float64) and `orientation` (Quaternion),
  both **mutated in place** each frame, plus free-fly `speed`. This `position` is
  the render origin. Initial pose is on Everest's summit at its real lat/lon.
- `src/player/PlayerRig.tsx` — the only input integrator. Mouse-look + WASD/QE
  movement (meters), pins the camera at the origin, copies orientation, writes
  the HUD readout.
- `src/world/FloatingGroup.tsx` — the camera-relative transform; every marker
  wraps itself in one.
- `src/world/Markers.tsx` — minimal true-scale test content (summit boxes, Earth,
  Moon, Sun, a star, a galaxy marker).
- `src/world/constants.ts` — physical constants, render `NEAR_M`/`FAR_M`, and
  `latLonToUnitVector` (places things at real lat/lon).
- `src/ui/hudStore.ts` — per-frame HUD readout (distance from center), written by
  `PlayerRig`.

## Conventions / gotchas

- **Per-frame allocation is avoided** in hot loops — `PlayerRig` and `FloatingGroup` reuse module-level scratch objects and mutate vectors in place (e.g. `group.position.subVectors(...)`). Follow that pattern; don't allocate Three.js objects inside `useFrame`.
- **The floating-origin rule** (docs/floating-origin-spike.md) is load-bearing: the `absolute − origin` subtraction must stay per-object in float64 (`FloatingGroup`), never folded into a large parent-group translation. Keep `logarithmicDepthBuffer` on, and keep the camera pinned at the render origin.
- **React Compiler is on** (`babel-plugin-react-compiler` via `vite.config.ts`). Don't hand-add `useMemo`/`useCallback` for things it already handles; do keep components free of the manual-memo anti-patterns it forbids.
- TypeScript is strict-ish: `noUnusedLocals`/`noUnusedParameters` and `verbatimModuleSyntax` (use `import type` for type-only imports) are enforced — a build will fail on these.
- The Earth texture (`public/textures/earth_daymap.jpg`) is CC-BY 4.0 and **requires attribution** — see `ATTRIBUTION.md` before swapping or modifying it.

## Verifying changes

For any change touching scale, camera, or rendering, run the app and manually verify continuity: free-fly outward from the Everest summit boxes (1 cm apart — must stay crisp, no z-fight/jitter) all the way out past Earth, Moon, Sun, and the outer markers. There must be **no pop anywhere** (there are no tiers) and no surface swimming on the body you approach. See the checklist in `docs/floating-origin-spike.md`. No automated check covers this.
