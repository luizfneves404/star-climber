import { Quaternion, Vector3 } from "three";
import { create } from "zustand";
import {
	EARTH_RADIUS_M,
	EVEREST_HEIGHT_M,
	EVEREST_LAT,
	EVEREST_LON,
	latLonToUnitVector,
} from "../scale/constants";

const EYE_HEIGHT_M = 1.7;

// Initial position: standing on Everest's summit, expressed in Earth-centered meters.
const summitDir = new Vector3(...latLonToUnitVector(EVEREST_LAT, EVEREST_LON));
const initialPosition = summitDir
	.clone()
	.multiplyScalar(EARTH_RADIUS_M + EVEREST_HEIGHT_M + EYE_HEIGHT_M);

export const MIN_SPEED_MPS = 1; // m/s — slow enough to inspect the mountain
export const MAX_SPEED_MPS = 1e9; // m/s — fast enough to cross to the Sun in minutes
const INITIAL_SPEED_MPS = 5; // m/s — a brisk walk

interface PlayerState {
	/**
	 * Position in meters, Earth-centered (float64). Mutated in place each frame.
	 * The seam's source of truth — keep it Earth-centered (docs/tier-system.md #1).
	 */
	position: Vector3;
	/** Camera orientation. Mutated in place each frame. */
	orientation: Quaternion;
	/** Movement speed in m/s, set by the player via the scroll wheel. */
	speed: number;
	/** Multiply speed by `factor` (>1 faster, <1 slower), clamped to the range. */
	stepSpeed: (factor: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	position: initialPosition,
	orientation: new Quaternion(),
	speed: INITIAL_SPEED_MPS,
	stepSpeed: (factor) =>
		set({
			speed: Math.min(
				MAX_SPEED_MPS,
				Math.max(MIN_SPEED_MPS, get().speed * factor),
			),
		}),
}));
