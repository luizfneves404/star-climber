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
