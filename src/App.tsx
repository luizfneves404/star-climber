import { Scene } from "./scene/Scene";
import { BodyPanel } from "./ui/BodyPanel";
import { Hud } from "./ui/Hud";
import { HudMarkers } from "./ui/HudMarkers";

function App() {
	return (
		<>
			<Scene />
			<Hud />
			<HudMarkers />
			<BodyPanel />
		</>
	);
}

export default App;
