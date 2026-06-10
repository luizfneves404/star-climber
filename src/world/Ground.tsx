import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { GROUND_SIZE_M, groundAnchor, groundQuat } from "./everestSite";
import { FloatingGroup } from "./FloatingGroup";

/** One texture repeat covers this many meters of ground — ~2 cm/texel at 2k. */
const TEXTURE_TILE_M = 40;

const configure = (texture: Texture | Texture[]) => {
	for (const t of Array.isArray(texture) ? texture : [texture]) {
		t.wrapS = RepeatWrapping;
		t.wrapT = RepeatWrapping;
		t.repeat.setScalar(GROUND_SIZE_M / TEXTURE_TILE_M);
		t.anisotropy = 16;
		t.colorSpace = SRGBColorSpace;
	}
};

/** Flat sea-level ground plane tangent to Earth at Everest's lat/lon, with a tiling rock texture so altitude reads visually. */
export function Ground() {
	const texture = useTexture("/textures/rocky_trail_diff_2k.jpg", configure);
	return (
		<FloatingGroup absolute={groundAnchor}>
			<mesh quaternion={groundQuat}>
				<planeGeometry args={[GROUND_SIZE_M, GROUND_SIZE_M]} />
				<meshStandardMaterial map={texture} />
			</mesh>
		</FloatingGroup>
	);
}
