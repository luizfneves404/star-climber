import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "./playerStore";

const SPEED_STEP = 1.4; // multiplicative per wheel notch
const LOOK_SENSITIVITY = 0.0022; // radians per pixel of mouse movement

export interface FreeFlyControls {
	/** Whether a key code (e.g. "KeyW", "Space") is currently held. */
	isDown: (code: string) => boolean;
	/**
	 * Returns the mouse-look delta (radians) accumulated since the last call and
	 * resets it. Lets PlayerRig consume input without mutating hook-owned state.
	 */
	consumeLook: () => { yaw: number; pitch: number };
}

/**
 * Wires pointer-lock mouse-look, movement keys, and scroll-wheel speed control to
 * the given canvas element. Returns a stable controls object whose methods read
 * the live input when called (in PlayerRig's frame loop). All mutable input state
 * stays inside this hook's ref and is never touched during render.
 */
export function useFreeFlyControls(
	domElement: HTMLElement | null,
): FreeFlyControls {
	const state = useRef({ keys: new Set<string>(), yaw: 0, pitch: 0 });

	// Created once; methods close over the ref and read it only when invoked.
	const [api] = useState<FreeFlyControls>(() => ({
		isDown: (code) => state.current.keys.has(code),
		consumeLook: () => {
			const s = state.current;
			const delta = { yaw: s.yaw, pitch: s.pitch };
			s.yaw = 0;
			s.pitch = 0;
			return delta;
		},
	}));

	useEffect(() => {
		if (!domElement) return;
		const s = state.current;

		const onKeyDown = (e: KeyboardEvent) => s.keys.add(e.code);
		const onKeyUp = (e: KeyboardEvent) => s.keys.delete(e.code);
		const onBlur = () => s.keys.clear();
		const onClick = () => domElement.requestPointerLock();
		const onMouseMove = (e: MouseEvent) => {
			if (document.pointerLockElement !== domElement) return;
			s.yaw -= e.movementX * LOOK_SENSITIVITY;
			s.pitch -= e.movementY * LOOK_SENSITIVITY;
		};
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			usePlayerStore
				.getState()
				.stepSpeed(e.deltaY < 0 ? SPEED_STEP : 1 / SPEED_STEP);
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);
		window.addEventListener("mousemove", onMouseMove);
		domElement.addEventListener("click", onClick);
		domElement.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("mousemove", onMouseMove);
			domElement.removeEventListener("click", onClick);
			domElement.removeEventListener("wheel", onWheel);
		};
	}, [domElement]);

	return api;
}
