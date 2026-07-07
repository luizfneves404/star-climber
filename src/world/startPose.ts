// Where the player begins, per world. playerStore reads this instead of
// importing everestSite directly, so the sizes world can start in front of the
// human without the store knowing about either world.
import type { Vector3 } from "three";
import { ACTIVE_WORLD } from "./activeWorld";
import { PLAYER_START, SUMMIT } from "./everestSite";
import { SIZES_START } from "./sizesGallery";

export const INITIAL_POSE: { position: Vector3; lookAt: Vector3 } =
	ACTIVE_WORLD === "sizes"
		? SIZES_START
		: { position: PLAYER_START, lookAt: SUMMIT };
