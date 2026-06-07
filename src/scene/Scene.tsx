import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Earth } from "./Earth";
import { Mountain } from "./Mountain";

export function Scene() {
	return (
		<Canvas
			camera={{ position: [0, 6000, 30000], near: 0.1, far: 5e7, fov: 60 }}
			gl={{ logarithmicDepthBuffer: true }}
			style={{ width: "100vw", height: "100vh" }}
		>
			<ambientLight intensity={0.3} />
			<directionalLight position={[10000, 20000, 10000]} intensity={1.2} />
			<Mountain />
			<Earth />
			<OrbitControls target={[0, 3000, 0]} />
		</Canvas>
	);
}
