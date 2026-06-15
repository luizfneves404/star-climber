import { useTexture } from "@react-three/drei";
import { Vector3 } from "three";
import {
	AU_M,
	EARTH_RADIUS_M,
	GALAXY_DIST_M,
	MOON_DIST_M,
	MOON_RADIUS_M,
	STAR_DIST_M,
	SUN_RADIUS_M,
} from "./constants";
import { BOX_CLUSTER_ORIGIN, surfaceQuat, tangent, up } from "./everestSite";
import { FloatingGroup } from "./FloatingGroup";
import { Ground } from "./Ground";
import { Landmarks } from "./Landmarks";
import { Mountain } from "./Mountain";

// --- Summit canary frame (the single-canvas z-fight test) ---
// A cluster of ~2 m boxes a centimeter apart, beside the Everest terrain
// patch, so we can check that one log-depth canvas keeps them crisp while
// the Sun is in frame at 1 AU. See docs/floating-origin-spike.md.
const boxAt = (alongUp: number, alongTangentAxis: number) =>
	BOX_CLUSTER_ORIGIN.clone()
		.addScaledVector(up, alongUp)
		.addScaledVector(tangent, alongTangentAxis);

// 2 m cubes on the ground: A centred 1 m above surface, B 1 cm to A's east, C 1 cm above A.
const BOX_A = boxAt(1, 0);
const BOX_B = boxAt(1, 2.01);
const BOX_C = boxAt(3.01, 0);

// --- Bodies, true scale, strung out along +X by increasing distance ---
const along = (d: number) => new Vector3(d, 0, 0);
const EARTH_POS = new Vector3(0, 0, 0);
const MOON_POS = along(MOON_DIST_M);
const SUN_POS = along(AU_M);
const STAR_POS = along(STAR_DIST_M);
const GALAXY_POS = along(GALAXY_DIST_M);

// Visible-marker radii for the outermost objects (true radii would be sub-pixel
// dots; these are deliberately oversized so something is on screen out there —
// the test is that coordinates don't explode, not photometric accuracy).
const STAR_MARKER_R = 5e9;
const GALAXY_MARKER_R = 1e19;

function EarthMesh() {
	const texture = useTexture("/textures/earth_daymap.jpg");
	return (
		<mesh>
			<sphereGeometry args={[EARTH_RADIUS_M, 64, 64]} />
			<meshStandardMaterial map={texture} />
		</mesh>
	);
}

function MoonMesh() {
	const texture = useTexture("/textures/8k_moon.jpg");
	return (
		<mesh>
			<sphereGeometry args={[MOON_RADIUS_M, 48, 48]} />
			<meshStandardMaterial map={texture} />
		</mesh>
	);
}

function SunMesh() {
	const texture = useTexture("/textures/8k_sun.jpg");
	return (
		<mesh>
			<sphereGeometry args={[SUN_RADIUS_M, 48, 48]} />
			<meshBasicMaterial map={texture} />
		</mesh>
	);
}

function Box({ position }: { position: Vector3 }) {
	return (
		<FloatingGroup absolute={position}>
			<mesh quaternion={surfaceQuat}>
				<boxGeometry args={[2, 2, 2]} />
				<meshStandardMaterial color="#d6c08a" />
			</mesh>
		</FloatingGroup>
	);
}

export function Markers() {
	return (
		<>
			{/* Flat textured ground plane tangent to Earth at Everest's true lat/lon (sea level) */}
			<Ground />

			{/* True-scale Everest terrain patch, anchored at groundAnchor, summit at true height */}
			<Mountain />

			{/* Size-comparison exhibit: human → bus → whale → building → Burj Khalifa */}
			<Landmarks />

			{/* Canary boxes: 2 m cubes, 1 cm apart, sitting on the ground beside the terrain patch */}
			<Box position={BOX_A} />
			<Box position={BOX_B} />
			<Box position={BOX_C} />

			{/* Earth — textured, at the origin; watch for surface swimming/z-fight */}
			<FloatingGroup absolute={EARTH_POS}>
				<EarthMesh />
			</FloatingGroup>

			<FloatingGroup absolute={MOON_POS}>
				<MoonMesh />
			</FloatingGroup>

			<FloatingGroup absolute={SUN_POS}>
				<SunMesh />
			</FloatingGroup>

			<FloatingGroup absolute={STAR_POS}>
				<mesh>
					<sphereGeometry args={[STAR_MARKER_R, 16, 16]} />
					<meshBasicMaterial color="#ffffff" />
				</mesh>
			</FloatingGroup>

			<FloatingGroup absolute={GALAXY_POS}>
				<mesh>
					<sphereGeometry args={[GALAXY_MARKER_R, 24, 24]} />
					<meshBasicMaterial color="#a070d0" wireframe />
				</mesh>
			</FloatingGroup>
		</>
	);
}
