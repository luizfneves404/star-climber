// Which world this page is running: the real universe (default) or the
// size-comparison gallery (?world=sizes). Read ONCE at module load — switching
// worlds is a page reload, which resets all player/HUD state for free. This is
// the entire world-selection mechanism on purpose: no registry, no router.
export type WorldId = "universe" | "sizes";

export const ACTIVE_WORLD: WorldId =
	new URLSearchParams(window.location.search).get("world") === "sizes"
		? "sizes"
		: "universe";
