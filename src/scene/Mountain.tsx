const EVEREST_HEIGHT_METERS = 8849;
const BASE_RADIUS_METERS = 10000;

export function Mountain() {
	return (
		<mesh position={[0, EVEREST_HEIGHT_METERS / 2, 0]}>
			<coneGeometry args={[BASE_RADIUS_METERS, EVEREST_HEIGHT_METERS, 32]} />
			<meshStandardMaterial color="#8a8378" />
		</mesh>
	);
}
