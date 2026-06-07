import { create } from "zustand";
import {
	dcToMeters,
	EARTH_RADIUS_M,
	FADE_HI_DC,
	FADE_LO_DC,
	SEAM_DC,
	smoothstep,
} from "./constants";

export type TierId = "earth" | "solar";

interface ScaleState {
	/** Camera distance from Earth center, in canonical units (Earth radius = 1). */
	dc: number;
	/** Dominant tier at the current distance. */
	tier: TierId;
	/** 0 = fully Earth tier, 1 = fully Solar tier (cross-fade value). */
	transition: number;
	/** Real distance from Earth center, meters. */
	distanceMeters: number;
	/** Real meters covered by one screen pixel at the focus point. */
	metersPerPixel: number;
	/** Called every frame by PlayerRig with the live camera distance. */
	update: (dc: number, metersPerPixel: number) => void;
}

export const useScaleStore = create<ScaleState>((set) => ({
	dc: 2,
	tier: "earth",
	transition: 0,
	distanceMeters: 2 * EARTH_RADIUS_M,
	metersPerPixel: 0,
	update: (dc, metersPerPixel) =>
		set({
			dc,
			tier: dc < SEAM_DC ? "earth" : "solar",
			transition: smoothstep(FADE_LO_DC, FADE_HI_DC, dc),
			distanceMeters: dcToMeters(dc),
			metersPerPixel,
		}),
}));
