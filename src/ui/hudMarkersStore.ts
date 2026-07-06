import { create } from "zustand";

// Per-frame screen-projection of the notable bodies, plus which bodies have
// their on-screen label enabled (opt-in via the side panel). HudProjector is
// the single writer of `markers`; it runs inside the canvas each frame (same
// one-set-per-frame pattern hudStore uses). HudMarkers + BodyPanel read it.

export interface BodyMarker {
	id: string;
	name: string;
	/** Live distance from the player, meters. */
	distanceM: number;
	/** Screen position in CSS pixels (valid only when `onScreen`). */
	x: number;
	y: number;
	/** True when the body is in front of the camera and within the viewport. */
	onScreen: boolean;
}

interface HudMarkersState {
	markers: BodyMarker[];
	setMarkers: (markers: BodyMarker[]) => void;
	/** Ids of bodies whose on-screen label is shown (default: none). */
	enabled: Set<string>;
	toggle: (id: string) => void;
}

export const useHudMarkersStore = create<HudMarkersState>((set) => ({
	markers: [],
	setMarkers: (markers) => set({ markers }),
	enabled: new Set<string>(),
	toggle: (id) =>
		set((s) => {
			const enabled = new Set(s.enabled);
			if (enabled.has(id)) enabled.delete(id);
			else enabled.add(id);
			return { enabled };
		}),
}));
