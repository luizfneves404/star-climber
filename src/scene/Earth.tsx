import { useTexture } from "@react-three/drei";

const EARTH_RADIUS_METERS = 6_371_000;

export function Earth() {
	const texture = useTexture("/textures/earth_daymap.jpg");

	return (
		<mesh position={[0, -EARTH_RADIUS_METERS, 0]}>
			<sphereGeometry args={[EARTH_RADIUS_METERS, 64, 64]} />
			<meshStandardMaterial map={texture} />
		</mesh>
	);
}
