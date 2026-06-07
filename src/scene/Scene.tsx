import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Mountain } from "./Mountain";

export function Scene() {
	return (
		<Canvas
			camera={{ position: [0, 200, 600], near: 0.1, far: 5e7, fov: 60 }}
			gl={{ logarithmicDepthBuffer: true }}
			style={{ width: "100vw", height: "100vh" }}
		>
			<ambientLight intensity={0.3} />
			<directionalLight position={[10000, 20000, 10000]} intensity={1.2} />
			<Mountain />
			<OrbitControls target={[0, 500, 0]} />
		</Canvas>
	);
}
