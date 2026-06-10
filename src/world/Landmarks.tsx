// Size-comparison exhibit on the flat ground beside the Everest terrain patch.
// All objects share one FloatingGroup whose inner group is rotated by surfaceQuat,
// so children use surface-aligned local coordinates:
//   local +X  → east (tangent)
//   local +Y  → up (radial)
//   local +Z  → binormal
// Every box center is at [eastOffset, height/2, 0], placing its base at ground level.
import { surfaceQuat } from "./everestSite";
import { FloatingGroup } from "./FloatingGroup";
import { LANDMARKS_EXHIBIT_ORIGIN, LAYOUT } from "./landmarksData";

/**
 * Size-comparison exhibit: a row of true-scale objects on the flat sea-level
 * ground, anchored at LANDMARKS_EXHIBIT_ORIGIN and spreading east.
 */
export function Landmarks() {
	return (
		<FloatingGroup absolute={LANDMARKS_EXHIBIT_ORIGIN}>
			{/*
			 * surfaceQuat rotates the local frame so +Y = radial up, +X = east.
			 * Child positions are [eastOffset, height/2, northOffset].
			 */}
			<group quaternion={surfaceQuat}>
				{LAYOUT.landmarks.map(({ lm, position, args }) => (
					<mesh key={lm.label} position={position}>
						<boxGeometry args={args} />
						<meshStandardMaterial color={lm.color} />
					</mesh>
				))}

				{/* Burj Khalifa — stacked sections of decreasing footprint */}
				{LAYOUT.burj.map(({ position, args }, i) => (
					<mesh key={i} position={position}>
						<boxGeometry args={args} />
						<meshStandardMaterial color="#c8c0b8" />
					</mesh>
				))}
			</group>
		</FloatingGroup>
	);
}
