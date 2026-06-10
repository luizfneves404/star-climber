import { Euler, MathUtils, Quaternion, type Vector3 } from "three";
import { create } from "zustand";
import { PLAYER_START, SUMMIT } from "../world/everestSite";

export const MIN_SPEED_MPS = 1; // m/s — slow enough to inspect the boxes
export const MAX_SPEED_MPS = 1e20; // m/s — fast enough to reach the galaxy marker
const INITIAL_SPEED_MPS = 5; // m/s — a brisk walk

/** Derives yaw/pitch (radians, world +Y up, no roll) so a viewer at `from` faces `to`. */
const lookAtAngles = (from: Vector3, to: Vector3) => {
	const dir = to.clone().sub(from).normalize();
	return {
		yaw: Math.atan2(-dir.x, -dir.z),
		pitch: Math.asin(MathUtils.clamp(dir.y, -1, 1)),
	};
};

const initialAngles = lookAtAngles(PLAYER_START, SUMMIT);
const initialOrientation = new Quaternion().setFromEuler(
	new Euler(initialAngles.pitch, initialAngles.yaw, 0, "YXZ"),
);

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
	orientation: initialOrientation.clone(),
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
			next.orientation = new Quaternion().setFromEuler(
				new Euler(angles.pitch, angles.yaw, 0, "YXZ"),
			);
		}
		set(next);
	},
}));
