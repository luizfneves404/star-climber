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

The single `<Canvas>` uses `logarithmicDepthBuffer: true`. This has been verified: one log-depth canvas in meters resolves both 1 cm-apart summit boxes and the Sun at 1 AU simultaneously with no z-fighting. There seems to be a bit jagged edges on the boxes, but i find it acceptable.

## File map

- `src/world/FloatingGroup.tsx` — camera-relative transform; every scene object wraps itself in one.
- `src/world/everestSite.ts` — **shared source of truth** for the Everest site: the local frame at Everest's lat/lon, and named layout points (`TERRAIN_CENTER`, `SUMMIT`, `PLAYER_START`, `BOX_CLUSTER_ORIGIN`, …), all in absolute meters. `playerStore` and `Markers`/`Mountain` import from here — change site geometry here, not in consumers.
- `src/world/Markers.tsx` — true-scale test content (summit boxes, Earth, Moon, Sun, star, galaxy marker).
- `src/world/galaxy.ts` — `makeGalaxy(params)`: the shared procedural galaxy generator (seeded PRNG, three density functions — spiral/elliptical/irregular, color-by-population). Returns a `BufferGeometry` with `position`/`color`/`aSize` (where `aSize` is per-point **luminosity**, not size). The Milky Way and every hero galaxy are instances of this.
- `src/world/StarPoints.ts` — `makeStarPointsMaterial()`: the shared additive point-cloud `ShaderMaterial`. Stars are point sources: drawn at a **constant pixel size** (`aSize` only adds a slight bloom to the brightest) with **brightness ∝ luminosity / distance²** (`aSize / s²`, distance normalized by the cloud's `refDistM` to dodge float32 overflow), a tight core + faint halo sprite, and `uOpacity` for fades. So stars stay crisp pinpoints and read as *brighter*, not *bigger*. **Includes the `<common>` + logdepthbuf shader chunks — mandatory, or points z-fight the log-depth scene.**
- `src/world/MilkyWay.tsx` — the Milky Way, first `makeGalaxy` instance; the Sun is embedded in the disk (band from inside, spiral from outside), with a gentle distance-from-Sun opacity ramp.
- `src/world/heroGalaxies.ts` / `src/world/HeroGalaxies.tsx` — `HERO_GALAXIES` data array (~8 real named galaxies at real RA/Dec/distance) and the component mapping each to a `makeGalaxy` cloud. v1: always-on, no distance swap.
- `src/debug/frameProbe.ts` — allocation-free rolling frame-time average; `PlayerRig` records each frame, exposed as `window.__debug.frameStats()`.
- `src/world/everestTerrain.ts` — builds the Everest diorama `BufferGeometry` (513×513 grid, elevation vertex colors, edge feathering) from `public/terrain/everest_heightmap.bin`, generated offline by `scripts/build-everest-heightmap.mjs` (rerun via `pnpm build:heightmap`).
- `src/world/Mountain.tsx` — true-scale Everest terrain from the Copernicus GLO-30 heightmap, diorama-style borders feathered into the flat ground plane, anchored at `groundAnchor`.
- `src/world/Ground.tsx` — textured sea-level ground plane (60 km flat plane, tiling CC0 rock texture).
- `src/world/constants.ts` — physical constants, `NEAR_M`/`FAR_M` (far plane is `1e27` for space content — log depth keeps the near field crisp), `SUN_POS`, `latLonToUnitVector`, `raDecToUnitVector` (world axes ≈ ICRS equatorial; starfield not registered to Everest's horizon).
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
- The Earth texture (`public/textures/earth_daymap.jpg`) is CC-BY 4.0 — see `ATTRIBUTION.md` before swapping it. The CC0 ground texture (`public/textures/rocky_trail_diff_2k.jpg`) and the Copernicus GLO-30 heightmap data are also covered there.

## Debug navigation (`window.__debug`)

Use this to verify scale/rendering changes without flying manually.

Run `pnpm dev`, then via Playwright MCP `browser_evaluate`:

```js
() => {
  const { teleport, viewpoints } = window.__debug;
  teleport(viewpoints.terrainCenter, viewpoints.summit); // stand at the terrain patch center, look up at the summit
}
```

Then `browser_take_screenshot` to inspect. The canvas is WebGL — DOM snapshots are useless, use screenshots.

Available on `window.__debug`:
- `teleport(position, lookAt?)` — `[x,y,z]` tuples in absolute Earth-centered meters.
- `viewpoints` — precomputed landmarks: `summit`, `terrainCenter`, `playerStart`, `boxCluster`, `earthCenter`, `moon`, `sun`, plus one per hero galaxy by name (`andromeda`, `triangulum`, `lmc`, `smc`, `whirlpool`, `sombrero`, `m81`, `pinwheel`) — each is the galaxy center.
- `earthRadiusM` — useful for offsetting a surface viewpoint.
- `frameStats()` — rolling N-frame `{ avgFrameMs, fps, samples }`; read before/after adding a render layer to measure its FPS cost.

When adding a new landmark, extend `VIEWPOINTS` in `debugApi.ts`. Hero-galaxy viewpoints are generated from `HERO_GALAXIES`.

## Current state & what's next

see README.
