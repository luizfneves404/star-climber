import { useFrame } from "@react-three/fiber";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { Group, Vector3 } from "three";
import { usePlayerStore } from "../player/playerStore";

interface FloatingGroupProps {
	/** Absolute position in Earth-centered meters (float64). */
	absolute: Vector3;
	children: ReactNode;
}

/**
 * Floating origin (camera-relative rendering). Renders its children at
 * `absolute − playerPosition`, recomputed every frame in JS (float64) and
 * assigned to the group's local position.
 *
 * THE load-bearing rule (docs/floating-origin-spike.md): the subtraction happens
 * here, in float64, BEFORE the small result reaches the float32 GPU matrices.
 * Near-camera objects come out at ~meters (precise); far objects come out huge
 * but sub-pixel, so their imprecision is invisible. Do NOT replace this with a
 * single large translation on a parent group — that bakes the huge offset into a
 * float32 matrix and destroys precision before the GPU ever subtracts.
 */
export function FloatingGroup({ absolute, children }: FloatingGroupProps) {
	const ref = useRef<Group>(null);

	useFrame(() => {
		const group = ref.current;
		if (!group) return;
		// In-place, allocation-free: render = absolute − origin (player position).
		group.position.subVectors(absolute, usePlayerStore.getState().position);
	});

	return <group ref={ref}>{children}</group>;
}
