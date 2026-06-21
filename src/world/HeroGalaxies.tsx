// Renders every hero galaxy as a makeGalaxy() star cloud at its real position.
// v1: always-on, no distance swap — the additive points overlap into a fuzzy blob
// from far and resolve into individual stars as you fly in. Geometry + material are
// built once at module load (deterministic, a few ms each); the components stay dumb.
import { FloatingGroup } from "./FloatingGroup";
import { makeGalaxy } from "./galaxy";
import { HERO_GALAXIES, heroAnchor } from "./heroGalaxies";
import { makeStarPointsMaterial } from "./StarPoints";

const built = HERO_GALAXIES.map((g) => ({
	name: g.name,
	anchor: heroAnchor(g),
	geometry: makeGalaxy(g),
	material: makeStarPointsMaterial({ refDistM: g.radiusM, opacity: 1 }),
}));

export function HeroGalaxies() {
	return (
		<>
			{built.map((b) => (
				<FloatingGroup key={b.name} absolute={b.anchor}>
					<points geometry={b.geometry} material={b.material} />
				</FloatingGroup>
			))}
		</>
	);
}
