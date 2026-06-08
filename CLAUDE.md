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

- **`docs/tier-system.md`** — the seamless-zoom mechanism and its **invariants**. Read before changing anything in `src/scale/` or `src/scene/`. Breaking an invariant reintroduces the visible "pop" at the tier handoff.
- **`docs/PROJECT_NOTES.md`** — project intent, milestone history, and planned next steps.

Note: both docs predate the current player code and still reference `ScaleTracker.tsx` and Drei `OrbitControls`. Those were replaced by the free-fly player rig — `src/player/PlayerRig.tsx` now writes the scale store and `src/player/freeFlyControls.ts` owns input. The *concepts* in the docs (canonical space, seam, two-layer rendering, invariants) remain accurate; the named files do not.

### The two big ideas

**1. Canonical tier space (`Earth radius = 1`).** Each scene "tier" is authored in convenient units and declares `metersPerUnit`. `Tier.tsx` scales it by `canonScale = metersPerUnit / EARTH_RADIUS_M`, mapping *every* tier's Earth onto a unit sphere. Consequence: the camera's canonical distance `dc = camera.position.length()` maps to the same real distance-from-Earth-center in every tier, so **one camera drives all tiers** and adjacent tiers draw an identical Earth at the seam — making the cross-fade invisible.
- Earth tier: `metersPerUnit = 1`. Solar tier: `metersPerUnit = 1e6` (1 unit = 1000 km).
- The seam is at `SEAM_M = 2.5e7` m (~25,000 km); `Tier.tsx` cross-fades opacity over `dc ∈ [FADE_LO_DC, FADE_HI_DC]` driven by `store.transition`.

**2. Two stacked `<Canvas>` layers** (`Scene.tsx`), because `logarithmicDepthBuffer` is a *global* renderer flag and no single depth buffer is precise across both human and astronomical scale:
- **FAR layer** — `logarithmicDepthBuffer: true`, opaque. Holds the tiers (Earth, mountain, solar system). `PlayerRig` lives here and is the **single source of truth**: it integrates input, drives the camera, and writes `dc`/tier/HUD readouts to the scale store.
- **NEAR layer** — normal depth, transparent, `pointerEvents: "none"` (so the far canvas owns input). Holds only human-scale local geometry (`Ground`) — surfaces centimeters apart that logdepth cannot resolve in canonical units. `NearRig` merely **mirrors** the player pose; it never integrates input.

### State flow (everything is meters internally)

- `src/player/playerStore.ts` — Zustand. The player's `position` (Vector3, Earth-centered **meters**, float64) and `orientation` (Quaternion), both **mutated in place** each frame, plus free-fly `speed`. Initial pose is on Everest's summit at its real lat/lon.
- `src/player/PlayerRig.tsx` — the only input integrator. Mouse-look + WASD/QE movement (meters), then `syncCameraToPlayer` converts meters → canonical render space, then it writes the scale store.
- `src/player/cameraBridge.ts` — the single meters→canonical conversion (`× 1/EARTH_RADIUS_M`), shared by both layers so the cameras stay pose-locked.
- `src/scale/store.ts` — Zustand `ScaleManager`: derives `tier`, `transition`, distance, and `metersPerPixel` from `dc`. Read by `Tier.tsx` and the HUD.
- `src/scale/constants.ts` — physical constants, `canonScale`, `dc`↔meters helpers, seam/fade/dolly thresholds, and `latLonToUnitVector` (places things at real lat/lon, aligned to the daymap UVs).

## Conventions / gotchas

- **Per-frame allocation is avoided** in hot loops — `PlayerRig` and `cameraBridge` reuse module-level scratch `Vector3`/`Euler` objects and mutate store vectors in place. Follow that pattern; don't allocate Three.js objects inside `useFrame`.
- **The scale-store invariants** in `docs/tier-system.md` are real: keep the camera target at the origin (panning is disabled by design), keep both tiers' Earth identical at the seam, keep `logarithmicDepthBuffer` on the far layer, and never render more than ~2 adjacent tiers at once.
- **React Compiler is on** (`babel-plugin-react-compiler` via `vite.config.ts`). Don't hand-add `useMemo`/`useCallback` for things it already handles; do keep components free of the manual-memo anti-patterns it forbids.
- TypeScript is strict-ish: `noUnusedLocals`/`noUnusedParameters` and `verbatimModuleSyntax` (use `import type` for type-only imports) are enforced — a build will fail on these.
- The Earth texture (`public/textures/earth_daymap.jpg`) is CC-BY 4.0 and **requires attribution** — see `ATTRIBUTION.md` before swapping or modifying it.

## Verifying changes

For any change touching scale, camera, or rendering, run the app and manually verify the seam: free-fly outward from Everest past ~25,000 km — the HUD must flip `Earth → Solar System` with **no visible pop or double-Earth** during the handoff (`transition` 0→1), and the return trip must be smooth. No automated check covers this.
