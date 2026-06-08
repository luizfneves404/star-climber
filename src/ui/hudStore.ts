import { create } from "zustand";

// Per-frame readouts for the HUD. PlayerRig is the single writer; the player's
// `position` is mutated in place (no re-render), so the rig copies the derived
// scalar here to drive the overlay.
interface HudState {
	/** Distance from Earth's center, meters. */
	distanceMeters: number;
	update: (distanceMeters: number) => void;
}

export const useHudStore = create<HudState>((set) => ({
	distanceMeters: 0,
	update: (distanceMeters) => set({ distanceMeters }),
}));
