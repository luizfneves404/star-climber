# CLAUDE.md

## What this is

Star Climber is a 3D scale-of-the-universe visualization (React 19 + TypeScript + Vite + Three.js via React Three Fiber/Drei). You start standing on a true-scale Mount Everest and free-fly outward until the whole Earth — then the solar system — comes into view. The core challenge: rendering seamlessly across ~27 orders of magnitude when float32 only holds ~7.

## Commands

```bash
pnpm install      # pnpm is enforced
pnpm dev          # Vite dev server (http://localhost:5173)
pnpm build        # tsc -b && vite build (type-checks + bundles)
pnpm lint         # eslint .
```

No automated test suite. `pnpm build` and `pnpm lint` are the only static checks. Scale/rendering correctness is verified visually via Playwright + `window.__debug` (see below).

## The one rule that must not break: floating origin

The whole world is authored in **absolute Earth-centered meters (float64)**. The camera is pinned at render-space origin `(0,0,0)` — only its orientation changes. Every object is drawn camera-relative:

```
renderPosition = absolutePositionMeters − playerPositionMeters
```

This subtraction happens **in JS (float64), per object, every frame** (`src/world/FloatingGroup.tsx`). **It must not** be expressed as one large translation on a shared parent group — that bakes the huge offset into a float32 matrix and loses precision before the GPU sees it. The float64 subtract is the whole point. One continuous scene, no tiers, no cross-fade.

The single `<Canvas>` uses `logarithmicDepthBuffer: true`. This has been verified: one log-depth canvas in meters resolves both 1 cm-apart summit boxes and the Sun at 1 AU simultaneously with no z-fighting.

## File map

- `src/world/FloatingGroup.tsx` — camera-relative transform; every scene object wraps itself in one.
- `src/world/everestSite.ts` — **shared source of truth** for the Everest site: the local frame at Everest's lat/lon, and named layout points (`CONE_CENTER`, `CONE_PEAK`, `PLAYER_START`, `BOX_CLUSTER_ORIGIN`, …), all in absolute meters. `playerStore` and `Markers`/`Mountain` import from here — change site geometry here, not in consumers.
- `src/world/Markers.tsx` — true-scale test content (summit boxes, Earth, Moon, Sun, star, galaxy marker).
- `src/world/Mountain.tsx` — true-scale Everest cone, anchored at `CONE_CENTER` with peak at `CONE_PEAK`.
- `src/world/constants.ts` — physical constants, `NEAR_M`/`FAR_M`, `latLonToUnitVector`.
- `src/player/playerStore.ts` — Zustand. Player `position` (absolute Earth-centered meters, float64), `orientation` (Quaternion), `yaw`/`pitch`, and free-fly `speed`. Exposes `teleport(position, lookAt?)`.
- `src/player/PlayerRig.tsx` — sole per-frame input integrator. Advances `yaw`/`pitch`/`position`, pins the camera at origin, writes the HUD.
- `src/player/freeFlyControls.ts` — `useFreeFlyControls`: pointer-lock mouse-look, WASD/QE/Space/Ctrl, scroll-wheel speed. Input lives in a ref; `PlayerRig` reads via `isDown`/`consumeLook`.
- `src/scene/Scene.tsx` — the single `<Canvas>` (log depth), lights, mounts `Markers`, `PlayerRig`, `useDebugApi`.
- `src/debug/debugApi.ts` — installs `window.__debug`.
- `src/ui/hudStore.ts` / `src/ui/Hud.tsx` — per-frame distance-from-center readout, written by `PlayerRig`.

## Conventions / gotchas

- **No per-frame allocation** in hot paths. `PlayerRig` and `FloatingGroup` reuse module-level scratch objects and mutate in place (e.g. `group.position.subVectors(...)`). Don't allocate Three.js objects inside `useFrame`.
- **React Compiler is on** (`babel-plugin-react-compiler` via `vite.config.ts`). Don't add `useMemo`/`useCallback` manually for things it already handles.
- **TypeScript strictness**: `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` are enforced — use `import type` for type-only imports, or the build will fail.
- The Earth texture (`public/textures/earth_daymap.jpg`) is CC-BY 4.0 — see `ATTRIBUTION.md` before swapping it.

## Debug navigation (`window.__debug`)

Use this to verify scale/rendering changes without flying manually.

Run `pnpm dev`, then via Playwright MCP `browser_evaluate`:

```js
() => {
  const { teleport, viewpoints } = window.__debug;
  teleport(viewpoints.coneBase, viewpoints.conePeak); // stand at base, look up
}
```

Then `browser_take_screenshot` to inspect. The canvas is WebGL — DOM snapshots are useless, use screenshots.

Available on `window.__debug`:
- `teleport(position, lookAt?)` — `[x,y,z]` tuples in absolute Earth-centered meters.
- `viewpoints` — precomputed landmarks: `conePeak`, `coneBase`, `playerStart`, `boxCluster`, `earthCenter`, `moon`, `sun`.
- `earthRadiusM` — useful for offsetting a surface viewpoint.

When adding a new landmark, extend `VIEWPOINTS` in `debugApi.ts`.

## Current state & what's next

The floating-origin base is verified and clean (Milestone 5). The scene currently holds minimal placeholder content (untextured cone, colored marker spheres). Next work in rough order:

1. **Re-add rich content** — textured Earth sphere, solar bodies, as `FloatingGroup`s.
2. **Rapier physics + walkable character** — `@react-three/rapier`, mountain collider, kinematic-capsule controller plugging into `playerStore`'s meter-space `position`.
3. **Mode-switching** — "climb" (physics on, gravity) ↔ "flight" (free-fly), triggered at the summit.
4. **Replace placeholder cone** with a heightmap-based Everest mesh.
