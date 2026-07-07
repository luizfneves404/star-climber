// The real universe — everything Scene used to mount directly: Everest/solar
// content (Markers), the galaxy clouds + impostors, the solar neighborhood, and
// the deep field. The Sun sits along +X, so light the scene from there.
import { DeepField } from "../world/DeepField";
import { GalaxyClouds } from "../world/GalaxyClouds";
import { LocalStars } from "../world/LocalStars";
import { Markers } from "../world/Markers";

const SUN_DIR: [number, number, number] = [1, 0, 0];

export function UniverseWorld() {
	return (
		<>
			<ambientLight intensity={0.25} />
			<directionalLight position={SUN_DIR} intensity={1.4} />
			<Markers />
			<GalaxyClouds />
			<LocalStars />
			<DeepField />
		</>
	);
}
