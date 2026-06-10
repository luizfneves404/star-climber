// Installs `window.__debug`, a small navigation API that lets external tools
// (Playwright, the browser console) jump the camera to precomputed landmark
// positions without scripting WASD/mouse-look — see docs/superpowers/specs/
// 2026-06-08-everest-cone-and-debug-nav-design.md.
import { useEffect } from "react";
import { Vector3 } from "three";
import { usePlayerStore } from "../player/playerStore";
import { AU_M, EARTH_RADIUS_M, MOON_DIST_M } from "../world/constants";
import {
	BOX_CLUSTER_ORIGIN,
	PLAYER_START,
	SUMMIT,
	TERRAIN_CENTER,
} from "../world/everestSite";

type Vec3Tuple = [number, number, number];

const toTuple = (v: Vector3): Vec3Tuple => [v.x, v.y, v.z];
const fromTuple = (t: Vec3Tuple) => new Vector3(t[0], t[1], t[2]);

const VIEWPOINTS = {
	summit: toTuple(SUMMIT),
	terrainCenter: toTuple(TERRAIN_CENTER),
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
