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
