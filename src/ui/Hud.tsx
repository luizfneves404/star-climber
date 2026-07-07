import { usePlayerStore } from "../player/playerStore";
import { ACTIVE_WORLD } from "../world/activeWorld";
import { EARTH_RADIUS_M } from "../world/constants";
import { fmtDist, fmtSpeed } from "./format";
import { useHudStore } from "./hudStore";

export function Hud() {
	const distanceMeters = useHudStore((s) => s.distanceMeters);
	const speed = usePlayerStore((s) => s.speed);
	const altitude = Math.max(0, distanceMeters - EARTH_RADIUS_M);

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
			{ACTIVE_WORLD === "sizes" ? (
				<div>dist from origin: {fmtDist(distanceMeters)}</div>
			) : (
				<>
					<div>altitude: {fmtDist(altitude)}</div>
					<div>dist from center: {fmtDist(distanceMeters)}</div>
				</>
			)}
			<div>speed: {fmtSpeed(speed)}</div>
		</div>
	);
}
