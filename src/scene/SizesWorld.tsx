// The sizes world (?world=sizes): renders the SIZE_ITEMS row — true-scale
// objects in increasing size, floating in black. Same engine as the universe
// (FloatingGroup + free-fly); only the content differs.
import { useTexture } from "@react-three/drei";
import { DoubleSide } from "three";
import { FloatingGroup } from "../world/FloatingGroup";
import { makeGalaxy } from "../world/galaxy";
import { BURJ_SECTIONS } from "../world/landmarksData";
import { makeStarPointsMaterial } from "../world/StarPoints";
import { SIZE_ITEMS, type SizeItem } from "../world/sizesGallery";

// Tapered sections stacked and centered on the item's y=0 midline.
const BURJ_LAYOUT = (() => {
	const total = BURJ_SECTIONS.reduce((sum, s) => sum + s.h, 0);
	let y = -total / 2;
	return BURJ_SECTIONS.map((sec) => {
		const cy = y + sec.h / 2;
		y += sec.h;
		return { sec, cy };
	});
})();

const galaxyItem = SIZE_ITEMS.find((i) => i.kind.type === "galaxy");
const galaxyGeometry = galaxyItem
	? makeGalaxy({
			type: "spiral",
			radiusM: galaxyItem.radiusM,
			particleCount: 60_000,
			palette: { core: "#fff3c8", edge: "#9bb8ff" },
			armCount: 4,
			seed: 1,
		})
	: null;
const galaxyMaterial = galaxyItem
	? makeStarPointsMaterial({ refDistM: galaxyItem.radiusM })
	: null;

function TexturedSphere({
	radiusM,
	url,
	unlit,
}: {
	radiusM: number;
	url: string;
	unlit?: boolean;
}) {
	const texture = useTexture(url);
	return (
		<mesh>
			<sphereGeometry args={[radiusM, 48, 48]} />
			{unlit ? (
				<meshBasicMaterial map={texture} />
			) : (
				<meshStandardMaterial map={texture} />
			)}
		</mesh>
	);
}

function ItemMesh({ item }: { item: SizeItem }) {
	const { kind } = item;
	switch (kind.type) {
		case "box":
			return (
				<mesh>
					<boxGeometry args={[kind.w, kind.h, kind.d]} />
					<meshStandardMaterial color={kind.color} />
				</mesh>
			);
		case "burj":
			return (
				<>
					{BURJ_LAYOUT.map(({ sec, cy }, i) => (
						<mesh key={i} position={[0, cy, 0]}>
							<boxGeometry args={[sec.w, sec.h, sec.d]} />
							<meshStandardMaterial color="#b8bcc4" />
						</mesh>
					))}
				</>
			);
		case "cone":
			return (
				<mesh>
					<coneGeometry args={[kind.baseR, kind.h, 48]} />
					<meshStandardMaterial color={kind.color} />
				</mesh>
			);
		case "sphere":
			return (
				<mesh>
					<sphereGeometry args={[item.radiusM, 48, 48]} />
					{kind.unlit ? (
						<meshBasicMaterial color={kind.color} />
					) : (
						<meshStandardMaterial color={kind.color} />
					)}
				</mesh>
			);
		case "texturedSphere":
			return (
				<TexturedSphere
					radiusM={item.radiusM}
					url={kind.url}
					unlit={kind.unlit}
				/>
			);
		case "orbitRing":
			// Flat annulus in the XZ plane — the orbit itself is the object.
			return (
				<mesh rotation={[-Math.PI / 2, 0, 0]}>
					<ringGeometry args={[item.radiusM * 0.97, item.radiusM, 128]} />
					<meshBasicMaterial color={kind.color} side={DoubleSide} />
				</mesh>
			);
		case "galaxy":
			return galaxyGeometry && galaxyMaterial ? (
				<points geometry={galaxyGeometry} material={galaxyMaterial} />
			) : null;
	}
}

export function SizesWorld() {
	return (
		<>
			<ambientLight intensity={0.5} />
			<directionalLight position={[0.5, 1, 0.7]} intensity={1.2} />
			{SIZE_ITEMS.map((item) => (
				<FloatingGroup key={item.id} absolute={item.position}>
					<ItemMesh item={item} />
				</FloatingGroup>
			))}
		</>
	);
}
