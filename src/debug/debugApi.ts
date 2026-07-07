// Installs `window.__debug`, a small navigation API that lets external tools
// (Playwright, the browser console) jump the camera to precomputed landmark
// positions without scripting WASD/mouse-look — see docs/superpowers/specs/
// 2026-06-08-everest-cone-and-debug-nav-design.md.
import { useEffect } from "react";
import { Vector3 } from "three";
import { usePlayerStore } from "../player/playerStore";
import { BODIES, bodyById } from "../world/bodies";
import { EARTH_RADIUS_M, SUN_POS } from "../world/constants";
import { DEEP_FIELD_RADIUS } from "../world/DeepField";
import {
	BOX_CLUSTER_ORIGIN,
	PLAYER_START,
	SUMMIT,
	TERRAIN_CENTER,
} from "../world/everestSite";
import { LANDMARKS_LOOK_AT, LANDMARKS_VIEWPOINT } from "../world/landmarksData";
import { type FrameStats, readFrameStats } from "./frameProbe";

type Vec3Tuple = [number, number, number];

const toTuple = (v: Vector3): Vec3Tuple => [v.x, v.y, v.z];
const fromTuple = (t: Vec3Tuple) => new Vector3(t[0], t[1], t[2]);

// Body centers, keyed by id (earth, moon, sun, proxima, andromeda, …) — the
// shared bodies list is the source of truth (see src/world/bodies.ts).
const bodyViewpoints = Object.fromEntries(
	BODIES.map((b) => [b.id, toTuple(b.position)]),
) as Record<string, Vec3Tuple>;

const VIEWPOINTS = {
	...bodyViewpoints,
	/** Alias for the Earth body center, kept for the documented `__debug` name. */
	earthCenter: [0, 0, 0] as Vec3Tuple,
	summit: toTuple(SUMMIT),
	terrainCenter: toTuple(TERRAIN_CENTER),
	playerStart: toTuple(PLAYER_START),
	boxCluster: toTuple(BOX_CLUSTER_ORIGIN),
	/** Stand 300 m in front of the landmark exhibit; look toward the Burj Khalifa. */
	landmarkExhibit: toTuple(LANDMARKS_VIEWPOINT),
	/** Look-at target to pair with landmarkExhibit — the Burj Khalifa at 100 m height. */
	landmarkExhibitLookAt: toTuple(LANDMARKS_LOOK_AT),
	/** Near the edge of the observable universe (95% of the deep-field radius). */
	deepFieldRim: toTuple(
		SUN_POS.clone().add(new Vector3(DEEP_FIELD_RADIUS * 0.95, 0, 0)),
	),
} satisfies Record<string, Vec3Tuple>;

export interface DebugApi {
	/** Jump to `position` (absolute Earth-centered meters). If `lookAt` is given, faces that point. */
	teleport: (position: Vec3Tuple, lookAt?: Vec3Tuple) => void;
	/** Glide to a body by id (earth, moon, sun, proxima, andromeda, …, everest). */
	flyTo: (id: string) => void;
	/** Precomputed absolute positions for key landmarks — pass these straight to `teleport`. */
	viewpoints: typeof VIEWPOINTS;
	/** Earth's radius in meters, handy for offsetting viewpoints (e.g. `earthCenter` plus a surface radius). */
	earthRadiusM: number;
	/** Rolling N-frame timing average — read before/after adding a render layer to measure its FPS cost. */
	frameStats: () => FrameStats;
}

const installDebugApi = (): DebugApi => {
	const api: DebugApi = {
		teleport: (position, lookAt) => {
			usePlayerStore
				.getState()
				.teleport(fromTuple(position), lookAt ? fromTuple(lookAt) : undefined);
		},
		flyTo: (id) => {
			const body = bodyById(id);
			if (body) usePlayerStore.getState().startFlyTo(body);
		},
		viewpoints: VIEWPOINTS,
		earthRadiusM: EARTH_RADIUS_M,
		frameStats: readFrameStats,
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
