# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

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
  absolute Earth-centered **meters**, float64), `orientation` (Quaternion), and
  `yaw`/`pitch` (radians), all **mutated in place** each frame, plus free-fly
  `speed`. This `position` is the render origin. Initial pose is beside the
  Everest cone (from `everestSite`), facing the peak. Exposes a `teleport(position,
  lookAt?)` action — copies position and, if `lookAt` is given, derives `yaw`/`pitch`
  so the player faces it; `PlayerRig` rebuilds `orientation` from them next frame.
  This is what the debug API drives (see "Debug navigation" below).
- `src/player/PlayerRig.tsx` — the only per-frame input integrator. Consumes
  mouse-look + WASD/QE/Space/Ctrl movement, advances `yaw`/`pitch` and `position`
  in the store, pins the camera at the origin, copies orientation, writes the HUD
  readout.
- `src/player/freeFlyControls.ts` — `useFreeFlyControls` hook: wires pointer-lock
  mouse-look, movement keys, and scroll-wheel speed to the canvas. Owns raw input
  in a ref; `PlayerRig` reads it via `isDown`/`consumeLook` without touching it
  during render.
- `src/world/FloatingGroup.tsx` — the camera-relative transform; every marker
  wraps itself in one.
- `src/world/everestSite.ts` — **shared** geometry for the Everest site: the
  local frame at Everest's lat/lon (`up`/`tangent`/`binormal`, `surfaceQuat`,
  `groundQuat`) and the named layout points (`CONE_CENTER`, `CONE_PEAK`,
  `PLAYER_START`, `BOX_CLUSTER_ORIGIN`, …), all absolute meters. Both
  `playerStore` and `Markers`/`Mountain` import from here so the anchor math
  isn't duplicated — change site geometry here, not in those consumers.
- `src/world/Markers.tsx` — minimal true-scale test content (summit boxes, ground
  plane, Earth, Moon, Sun, a star, a galaxy marker).
- `src/world/Mountain.tsx` — the true-scale Everest cone, anchored on the ground
  at `CONE_CENTER` with its peak at `CONE_PEAK`.
- `src/world/constants.ts` — physical constants, render `NEAR_M`/`FAR_M`, and
  `latLonToUnitVector` (places things at real lat/lon).
- `src/scene/Scene.tsx` — the single `<Canvas>` (log depth), lights, and mounts
  `Markers`, `PlayerRig`, and the debug API (`useDebugApi`).
- `src/debug/debugApi.ts` — installs `window.__debug` (see "Debug navigation").
- `src/ui/hudStore.ts` / `src/ui/Hud.tsx` — per-frame HUD readout (distance from
  center), written by `PlayerRig`.

## Conventions / gotchas

- **Per-frame allocation is avoided** in hot loops — `PlayerRig` and `FloatingGroup` reuse module-level scratch objects and mutate vectors in place (e.g. `group.position.subVectors(...)`). Follow that pattern; don't allocate Three.js objects inside `useFrame`.
- **The floating-origin rule** (docs/floating-origin-spike.md) is load-bearing: the `absolute − origin` subtraction must stay per-object in float64 (`FloatingGroup`), never folded into a large parent-group translation. Keep `logarithmicDepthBuffer` on, and keep the camera pinned at the render origin.
- **React Compiler is on** (`babel-plugin-react-compiler` via `vite.config.ts`). Don't hand-add `useMemo`/`useCallback` for things it already handles; do keep components free of the manual-memo anti-patterns it forbids.
- TypeScript is strict-ish: `noUnusedLocals`/`noUnusedParameters` and `verbatimModuleSyntax` (use `import type` for type-only imports) are enforced — a build will fail on these.
- The Earth texture (`public/textures/earth_daymap.jpg`) is CC-BY 4.0 and **requires attribution** — see `ATTRIBUTION.md` before swapping or modifying it.

## Controls

Click the canvas to capture the pointer (pointer-lock mouse-look). **WASD** move
horizontally relative to view, **E/Space** up and **Q/Ctrl** down, **scroll wheel**
adjusts free-fly speed (multiplicative, clamped `MIN_SPEED_MPS`…`MAX_SPEED_MPS` — the
range spans walking pace to fast enough to reach the galaxy marker). All movement is
in absolute meters; `Esc` releases the pointer.

## Debug navigation (`window.__debug`) & Playwright

Driving the camera by scripting WASD/mouse-look is painful, so the app installs a
small navigation API on `window.__debug` (`src/debug/debugApi.ts`, mounted by
`useDebugApi()` in `Scene`). It lets external tools jump the camera to precomputed
landmark positions:

- `__debug.teleport(position, lookAt?)` — `position`/`lookAt` are
  `[x, y, z]` tuples in **absolute Earth-centered meters**; calls straight into the
  store's `teleport` action.
- `__debug.viewpoints` — precomputed tuples for key landmarks
  (`conePeak`, `coneBase`, `playerStart`, `boxCluster`, `earthCenter`, `moon`,
  `sun`), built from the same `everestSite`/`constants` values the scene uses, so
  callers never recompute geometry.
- `__debug.earthRadiusM` — handy for offsetting a viewpoint (e.g. `earthCenter` plus
  a surface radius).

When adding a new landmark worth jumping to, extend `VIEWPOINTS` in
`debugApi.ts` rather than hardcoding coordinates in test scripts.

**Playwright MCP** is the intended way to verify scale/camera changes without a
human at the keyboard. Run `pnpm dev` (Vite serves on `http://localhost:5173`),
then use the Playwright MCP browser tools to navigate there and call the API via
`browser_evaluate`, e.g.:

```js
() => {
  const { teleport, viewpoints } = window.__debug;
  teleport(viewpoints.coneBase, viewpoints.conePeak); // stand at the base, look up
}
```

Then `browser_take_screenshot` to inspect the result. This is how you check the
cone sits flush, the boxes stay crisp, bodies look right at each scale, etc. Note
the canvas is WebGL — DOM snapshots tell you nothing about the render; use
screenshots.

## Verifying changes

For any change touching scale, camera, or rendering, run the app and verify continuity: free-fly outward from the Everest summit boxes (1 cm apart — must stay crisp, no z-fight/jitter), past the true-scale cone (base flush on the ground, no floating geometry), all the way out past Earth, Moon, Sun, and the outer markers. There must be **no pop anywhere** (there are no tiers) and no surface swimming on the body you approach. See the checklist in `docs/floating-origin-spike.md`. No automated check covers this.

You don't have to fly there by hand — prefer the Playwright MCP + `window.__debug` workflow above to teleport between viewpoints and screenshot each scale. `pnpm build` and `pnpm lint` remain the only static checks.
