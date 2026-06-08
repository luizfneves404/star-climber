# Everest cone, ground rework, and Playwright debug navigation

## Context

`src/world/Markers.tsx` currently anchors the ground plane and summit canary
boxes at Everest's *summit* elevation (`EARTH_RADIUS_M + EVEREST_HEIGHT_M`),
floating ~8.8 km above Earth's actual sphere surface with nothing supporting
them — there is no mountain mesh in the new floating-origin world (the old
`src/scene/Mountain.tsx` placeholder cone was removed when the tier system was
superseded).

This change adds an Everest-sized cone back, places it and the existing
ground/boxes so everything sits flush together, and reduces the friction of
testing camera placement with Playwright by adding a small debug navigation
API.

## 1. `Mountain` component

New file `src/world/Mountain.tsx`, following the pattern of `Box`/`EarthMesh`
in `Markers.tsx`:

- `coneGeometry` — height `EVEREST_HEIGHT_M` (8,849 m), base radius
  `EVEREST_BASE_RADIUS_M` (new constant in `constants.ts`, 10,000 m — matches
  the old removed placeholder's slope of ≈ 41°).
- `meshStandardMaterial` color `#8a8378` (same placeholder grey-brown as the
  old `Mountain.tsx`).
- Wrapped in a `FloatingGroup` whose `absolute` position is the cone mesh's
  *center* — `groundAnchor + up * (EVEREST_HEIGHT_M / 2)` — so the geometry
  (centered on its own origin, spanning `±height/2`) has its base exactly on
  the ground and its peak at true height above it.
- Rotated with the existing `surfaceQuat` (local +Y → `up`), the same
  orientation already used for the boxes, so the cone's axis is radial.

## 2. Anchor + ground rework (`Markers.tsx`)

The anchor point changes meaning: it was "Everest's summit"
(`EARTH_RADIUS_M + EVEREST_HEIGHT_M`), it becomes **"Everest's true lat/lon at
sea level"** (`groundAnchor = up * EARTH_RADIUS_M`). This is:

- where the ground plane is tangent to the sphere, and
- where the cone's base is centered (so the cone's peak ends up at true height
  directly above this point — the original "summit" coordinate is now the
  cone's *peak*, derived rather than anchored).

The ground plane grows from 40×40 m to **60×60 km**, still a flat rectangle
tangent at `groundAnchor` with the same `groundQuat` orientation logic — large
enough to comfortably contain both the cone's 10 km-radius footprint and the
player/box area beside it. The mismatch between this flat plane and Earth's
curvature at this scale (~tens of meters at the plane's edges) is an accepted
placeholder quirk, consistent with how the existing summit canary frame
already treats the ground as locally flat.

## 3. Player & box cluster relocation

Both move from "on the summit" to **"on the ground, beside the cone"**:

- A new `PLAYER_START` point offset from `groundAnchor` along `tangent`
  (east) by `EVEREST_BASE_RADIUS_M + 3000` (≈ 13 km from the cone's center,
  ≈ 3 km clear of its base edge), at ground level (`groundAnchor` plane) plus
  `EYE_HEIGHT_M`.
- The box cluster (`clusterOrigin` and `BOX_A/B/C`) keeps its current relative
  layout (2 m cubes, 1 cm apart, 5 m offset from the cluster origin) but is
  re-anchored near `PLAYER_START` instead of the old summit point.
- `playerStore`'s `initialPosition` is recomputed from the same anchor +
  offset math (importing the shared geometry helpers/constants rather than
  duplicating the lat/lon → summit calculation it does today).

To avoid duplicating the anchor/frame geometry between `playerStore.ts` and
`Markers.tsx`, the shared frame vectors (`up`, `tangent`, `binormal`,
`groundAnchor`, `surfaceQuat`, `groundQuat`, `PLAYER_START`,
`BOX_CLUSTER_ORIGIN`) move into a small shared module — e.g.
`src/world/everestSite.ts` — that both import.

## 4. Debug navigation API for Playwright

**Store changes (`playerStore.ts`):**

- `yaw`/`pitch` move from `PlayerRig`'s local `useRef`s into the store as
  plain mutable numbers (mutated in place each frame, like `position`), so
  external code can drive look direction. Initial pitch keeps today's
  constant (`MathUtils.degToRad(-62)`); initial yaw is derived so the player
  starts facing the cone.
- A new `teleport(position: Vector3, lookAt?: Vector3)` action: copies
  `position` into the store's position, and — if `lookAt` is given — derives
  `yaw`/`pitch` from the direction `lookAt - position` and writes them into
  the store (so the next `PlayerRig` frame picks them up and rebuilds
  `orientation` from them, exactly as mouse-look does today).

**`PlayerRig` changes:** reads/mutates `yaw`/`pitch` from the store instead of
local refs; otherwise unchanged (still the only per-frame integrator).

**New module `src/debug/debugApi.ts`:** mounted once (e.g. a `useEffect` in
`Scene` or its own tiny component rendered alongside `PlayerRig`), assigns:

```ts
window.__debug = {
  teleport(position: [number, number, number], lookAt?: [number, number, number]): void
  viewpoints: {
    conePeak: [number, number, number]
    coneBase: [number, number, number]
    playerStart: [number, number, number]
    boxCluster: [number, number, number]
    earthCenter: [number, number, number]
  }
}
```

`viewpoints` is built from the same shared `everestSite` constants (plus
`EARTH_POS`/`STAR_POS` etc. from `Markers.tsx` where relevant) so a Playwright
script can do, e.g.:

```js
page.evaluate(() => {
  const { teleport, viewpoints } = window.__debug;
  teleport(viewpoints.coneBase, viewpoints.conePeak);
});
```

without recomputing any geometry itself. `teleport` calls straight into the
store's `teleport` action.

## Testing / verification

Manual, per the project's existing convention (no automated test suite covers
scale/seam behavior): run the dev server, use `window.__debug.teleport(...)`
from the Playwright MCP / browser console to jump between `playerStart`,
`coneBase`, and `conePeak`, and confirm:

- the cone's base sits flush on the ground with no visible gap, beside the
  ground plane and box cluster (all flat, no floating geometry);
- the boxes remain crisp (no z-fight) at 1 cm separation while the cone looms
  at true scale in the same frame;
- free-flying from beside the cone out past Earth/Moon/Sun still has no pop
  (per the existing floating-origin checklist in
  `docs/floating-origin-spike.md`).
