import { useTexture } from "@react-three/drei";

/**
 * Earth as a textured sphere, centered at the tier origin. `radius` is given in
 * the tier's authored units (meters for the Earth tier, 1000-km units for Solar).
 */
export function EarthGlobe({ radius }: { radius: number }) {
	const texture = useTexture("/textures/earth_daymap.jpg");

	return (
		<mesh frustumCulled={false}>
			<sphereGeometry args={[radius, 64, 64]} />
			<meshStandardMaterial map={texture} />
		</mesh>
	);
}
