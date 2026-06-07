import { usePlayerStore } from "../player/playerStore";
import { EARTH_RADIUS_M } from "../scale/constants";
import { useScaleStore } from "../scale/store";

const fmtKm = (m: number) => {
	const km = m / 1000;
	if (km >= 1e6) return `${(km / 1e6).toFixed(2)}M km`;
	if (km >= 1)
		return `${km.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
	return `${m.toFixed(0)} m`;
};

const fmtSpeed = (mps: number) => {
	if (mps >= 1000)
		return `${(mps / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km/s`;
	return `${mps.toFixed(1)} m/s`;
};

export function Hud() {
	const tier = useScaleStore((s) => s.tier);
	const transition = useScaleStore((s) => s.transition);
	const distanceMeters = useScaleStore((s) => s.distanceMeters);
	const metersPerPixel = useScaleStore((s) => s.metersPerPixel);
	const speed = usePlayerStore((s) => s.speed);

	const altitude = Math.max(0, distanceMeters - EARTH_RADIUS_M);
	const fading = transition > 0.001 && transition < 0.999;

	return (
		<div
			style={{
				position: "fixed",
				top: 12,
				left: 12,
				padding: "10px 14px",
				font: "13px/1.5 ui-monospace, monospace",
				color: "#e8e8e8",
				background: "rgba(0,0,0,0.55)",
				borderRadius: 8,
				pointerEvents: "none",
				letterSpacing: 0.3,
			}}
		>
			<div>
				TIER: <b>{tier === "earth" ? "Earth" : "Solar System"}</b>
				{fading ? `  (handoff ${(transition * 100).toFixed(0)}%)` : ""}
			</div>
			<div>altitude: {fmtKm(altitude)}</div>
			<div>1 px ≈ {fmtKm(metersPerPixel)}</div>
			<div>speed: {fmtSpeed(speed)}</div>
		</div>
	);
}
