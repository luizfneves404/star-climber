import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import {
	EARTH_RADIUS_M,
	EVEREST_HEIGHT_M,
	EVEREST_LAT,
	EVEREST_LON,
	latLonToUnitVector,
} from "../scale/constants";

const UP = new Vector3(0, 1, 0);
const PLATFORM_RADIUS_M = 200;

// Human-scale boxes (local tangent-plane x,z offsets in meters) whose crisp edges
// make any sub-meter float jitter immediately visible.
const BOX_OFFSETS: ReadonlyArray<[number, number]> = [
	[10, 5],
	[-8, 12],
	[20, -6],
	[-15, -10],
	[4, 22],
	[30, 14],
	[-25, 8],
];

/** Human-scale reference geometry at Everest's summit (Earth tier, meters). */
export function Ground() {
	const { position, quaternion } = useMemo(() => {
		const dir = new Vector3(...latLonToUnitVector(EVEREST_LAT, EVEREST_LON));
		return {
			position: dir.clone().multiplyScalar(EARTH_RADIUS_M + EVEREST_HEIGHT_M),
			quaternion: new Quaternion().setFromUnitVectors(UP, dir),
		};
	}, []);

	return (
		<group position={position} quaternion={quaternion}>
			{/* Platform lying in the local tangent (x,z) plane; normal is local +Y (radial). */}
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[PLATFORM_RADIUS_M, 64]} />
				<meshStandardMaterial color="#6b6f73" />
			</mesh>
			{BOX_OFFSETS.map(([x, z], idx) => (
				<mesh key={idx} position={[x, 1, z]}>
					<boxGeometry args={[2, 2, 2]} />
					<meshStandardMaterial color="#c24b3a" />
				</mesh>
			))}
		</group>
	);
}
