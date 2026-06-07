import type { Camera, Quaternion, Vector3 } from "three";
import { EARTH_RADIUS_M } from "../scale/constants";

const CANON_PER_METER = 1 / EARTH_RADIUS_M;

/**
 * Places a render camera at the player's meter-space pose, converted into
 * canonical render space (Earth radius = 1). Shared by both render layers so the
 * far (logarithmic-depth) and near (normal-depth) cameras stay perfectly aligned.
 */
export function syncCameraToPlayer(
	camera: Camera,
	position: Vector3,
	orientation: Quaternion,
) {
	camera.position.copy(position).multiplyScalar(CANON_PER_METER);
	camera.quaternion.copy(orientation);
}
