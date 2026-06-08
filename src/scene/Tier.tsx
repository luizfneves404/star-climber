import { useFrame } from "@react-three/fiber";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Group, Material, Mesh } from "three";
import { canonScale } from "../scale/constants";
import type { TierId } from "../scale/store";
import { useScaleStore } from "../scale/store";

interface TierProps {
	id: TierId;
	/** 1 unit in this tier's authored coordinates equals this many meters. */
	metersPerUnit: number;
	children: ReactNode;
}

/**
 * Wraps a tier's content. Scales it into canonical space (Earth radius = 1) and
 * cross-fades its opacity around the seam so the active tier hands off smoothly.
 *
 * The `canonScale` normalization and the shared-Earth-at-the-seam rule are
 * load-bearing invariants — see docs/tier-system.md (#2, #3) before changing this.
 */
export function Tier({ id, metersPerUnit, children }: TierProps) {
	const ref = useRef<Group>(null);
	const scale = canonScale(metersPerUnit);

	useFrame(() => {
		const group = ref.current;
		if (!group) return;
		const t = useScaleStore.getState().transition;
		const opacity = id === "earth" ? 1 - t : t;
		const visible = opacity > 0.001;
		group.visible = visible;
		if (!visible) return;
		group.traverse((obj) => {
			const material = (obj as Mesh).material as Material | undefined;
			if (material && "opacity" in material) {
				material.transparent = opacity < 0.999;
				material.depthWrite = opacity > 0.5;
				material.opacity = opacity;
			}
		});
	});

	return (
		<group ref={ref} scale={scale}>
			{children}
		</group>
	);
}
