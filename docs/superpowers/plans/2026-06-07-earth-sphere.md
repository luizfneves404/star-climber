# Earth Sphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a true-scale, textured Earth sphere beneath the mountain, validating that a ~10km mountain and a ~12,742km planet render together — at any zoom level — without z-fighting or float-precision artifacts.

**Architecture:** A new `Earth` component (mirroring the existing `Mountain` component) renders a `SphereGeometry` of Earth's true radius, textured with a real daymap image via drei's `useTexture`, positioned so its surface meets the world origin. It's added alongside `<Mountain />` in `Scene.tsx`. No camera or physics changes.

**Tech Stack:** React 19, `@react-three/fiber`, `@react-three/drei` (`useTexture`), `three` (`SphereGeometry`, `MeshStandardMaterial`), TypeScript, Vite.

---

**Spec reference:** `docs/superpowers/specs/2026-06-07-earth-sphere-design.md`

**Note on testing:** Per `docs/PROJECT_NOTES.md`, this project has no automated test suite — `pnpm build`/`pnpm lint` are the available sanity checks, and visual work is verified manually in the browser. This plan follows that existing pattern (the same one used for the `Mountain` component): build/lint checks after each code change, plus a manual visual-verification task at the end.

## Task 1: Verify the texture asset is in place

**Files:**
- Check: `public/textures/earth_daymap.jpg`

- [ ] **Step 1: Confirm the texture file exists and is a valid image**

Run: `file public/textures/earth_daymap.jpg`
Expected output contains: `JPEG image data` and `2048x1024`

(This file was fetched from Wikimedia Commons — `Solarsystemscope_texture_8k_earth_daymap.jpg`, CC-BY 4.0 Solar System Scope — and committed alongside the design spec. This step just confirms it survived and is the expected asset before building on top of it.)

If the file is missing, fetch it with:
```bash
mkdir -p public/textures
curl -sL "https://commons.wikimedia.org/wiki/Special:FilePath/Solarsystemscope_texture_8k_earth_daymap.jpg" -o public/textures/earth_daymap.jpg
```

## Task 2: Create the Earth component

**Files:**
- Create: `src/scene/Earth.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useTexture } from "@react-three/drei";

const EARTH_RADIUS_METERS = 6_371_000;

export function Earth() {
	const texture = useTexture("/textures/earth_daymap.jpg");

	return (
		<mesh position={[0, -EARTH_RADIUS_METERS, 0]}>
			<sphereGeometry args={[EARTH_RADIUS_METERS, 64, 64]} />
			<meshStandardMaterial map={texture} />
		</mesh>
	);
}
```

This mirrors the structure of `src/scene/Mountain.tsx`: a constant for the
real-world dimension, a `<mesh>` positioned so the sphere's surface is tangent
to the world origin `(0,0,0)` (surface at `y = -EARTH_RADIUS_METERS + EARTH_RADIUS_METERS = 0`),
matching the planned scene layout in `docs/PROJECT_NOTES.md`.

- [ ] **Step 2: Run the build/typecheck to confirm it compiles**

Run: `pnpm build`
Expected: completes with no TypeScript errors (it will also produce a production bundle in `dist/` — that's fine, the existing repo already has a `dist/` directory from prior builds)

- [ ] **Step 3: Commit**

```bash
git add src/scene/Earth.tsx
git commit -m "feat: add true-scale textured Earth sphere component"
```

## Task 3: Wire the Earth into the scene

**Files:**
- Modify: `src/scene/Scene.tsx`

- [ ] **Step 1: Import and render `<Earth />` alongside `<Mountain />`**

In `src/scene/Scene.tsx`, add the import:

```tsx
import { Earth } from "./Earth";
```

next to the existing `import { Mountain } from "./Mountain";` line, and add
`<Earth />` inside the `<Canvas>`, alongside `<Mountain />`:

```tsx
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
```

No changes to `<OrbitControls>` or the `camera` prop — the existing `far: 5e7`
and unrestricted `OrbitControls` distance already allow zooming out far enough
to see the whole Earth (per the spec, this was confirmed before writing it).

- [ ] **Step 2: Run the build/typecheck to confirm it compiles**

Run: `pnpm build`
Expected: completes with no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/scene/Scene.tsx
git commit -m "feat: render Earth sphere in the scene alongside the mountain"
```

## Task 4: Manually verify rendering at scale

This is the actual validation this milestone exists to perform — it cannot be
automated, and must be done in a browser.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

Open the printed local URL (typically `http://localhost:5173`) in a browser.

- [ ] **Step 2: Verify the Earth appears correctly positioned and textured**

You should see the cone-shaped mountain sitting on top of a large textured
sphere (the Earth daymap — continents and oceans visible). The mountain's base
should appear to rest right at the sphere's surface, not floating above it or
clipping into it.

- [ ] **Step 3: Zoom and orbit across the full range, watching for artifacts**

Using the mouse (drag to orbit, scroll to zoom), do all of the following and
confirm there is **no z-fighting, flickering, or vertex swimming** at any point:

1. Zoom in close to the mountain (as close as `OrbitControls` allows)
2. Slowly zoom out while orbiting, watching the transition as the Earth's
   curvature becomes visible
3. Continue zooming out until the whole Earth sphere is visible in frame, with
   the mountain reduced to a tiny bump on its surface
4. Orbit fully around the Earth at that distance — confirm the sphere's
   surface (both lit and unlit/dark sides) renders cleanly with no shimmering

- [ ] **Step 4: Record the result**

If you observe any z-fighting, flickering, or swimming at any zoom level, stop
and report exactly what you saw and at what camera distance/angle — this would
indicate the true-scale + log-depth-buffer approach needs revisiting (see
"Core technical decision" in `docs/PROJECT_NOTES.md`) before any further
milestones build on it.

If everything renders cleanly across the full range, the milestone is
validated — no code changes needed as a result of this step.

## Task 5: Update the project notes

**Files:**
- Modify: `docs/PROJECT_NOTES.md`

- [ ] **Step 1: Add an entry describing what was built**

In the "What's been built so far" section of `docs/PROJECT_NOTES.md` (or a new
"Milestone 2" section if you've renamed/restructured that section by the time
you get here), add a short note describing:

- `src/scene/Earth.tsx` — textured `SphereGeometry`, true Earth radius
  (6,371,000m), positioned at `(0, -6371000, 0)` so its surface meets the
  mountain's base at the origin
- The texture asset at `public/textures/earth_daymap.jpg` (CC-BY 4.0,
  Solar System Scope, via Wikimedia Commons)
- The manual verification result from Task 4 (e.g., "Verified manually:
  orbiting and zooming continuously from the mountain's base out to a
  whole-Earth view shows no z-fighting/flickering/swimming — the true-scale +
  log-depth-buffer approach holds at planetary scale.")

Follow the style of the existing "Verified manually: ..." note for Milestone 1
later in that same file.

- [ ] **Step 2: Commit**

```bash
git add docs/PROJECT_NOTES.md
git commit -m "docs: record Earth sphere milestone completion"
```

## Self-Review Checklist (for whoever executes this plan)

- [ ] Spec coverage: Task 1 covers the texture asset, Task 2 covers the
      `Earth` component (geometry, position, material per spec), Task 3 covers
      scene wiring, Task 4 covers the manual verification the spec calls for,
      Task 5 covers documenting the result. No spec section is unaddressed.
- [ ] No physics collider was added to the Earth (matches spec's "Out of Scope").
- [ ] No camera/`OrbitControls` changes were made (matches spec).
