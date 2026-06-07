import {
	AU_M,
	EARTH_RADIUS_M,
	MOON_DIST_M,
	MOON_RADIUS_M,
	SUN_RADIUS_M,
} from "../scale/constants";
import { EarthGlobe } from "./Earth";

// Solar tier is authored in units where 1 unit = 1000 km.
const M_PER_UNIT = 1e6;
const u = (meters: number) => meters / M_PER_UNIT;

/** Solar-system tier content. Earth sits at the origin so the seam aligns. */
export function SolarSystem() {
	return (
		<group>
			{/* Earth — same texture/position as the Earth tier so the cross-fade aligns. */}
			<EarthGlobe radius={u(EARTH_RADIUS_M)} />

			{/* Moon */}
			<mesh position={[u(MOON_DIST_M), 0, 0]}>
				<sphereGeometry args={[u(MOON_RADIUS_M), 32, 32]} />
				<meshStandardMaterial color="#bcbcbc" />
			</mesh>

			{/* Sun — emissive so it reads as a light source regardless of lighting. */}
			<mesh position={[0, 0, -u(AU_M)]}>
				<sphereGeometry args={[u(SUN_RADIUS_M), 48, 48]} />
				<meshBasicMaterial color="#fff2cc" />
			</mesh>
		</group>
	);
}
