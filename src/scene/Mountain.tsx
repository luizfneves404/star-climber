import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import {
	EARTH_RADIUS_M,
	EVEREST_HEIGHT_M,
	EVEREST_LAT,
	EVEREST_LON,
	latLonToUnitVector,
	MOUNTAIN_BASE_M,
} from "../scale/constants";

const UP = new Vector3(0, 1, 0);

/** Everest-scale cone standing radially at its real lat/lon (Earth tier, meters). */
export function Mountain() {
	const { position, quaternion } = useMemo(() => {
		const dir = new Vector3(...latLonToUnitVector(EVEREST_LAT, EVEREST_LON));
		return {
			position: dir
				.clone()
				.multiplyScalar(EARTH_RADIUS_M + EVEREST_HEIGHT_M / 2),
			quaternion: new Quaternion().setFromUnitVectors(UP, dir),
		};
	}, []);

	return (
		<mesh position={position} quaternion={quaternion}>
			<coneGeometry args={[MOUNTAIN_BASE_M, EVEREST_HEIGHT_M, 128]} />
			<meshStandardMaterial color="#8a8378" />
		</mesh>
	);
}
