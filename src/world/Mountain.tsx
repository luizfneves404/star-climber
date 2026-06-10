import { useEffect, useState } from "react";
import type { BufferGeometry } from "three";
import { groundAnchor, surfaceQuat } from "./everestSite";
import { loadEverestTerrainGeometry } from "./everestTerrain";
import { FloatingGroup } from "./FloatingGroup";

/**
 * True-scale Everest from Copernicus GLO-30 data, diorama style: a 30 km
 * displaced grid anchored at the sea-level ground anchor, summit at true
 * 8,849 m, borders feathered into the flat ground plane. Renders nothing
 * until the heightmap fetch resolves (~526 KB). Mounts once for the app's
 * lifetime, so the geometry is never disposed.
 */
export function Mountain() {
	const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
	useEffect(() => {
		let cancelled = false;
		loadEverestTerrainGeometry()
			.then((g) => {
				if (!cancelled) setGeometry(g);
			})
			.catch((err: unknown) => {
				console.error("Everest terrain load failed", err);
			});
		return () => {
			cancelled = true;
		};
	}, []);
	if (!geometry) return null;
	return (
		<FloatingGroup absolute={groundAnchor}>
			<mesh quaternion={surfaceQuat} geometry={geometry}>
				<meshStandardMaterial vertexColors />
			</mesh>
		</FloatingGroup>
	);
}
