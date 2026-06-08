# Everest Cone, Ground Rework, and Debug Nav API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a true-scale Everest cone to the world, rework the ground/anchor so the cone, ground plane, player, and boxes all sit flush together (peak at true height, base flat on ground, player beside it), and add a small `window.__debug` teleport API so Playwright can jump the camera to named viewpoints without scripting WASD/mouse-look.

**Architecture:** A new shared module `src/world/everestSite.ts` centralizes the frame geometry (the lat/lon anchor, local up/tangent/binormal axes, orientation quaternions, and the named layout points) that `Markers.tsx`, `Mountain.tsx`, and `playerStore.ts` all need — replacing the geometry that's currently duplicated/baked into `Markers.tsx` and `playerStore.ts` separately. `yaw`/`pitch` move from `PlayerRig`'s local refs into `playerStore` so a new `teleport` action can drive them externally; `window.__debug` is a thin wrapper that calls `teleport` with precomputed viewpoints from `everestSite.ts`.

**Tech Stack:** React 19 + TypeScript + Vite + Three.js / React Three Fiber + Zustand. No automated test suite — verification is `pnpm build`/`pnpm lint` plus manual checks via the Playwright MCP browser tools (per `docs/floating-origin-spike.md`'s checklist).

---

## File Structure

- **Create** `src/world/everestSite.ts` — shared frame geometry and named layout points (anchor, axes, quaternions, `PLAYER_START`, `BOX_CLUSTER_ORIGIN`, `CONE_CENTER`, `CONE_PEAK`).
- **Create** `src/world/Mountain.tsx` — the placeholder Everest cone component.
- **Create** `src/debug/debugApi.ts` — builds the `window.__debug` object (teleport + viewpoints) and a `useDebugApi()` hook that installs it.
- **Modify** `src/world/constants.ts` — add `EVEREST_BASE_RADIUS_M`.
- **Modify** `src/world/Markers.tsx` — import frame/layout from `everestSite.ts` instead of computing it locally; enlarge the ground plane; render `<Mountain />`; re-anchor the box cluster.
- **Modify** `src/player/playerStore.ts` — compute `initialPosition` from `everestSite.ts`'s `PLAYER_START`; move `yaw`/`pitch` into the store; add `teleport`.
- **Modify** `src/player/PlayerRig.tsx` — read/mutate `yaw`/`pitch` from the store instead of local refs.
- **Modify** `src/scene/Scene.tsx` — mount the debug API alongside `PlayerRig`.

---

### Task 1: Add `EVEREST_BASE_RADIUS_M` constant

**Files:**
- Modify: `src/world/constants.ts`

- [ ] **Step 1: Add the constant next to the other Everest constants**

In `src/world/constants.ts`, find:

```ts
export const EVEREST_HEIGHT_M = 8849;
export const EVEREST_LAT = 27.986065;
export const EVEREST_LON = 86.922623;
```

Replace with:

```ts
export const EVEREST_HEIGHT_M = 8849;
export const EVEREST_BASE_RADIUS_M = 10_000;
export const EVEREST_LAT = 27.986065;
export const EVEREST_LON = 86.922623;
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: succeeds (this is an additive export; nothing references it yet, and `noUnusedLocals` only applies to locals/params, not exports).

- [ ] **Step 3: Commit**

```bash
git add src/world/constants.ts
git commit -m "feat: add EVEREST_BASE_RADIUS_M constant"
```

---

### Task 2: Create the shared `everestSite.ts` frame module

This is the geometric heart of the change: one module that computes the local
frame at Everest's lat/lon (at **sea level** — the new ground anchor, not the
old summit anchor), the cone's center/peak, the ground orientation, and the
player/box layout points beside the cone. Both `Markers.tsx` and
`playerStore.ts` will import from here instead of duplicating this math.

**Files:**
- Create: `src/world/everestSite.ts`

- [ ] **Step 1: Write the module**

```ts
// Shared geometry for the Everest site: the local frame at Everest's true
// lat/lon (anchored at sea level — this is where the ground plane is tangent
// and where the mountain's base sits), plus the named layout points that
// position the cone, ground, player, and box cluster relative to it.
//
// Everything here is in absolute Earth-centered meters (float64); see
// FloatingGroup.tsx for how that becomes camera-relative render space.
import { Matrix4, Quaternion, Vector3 } from "three";
import {
	EARTH_RADIUS_M,
	EVEREST_BASE_RADIUS_M,
	EVEREST_HEIGHT_M,
	EVEREST_LAT,
	EVEREST_LON,
	latLonToUnitVector,
} from "./constants";

/** Local "up" at Everest's lat/lon — also the surface normal and the cone's axis. */
export const up = new Vector3(...latLonToUnitVector(EVEREST_LAT, EVEREST_LON));

/**
 * Ground anchor: the sea-level point at Everest's true lat/lon. This is where
 * the flat ground plane is tangent to the sphere AND where the mountain's
 * base is centered — the cone's peak ends up at true height directly above
 * this point (the old "summit" coordinate is now derived, not anchored).
 */
export const groundAnchor = up.clone().multiplyScalar(EARTH_RADIUS_M);

/** East direction on the ground (tangent to the sphere at the anchor). */
export const tangent = new Vector3()
	.crossVectors(up, new Vector3(0, 1, 0))
	.normalize();

/** North direction on the ground (tangent to the sphere at the anchor). */
export const binormal = new Vector3().crossVectors(tangent, up).normalize();

/** Surface-aligned orientation: local X → east, local Y → up, local Z → north. Used for the cone and boxes so their local +Y is radial. */
export const surfaceQuat = new Quaternion().setFromRotationMatrix(
	new Matrix4().makeBasis(tangent, up, binormal),
);

/** Ground-plane orientation: rotates PlaneGeometry's default +Z normal to point along "up". */
export const groundQuat = new Quaternion().setFromUnitVectors(
	new Vector3(0, 0, 1),
	up,
);

/** Ground plane footprint — large enough to hold the cone's 10 km-radius base and the player/box area beside it. */
export const GROUND_SIZE_M = 60_000;

// --- Named layout points, all on/above the same flat ground ---

/** Center of the cone's base, on the ground, directly below its peak. */
export const CONE_CENTER = groundAnchor.clone();

/** The cone's peak — true Everest height above the ground anchor. */
export const CONE_PEAK = groundAnchor
	.clone()
	.addScaledVector(up, EVEREST_HEIGHT_M);

/** How far east of the cone's center the player/box area sits — clear of the base by ~3 km. */
const SITE_CLEARANCE_M = EVEREST_BASE_RADIUS_M + 3_000;

/** Ground point beside the cone where the player starts and the box cluster sits. */
export const SITE_GROUND_POINT = groundAnchor
	.clone()
	.addScaledVector(tangent, SITE_CLEARANCE_M);

/** Player eye height above the ground. */
export const EYE_HEIGHT_M = 1.7;

/** Player's starting position: beside the cone, on the ground, at eye height. */
export const PLAYER_START = SITE_GROUND_POINT.clone().addScaledVector(
	up,
	EYE_HEIGHT_M,
);

/** Box cluster origin: 5 m south (−binormal) of the site point, on the ground — same relative layout as the original summit canary frame. */
export const BOX_CLUSTER_ORIGIN = SITE_GROUND_POINT.clone().addScaledVector(
	binormal,
	-5,
);
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: succeeds. (Nothing imports this module yet, but it must compile standalone — `tsc -b` checks every file in the project.)

- [ ] **Step 3: Commit**

```bash
git add src/world/everestSite.ts
git commit -m "feat: add shared Everest site frame/layout module"
```

---

### Task 3: Create the `Mountain` component

**Files:**
- Create: `src/world/Mountain.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { EVEREST_BASE_RADIUS_M, EVEREST_HEIGHT_M } from "./constants";
import { CONE_CENTER, surfaceQuat, up } from "./everestSite";
import { FloatingGroup } from "./FloatingGroup";

// Placeholder Everest cone: true height (8,849 m), base radius 10 km
// (slope ≈ 41°). ConeGeometry is centered on its own origin, so the
// FloatingGroup is anchored at the cone's vertical midpoint — half its
// height above the ground — putting its base flat on the ground and its
// peak at true height above CONE_CENTER.
const CONE_MID = CONE_CENTER.clone().addScaledVector(up, EVEREST_HEIGHT_M / 2);

export function Mountain() {
	return (
		<FloatingGroup absolute={CONE_MID}>
			<mesh quaternion={surfaceQuat}>
				<coneGeometry args={[EVEREST_BASE_RADIUS_M, EVEREST_HEIGHT_M, 32]} />
				<meshStandardMaterial color="#8a8378" />
			</mesh>
		</FloatingGroup>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/world/Mountain.tsx
git commit -m "feat: add placeholder Everest cone component"
```

---

### Task 4: Rework `Markers.tsx` — shared frame, bigger ground, mountain, re-anchored boxes

**Files:**
- Modify: `src/world/Markers.tsx`

- [ ] **Step 1: Replace the locally-computed summit frame with the shared module**

In `src/world/Markers.tsx`, delete the entire "Summit canary frame" block
(lines 18–46 in the current file — from the `// --- Summit canary frame...`
comment through `const clusterOrigin = ...`), and replace it with imports from
`everestSite`. The new top of the file (imports + frame setup) becomes:

```tsx
import { useTexture } from "@react-three/drei";
import { Vector3 } from "three";
import {
	AU_M,
	EARTH_RADIUS_M,
	GALAXY_DIST_M,
	MOON_DIST_M,
	MOON_RADIUS_M,
	STAR_DIST_M,
	SUN_RADIUS_M,
} from "./constants";
import {
	BOX_CLUSTER_ORIGIN,
	GROUND_SIZE_M,
	groundAnchor,
	groundQuat,
	surfaceQuat,
	up,
} from "./everestSite";
import { FloatingGroup } from "./FloatingGroup";
import { Mountain } from "./Mountain";

// --- Summit canary frame (the single-canvas z-fight test) ---
// A cluster of ~2 m boxes a centimeter apart, beside the Everest cone, so we
// can check that one log-depth canvas keeps them crisp while the Sun is in
// frame at 1 AU. See docs/floating-origin-spike.md.
const boxAt = (alongUp: number, alongTangentAxis: number) =>
	BOX_CLUSTER_ORIGIN.clone()
		.addScaledVector(up, alongUp)
		.addScaledVector(everestTangent, alongTangentAxis);
```

Wait — `boxAt` needs the tangent axis. Re-export it from `everestSite` rather
than re-deriving it: add `tangent` to the `everestSite` import list (so the
import becomes `..., surfaceQuat, tangent, up,`) and reference it directly.
Rewrite the block as:

```tsx
// --- Summit canary frame (the single-canvas z-fight test) ---
// A cluster of ~2 m boxes a centimeter apart, beside the Everest cone, so we
// can check that one log-depth canvas keeps them crisp while the Sun is in
// frame at 1 AU. See docs/floating-origin-spike.md.
const boxAt = (alongUp: number, alongTangentAxis: number) =>
	BOX_CLUSTER_ORIGIN.clone()
		.addScaledVector(up, alongUp)
		.addScaledVector(tangent, alongTangentAxis);

// 2 m cubes on the ground: A centred 1 m above surface, B 1 cm to A's east, C 1 cm above A.
const BOX_A = boxAt(1, 0);
const BOX_B = boxAt(1, 2.01);
const BOX_C = boxAt(3.01, 0);
```

So the final import list from `./everestSite` is:
`BOX_CLUSTER_ORIGIN, GROUND_SIZE_M, groundAnchor, groundQuat, surfaceQuat, tangent, up`.

Also remove `Matrix4` and `Quaternion` from the `three` import (they're no
longer used directly in this file — only `Vector3` remains), and remove the
now-unused `EVEREST_HEIGHT_M`, `EVEREST_LAT`, `EVEREST_LON`, `latLonToUnitVector`
imports from `./constants` (they moved into `everestSite.ts`).

- [ ] **Step 2: Update the ground plane to use the new anchor and size**

Find:

```tsx
			{/* Flat ground plane tangent to Earth at the summit */}
			<FloatingGroup absolute={summitSurface}>
				<mesh quaternion={groundQuat}>
					<planeGeometry args={[40, 40]} />
					<meshStandardMaterial color="#7a7060" />
				</mesh>
			</FloatingGroup>
```

Replace with:

```tsx
			{/* Flat ground plane tangent to Earth at Everest's true lat/lon (sea level) — large enough to hold the cone and the player/box area beside it */}
			<FloatingGroup absolute={groundAnchor}>
				<mesh quaternion={groundQuat}>
					<planeGeometry args={[GROUND_SIZE_M, GROUND_SIZE_M]} />
					<meshStandardMaterial color="#7a7060" />
				</mesh>
			</FloatingGroup>

			{/* True-scale Everest cone, base on the ground at groundAnchor, peak at true height */}
			<Mountain />
```

- [ ] **Step 3: Update the comment above the box cluster**

Find:

```tsx
			{/* Summit canary boxes: 2 m cubes, 1 cm apart, sitting on the ground */}
```

Replace with:

```tsx
			{/* Canary boxes: 2 m cubes, 1 cm apart, sitting on the ground beside the cone */}
```

(The `<Box position={BOX_A} />` etc. lines below it are unchanged — `Box`
already uses `surfaceQuat`, which now comes from `everestSite`.)

- [ ] **Step 4: Type-check and lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed with no errors (in particular, no `noUnusedLocals`
complaints — double-check every import in the new top-of-file block is
referenced somewhere in the component).

- [ ] **Step 5: Commit**

```bash
git add src/world/Markers.tsx
git commit -m "feat: rework ground/anchor around shared Everest site frame, add cone"
```

---

### Task 5: Move `yaw`/`pitch` into `playerStore` and add `teleport`

**Files:**
- Modify: `src/player/playerStore.ts`

- [ ] **Step 1: Replace the summit-based `initialPosition` with the shared `PLAYER_START`, and add `yaw`/`pitch`/`teleport` to the store**

Replace the entire contents of `src/player/playerStore.ts` with:

```ts
import { MathUtils, Quaternion, Vector3 } from "three";
import { create } from "zustand";
import { CONE_PEAK, PLAYER_START } from "../world/everestSite";

export const MIN_SPEED_MPS = 1; // m/s — slow enough to inspect the boxes
export const MAX_SPEED_MPS = 1e20; // m/s — fast enough to reach the galaxy marker
const INITIAL_SPEED_MPS = 5; // m/s — a brisk walk

const INITIAL_PITCH_RAD = MathUtils.degToRad(-62);

/** Derives yaw/pitch (radians, world +Y up, no roll) so a viewer at `from` faces `to`. */
const lookAtAngles = (from: Vector3, to: Vector3) => {
	const dir = to.clone().sub(from).normalize();
	return {
		yaw: Math.atan2(-dir.x, -dir.z),
		pitch: Math.asin(MathUtils.clamp(dir.y, -1, 1)),
	};
};

const initialAngles = lookAtAngles(PLAYER_START, CONE_PEAK);

interface PlayerState {
	/**
	 * Position in absolute Earth-centered meters (float64). Mutated in place each
	 * frame. The floating-origin subtraction in FloatingGroup reads this as the
	 * render origin, so the whole world is drawn relative to it.
	 */
	position: Vector3;
	/** Camera orientation. Mutated in place each frame from `yaw`/`pitch`. */
	orientation: Quaternion;
	/** Yaw (radians, world +Y up). Mutated in place by mouse-look each frame. */
	yaw: number;
	/** Pitch (radians, clamped to ±89°). Mutated in place by mouse-look each frame. */
	pitch: number;
	/** Movement speed in m/s, set by the player via the scroll wheel. */
	speed: number;
	/** Multiply speed by `factor` (>1 faster, <1 slower), clamped to the range. */
	stepSpeed: (factor: number) => void;
	/**
	 * Jump to `position` (absolute meters). If `lookAt` is given, derives and
	 * sets `yaw`/`pitch` so the player faces that point — `PlayerRig` rebuilds
	 * `orientation` from them on the next frame, exactly as mouse-look does.
	 * For driving the camera from outside the frame loop (see `src/debug/debugApi.ts`).
	 */
	teleport: (position: Vector3, lookAt?: Vector3) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	position: PLAYER_START.clone(),
	orientation: new Quaternion(),
	yaw: initialAngles.yaw,
	pitch: initialAngles.pitch,
	speed: INITIAL_SPEED_MPS,
	stepSpeed: (factor) =>
		set({
			speed: Math.min(
				MAX_SPEED_MPS,
				Math.max(MIN_SPEED_MPS, get().speed * factor),
			),
		}),
	teleport: (position, lookAt) => {
		const next: Partial<PlayerState> = { position: position.clone() };
		if (lookAt) {
			const angles = lookAtAngles(position, lookAt);
			next.yaw = angles.yaw;
			next.pitch = angles.pitch;
		}
		set(next);
	},
}));
```

Note: `INITIAL_PITCH_RAD` documents the old constant's value but is no longer
used directly — the player now starts facing the cone, derived via
`lookAtAngles`. **Delete the `INITIAL_PITCH_RAD` line** (it would otherwise
trip `noUnusedLocals`); it's shown above only so you know where the old -62°
constant went. The final file should not contain `INITIAL_PITCH_RAD`.

- [ ] **Step 2: Type-check and lint**

Run: `pnpm build && pnpm lint`
Expected: fails at this point — `PlayerRig.tsx` still declares its own local
`yaw`/`pitch` refs and reads `pitch.current`/`yaw.current`, which now shadow
rather than connect to the store. That's expected; Task 6 fixes it. Confirm
the *error* is in `PlayerRig.tsx` (e.g. unused `useRef`/`Euler` import warnings
or type mismatches), not in `playerStore.ts` itself — that tells you this
file's contents are sound on their own.

- [ ] **Step 3: Commit**

(Commit together with Task 6's `PlayerRig` fix so the tree never sits in a
broken state — see Task 6 Step 3.)

---

### Task 6: Update `PlayerRig` to read `yaw`/`pitch` from the store

**Files:**
- Modify: `src/player/PlayerRig.tsx`

- [ ] **Step 1: Remove the local refs and read/mutate the store's `yaw`/`pitch` instead**

Replace the whole file with:

```tsx
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, MathUtils, Vector3 } from "three";
import { useHudStore } from "../ui/hudStore";
import { useFreeFlyControls } from "./freeFlyControls";
import { usePlayerStore } from "./playerStore";

const PITCH_LIMIT = MathUtils.degToRad(89);

// Scratch objects reused every frame to avoid allocation.
const forward = new Vector3();
const right = new Vector3();
const worldUp = new Vector3(0, 1, 0);
const move = new Vector3();
const euler = new Euler(0, 0, 0, "YXZ");

/**
 * The only input integrator. Moves the player through absolute meter space and
 * drives the camera. With floating origin the camera is pinned at render-space
 * origin (0,0,0) — the world is drawn relative to the player position by
 * FloatingGroup — so the rig only sets the camera's orientation.
 * Yaw/pitch live in the player store (world +Y up, no roll) so external code
 * (e.g. the debug teleport API) can drive look direction too; this rig is the
 * only thing that advances them frame-to-frame via mouse-look.
 */
export function PlayerRig() {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const controls = useFreeFlyControls(gl.domElement);

	useFrame((_, dt) => {
		const player = usePlayerStore.getState();

		// --- mouse-look ---
		const look = controls.consumeLook();
		player.yaw += look.yaw;
		player.pitch = MathUtils.clamp(
			player.pitch + look.pitch,
			-PITCH_LIMIT,
			PITCH_LIMIT,
		);
		euler.set(player.pitch, player.yaw, 0);
		player.orientation.setFromEuler(euler);

		// --- movement in absolute meters (float64) ---
		forward.set(0, 0, -1).applyQuaternion(player.orientation);
		right.set(1, 0, 0).applyQuaternion(player.orientation);
		move.set(0, 0, 0);
		if (controls.isDown("KeyW")) move.add(forward);
		if (controls.isDown("KeyS")) move.sub(forward);
		if (controls.isDown("KeyD")) move.add(right);
		if (controls.isDown("KeyA")) move.sub(right);
		if (controls.isDown("KeyE") || controls.isDown("Space")) move.add(worldUp);
		if (controls.isDown("KeyQ") || controls.isDown("ControlLeft"))
			move.sub(worldUp);
		if (move.lengthSq() > 0) {
			move.normalize();
			player.position.addScaledVector(move, player.speed * dt);
		}

		// --- camera: pinned at render origin, orientation only (floating origin) ---
		camera.position.set(0, 0, 0);
		camera.quaternion.copy(player.orientation);

		// --- HUD readout ---
		useHudStore.getState().update(player.position.length());
	});

	return null;
}
```

(Only the `yaw`/`pitch` declarations and the two lines inside `useFrame` that
read/write them changed — `yaw.current`/`pitch.current` become `player.yaw`/
`player.pitch`, and the `useRef` import is gone.)

- [ ] **Step 2: Type-check and lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed now (this completes the wiring started in Task 5).

- [ ] **Step 3: Commit both Task 5 and Task 6 together**

```bash
git add src/player/playerStore.ts src/player/PlayerRig.tsx
git commit -m "refactor: move yaw/pitch into playerStore, add teleport action"
```

---

### Task 7: Add the `window.__debug` navigation API

**Files:**
- Create: `src/debug/debugApi.ts`
- Modify: `src/scene/Scene.tsx`

- [ ] **Step 1: Write the debug API module**

```ts
// Installs `window.__debug`, a small navigation API that lets external tools
// (Playwright, the browser console) jump the camera to precomputed landmark
// positions without scripting WASD/mouse-look — see docs/superpowers/specs/
// 2026-06-08-everest-cone-and-debug-nav-design.md.
import { useEffect } from "react";
import { Vector3 } from "three";
import { EARTH_RADIUS_M, AU_M, MOON_DIST_M } from "../world/constants";
import {
	BOX_CLUSTER_ORIGIN,
	CONE_CENTER,
	CONE_PEAK,
	PLAYER_START,
} from "../world/everestSite";
import { usePlayerStore } from "../player/playerStore";

type Vec3Tuple = [number, number, number];

const toTuple = (v: Vector3): Vec3Tuple => [v.x, v.y, v.z];
const fromTuple = (t: Vec3Tuple) => new Vector3(t[0], t[1], t[2]);

const VIEWPOINTS = {
	conePeak: toTuple(CONE_PEAK),
	coneBase: toTuple(CONE_CENTER),
	playerStart: toTuple(PLAYER_START),
	boxCluster: toTuple(BOX_CLUSTER_ORIGIN),
	earthCenter: [0, 0, 0] as Vec3Tuple,
	moon: [MOON_DIST_M, 0, 0] as Vec3Tuple,
	sun: [AU_M, 0, 0] as Vec3Tuple,
} satisfies Record<string, Vec3Tuple>;

export interface DebugApi {
	/** Jump to `position` (absolute Earth-centered meters). If `lookAt` is given, faces that point. */
	teleport: (position: Vec3Tuple, lookAt?: Vec3Tuple) => void;
	/** Precomputed absolute positions for key landmarks — pass these straight to `teleport`. */
	viewpoints: typeof VIEWPOINTS;
	/** Earth's radius in meters, handy for offsetting viewpoints (e.g. `earthCenter` plus a surface radius). */
	earthRadiusM: number;
}

const installDebugApi = (): DebugApi => {
	const api: DebugApi = {
		teleport: (position, lookAt) => {
			usePlayerStore
				.getState()
				.teleport(fromTuple(position), lookAt ? fromTuple(lookAt) : undefined);
		},
		viewpoints: VIEWPOINTS,
		earthRadiusM: EARTH_RADIUS_M,
	};
	(window as typeof window & { __debug: DebugApi }).__debug = api;
	return api;
};

/** Mounts `window.__debug` once. Render alongside `PlayerRig` inside the canvas tree (or anywhere — it has no visual output). */
export function useDebugApi() {
	useEffect(() => {
		installDebugApi();
	}, []);
}
```

- [ ] **Step 2: Mount it from `Scene`**

In `src/scene/Scene.tsx`, add the import and call the hook:

```tsx
import { Canvas } from "@react-three/fiber";
import { useDebugApi } from "../debug/debugApi";
import { PlayerRig } from "../player/PlayerRig";
import { FAR_M, NEAR_M } from "../world/constants";
import { Markers } from "../world/Markers";
```

and inside `export function Scene() {`, add the hook call as the first line of
the function body:

```tsx
export function Scene() {
	useDebugApi();

	return (
```

- [ ] **Step 3: Type-check and lint**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/debug/debugApi.ts src/scene/Scene.tsx
git commit -m "feat: add window.__debug teleport/viewpoints API for Playwright nav"
```

---

### Task 8: Manual verification with the Playwright MCP browser

This change touches scale/camera/rendering — per `CLAUDE.md` there's no
automated check for it. Verify by hand using the Playwright MCP browser tools.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev` (in the background — note the printed local URL, typically `http://localhost:5173`)

- [ ] **Step 2: Open the app and confirm the debug API is installed**

Use the Playwright MCP browser tools to navigate to the dev server URL, then
evaluate:

```js
() => Object.keys(window.__debug.viewpoints)
```

Expected: `["conePeak", "coneBase", "playerStart", "boxCluster", "earthCenter", "moon", "sun"]`

- [ ] **Step 3: Confirm the player starts beside the cone, on the ground**

Take a snapshot/screenshot. Expected: the giant cone is in view to one side,
the flat ground stretches beneath the viewpoint with no gap to the camera, and
(once close enough — see Step 5) the small canary boxes are nearby. The cone's
base should look planted on the ground with no floating gap beneath it.

- [ ] **Step 4: Teleport to the cone's base and confirm it's flush with the ground**

```js
() => window.__debug.teleport(window.__debug.viewpoints.coneBase, window.__debug.viewpoints.conePeak)
```

Take a screenshot looking up the cone's slope from its base. Expected: the
cone meets the ground with no visible gap or z-fight at the seam, looking up
toward the peak at true height.

- [ ] **Step 5: Teleport to the box cluster and confirm the boxes are crisp and grounded**

```js
() => window.__debug.teleport(
  [window.__debug.viewpoints.boxCluster[0], window.__debug.viewpoints.boxCluster[1] + 3, window.__debug.viewpoints.boxCluster[2] + 6],
  window.__debug.viewpoints.boxCluster
)
```

Take a screenshot. Expected: the three 2 m boxes (1 cm apart) render crisply
with no z-fighting, sitting flat on the ground — and the giant cone is visible
in the background at true scale, giving the human-vs-mountain scale contrast
the task asked for.

- [ ] **Step 6: Confirm the wider free-fly path still has no pop**

```js
() => window.__debug.teleport(window.__debug.viewpoints.sun, window.__debug.viewpoints.earthCenter)
```

Take a screenshot. Expected: Earth and the cone-bearing region render without
popping or jitter from far away — consistent with the floating-origin
checklist in `docs/floating-origin-spike.md`.

- [ ] **Step 7: Record the result**

If all checks pass, note in your final summary that manual Playwright
verification confirmed: cone flush with ground, boxes crisp and grounded,
debug API working, and no pop at distance. If anything looks off (gaps,
z-fighting, jitter), stop and report exactly what you saw and at which
viewpoint — do not proceed to mark the work complete.

---

## Self-Review Notes (for whoever executes this)

- Every named export used in a later task (`EVEREST_BASE_RADIUS_M`, `up`,
  `groundAnchor`, `tangent`, `binormal`, `surfaceQuat`, `groundQuat`,
  `GROUND_SIZE_M`, `CONE_CENTER`, `CONE_PEAK`, `SITE_GROUND_POINT`,
  `EYE_HEIGHT_M`, `PLAYER_START`, `BOX_CLUSTER_ORIGIN`, `Mountain`,
  `useDebugApi`, `teleport`, `yaw`, `pitch`) is defined exactly once, in the
  task that creates it, with that exact name — grep for the name before
  renaming anything.
- `playerStore`'s `EYE_HEIGHT_M` and `MIN_SPEED_MPS`/`MAX_SPEED_MPS` constants:
  `EYE_HEIGHT_M` moved into `everestSite.ts` (it's geometry, used to derive
  `PLAYER_START`); `MIN_SPEED_MPS`/`MAX_SPEED_MPS` stay in `playerStore.ts`
  (they're store concerns, and `Hud.tsx`/others may import them — grep for
  `MIN_SPEED_MPS` to confirm nothing else imports `EYE_HEIGHT_M` from
  `playerStore` before deleting it from there).
