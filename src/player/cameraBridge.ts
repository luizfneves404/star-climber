import type { Camera, Quaternion, Vector3 } from "three";
import { EARTH_RADIUS_M } from "../scale/constants";

const CANON_PER_METER = 1 / EARTH_RADIUS_M;

/**
 * Places a render camera at the player's meter-space pose, converted into
 * canonical render space (Earth radius = 1). Shared by both render layers so the
 * far (logarithmic-depth) and near (normal-depth) cameras stay perfectly aligned.
 *
 * INVARIANT (docs/tier-system.md #1): `position` is Earth-CENTERED meters, so the
 * canonical `camera.position.length()` equals the distance from Earth's center —
 * which is what the tier seam relies on. Don't re-base this origin off the center.
 */
export function syncCameraToPlayer(
	camera: Camera,
	position: Vector3,
	orientation: Quaternion,
) {
	camera.position.copy(position).multiplyScalar(CANON_PER_METER);
	camera.quaternion.copy(orientation);
}
