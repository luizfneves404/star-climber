// Data + layout for the sizes world (?world=sizes): true-scale objects lined up
// along +X in order of size, floating in black — nothing is at its real place,
// the row IS the point. Each object sits 3 of its own radii past the previous
// one's edge, so every jump is comfortable at free-fly speeds. Kept as a .ts
// data module (SizesWorld.tsx renders it) for react-refresh/only-export-components.
import { Vector3 } from "three";
import type { Body } from "./bodies";
import {
	EARTH_RADIUS_M,
	MOON_RADIUS_M,
	PARSEC_M,
	SUN_RADIUS_M,
} from "./constants";

export type SizeItemKind =
	| { type: "box"; w: number; h: number; d: number; color: string }
	| { type: "burj" }
	| { type: "cone"; baseR: number; h: number; color: string }
	| { type: "sphere"; color: string; unlit?: boolean }
	| { type: "texturedSphere"; url: string; unlit?: boolean }
	| { type: "orbitRing"; color: string }
	| { type: "galaxy" };

export interface SizeItem {
	/** Stable lowercase id (BodyPanel / fly-to / __debug key). */
	id: string;
	name: string;
	/** Half max extent, meters — drives layout spacing and fly-to framing. */
	radiusM: number;
	kind: SizeItemKind;
	/** Center position, filled in by the layout pass (all on the +X axis, y=z=0). */
	position: Vector3;
}

const DEFS: Omit<SizeItem, "position">[] = [
	{
		id: "human",
		name: "Human",
		radiusM: 0.9,
		kind: { type: "box", w: 0.6, h: 1.8, d: 0.25, color: "#e8c89a" },
	},
	{
		id: "bus",
		name: "Double-decker bus",
		radiusM: 6.75,
		kind: { type: "box", w: 13.5, h: 4.4, d: 2.55, color: "#cc2200" },
	},
	{
		id: "blue-whale",
		name: "Blue whale",
		radiusM: 15,
		kind: { type: "box", w: 30, h: 4.0, d: 7.0, color: "#3a6080" },
	},
	{
		id: "burj-khalifa",
		name: "Burj Khalifa",
		radiusM: 414,
		kind: { type: "burj" },
	},
	{
		id: "everest",
		name: "Everest (stand-in)",
		radiusM: 8849 / 2,
		kind: { type: "cone", baseR: 10_000, h: 8849, color: "#8b8f96" },
	},
	{
		id: "moon",
		name: "Moon",
		radiusM: MOON_RADIUS_M,
		kind: { type: "texturedSphere", url: "/textures/8k_moon.jpg" },
	},
	{
		id: "earth",
		name: "Earth",
		radiusM: EARTH_RADIUS_M,
		kind: { type: "texturedSphere", url: "/textures/earth_daymap.jpg" },
	},
	{
		id: "jupiter",
		name: "Jupiter",
		radiusM: 6.99e7,
		kind: { type: "sphere", color: "#c9a06b" },
	},
	{
		id: "sun",
		name: "Sun",
		radiusM: SUN_RADIUS_M,
		kind: { type: "texturedSphere", url: "/textures/8k_sun.jpg", unlit: true },
	},
	{
		id: "betelgeuse",
		name: "Betelgeuse",
		radiusM: 6.2e11,
		kind: { type: "sphere", color: "#ff8a4d", unlit: true },
	},
	{
		id: "neptune-orbit",
		name: "Neptune's orbit",
		radiusM: 4.5e12,
		kind: { type: "orbitRing", color: "#7fb2ff" },
	},
	{
		id: "milky-way",
		name: "Milky Way",
		radiusM: 15000 * PARSEC_M,
		kind: { type: "galaxy" },
	},
];

// Layout: x₀ = 0, x_{i+1} = x_i + 4·(r_i + r_{i+1}) — each object 3 of its own
// radii past the previous one's edge. Max x ≈ a few ×1e21 m: float64 absolute
// positions, floating origin unchanged.
export const SIZE_ITEMS: SizeItem[] = DEFS.map((def) => ({
	...def,
	position: new Vector3(),
}));
for (let i = 1; i < SIZE_ITEMS.length; i++) {
	SIZE_ITEMS[i].position.x =
		SIZE_ITEMS[i - 1].position.x +
		4 * (SIZE_ITEMS[i - 1].radiusM + SIZE_ITEMS[i].radiusM);
}

export const SIZES_BODIES: Body[] = SIZE_ITEMS.map((item) => ({
	id: item.id,
	name: item.name,
	position: item.position,
	radius: item.radiusM,
}));

/** Start beside the human, looking diagonally down the row: human at left,
 * bus/whale center, Everest cone and Moon stacking up behind. */
export const SIZES_START = {
	position: new Vector3(-5, 1.0, 10),
	lookAt: new Vector3(25, 0, -1),
};
