# True-Scale Everest Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Vite/React starter screen with a true-scale (meters) R3F scene showing a placeholder Everest-height cone, viewable with an orbit camera, to validate that a single true-scale coordinate space + logarithmic depth buffer renders cleanly from both close range and far away.

**Architecture:** A new `<Scene>` component owns the `<Canvas>` (with `logarithmicDepthBuffer: true` and a wide near/far range), and renders a `<Mountain>` component (a `ConeGeometry` sized to Everest's true height of 8849m) plus lighting and `drei`'s `<OrbitControls>`. `App.tsx` is simplified to just render `<Scene>`.

**Tech Stack:** React 19, `@react-three/fiber`, `@react-three/drei`, `three`, Vite, TypeScript

---

## File Structure

- Create: `src/scene/Mountain.tsx` — the placeholder cone mesh, true-scale, sitting with its base at world origin
- Create: `src/scene/Scene.tsx` — the `<Canvas>`, lighting, `<OrbitControls>`, and `<Mountain>`
- Modify: `src/App.tsx` — replace the starter markup with `<Scene />`
- Modify: `package.json` — add `@react-three/fiber`, `@react-three/drei`, `three`, `@types/three`

There are no automated tests in this milestone — per the spec, this is a visual scaffold and verification is manual (run the dev server, look at the result). Each task below ends with a concrete visual check to run yourself in the browser.

---

### Task 1: Install Three.js and React Three Fiber dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the libraries**

Run:
```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

- [ ] **Step 2: Verify the install**

Run: `pnpm list three @react-three/fiber @react-three/drei`
Expected: all three packages listed with resolved version numbers (no "not found" errors).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add three, @react-three/fiber, @react-three/drei"
```

---

### Task 2: Build the placeholder Mountain component

**Files:**
- Create: `src/scene/Mountain.tsx`

- [ ] **Step 1: Write the component**

Everest's true height is 8849m. We model it as a cone with a base radius of
10000m, positioned so the base circle sits at y=0 (a `ConeGeometry`'s origin is
at its vertical center, so we lift it by half its height).

```tsx
const EVEREST_HEIGHT_METERS = 8849
const BASE_RADIUS_METERS = 10000

export function Mountain() {
  return (
    <mesh position={[0, EVEREST_HEIGHT_METERS / 2, 0]}>
      <coneGeometry args={[BASE_RADIUS_METERS, EVEREST_HEIGHT_METERS, 32]} />
      <meshStandardMaterial color="#8a8378" />
    </mesh>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scene/Mountain.tsx
git commit -m "feat: add placeholder true-scale Everest cone"
```

---

### Task 3: Build the Scene component with Canvas, lighting, and orbit controls

**Files:**
- Create: `src/scene/Scene.tsx`

- [ ] **Step 1: Write the component**

The camera starts a few hundred meters from the mountain's base, looking toward
a target partway up the slope (`[0, 500, 0]`). `near`/`far` span from 0.1m to
5e7m (50,000km) so both the close-up mountain and a far pulled-back view stay in
range, and `logarithmicDepthBuffer: true` prevents z-fighting across that span.

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Mountain } from './Mountain'

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 200, 600], near: 0.1, far: 5e7, fov: 60 }}
      gl={{ logarithmicDepthBuffer: true }}
      style={{ width: '100vw', height: '100vh' }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[10000, 20000, 10000]} intensity={1.2} />
      <Mountain />
      <OrbitControls target={[0, 500, 0]} />
    </Canvas>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/scene/Scene.tsx
git commit -m "feat: add Scene with logarithmic-depth canvas and orbit controls"
```

---

### Task 4: Wire Scene into App and remove the starter screen

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the starter markup**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { Scene } from './scene/Scene'

function App() {
  return <Scene />
}

export default App
```

- [ ] **Step 2: Run the dev server**

Run: `pnpm dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173/`) with no
compile errors.

- [ ] **Step 3: Visually verify in the browser**

Open the printed URL. Confirm:
- A grey cone-shaped mountain is visible, lit from one side
- Dragging the mouse orbits the camera around the mountain; scrolling zooms in and out
- Zooming in close to the base shows crisp geometry with no flickering
- Zooming far out (so the mountain shrinks to a small shape) shows no z-fighting, flickering, or texture swimming

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: render true-scale Everest scene as the app's main view"
```

---

## Done Criteria

Running `pnpm dev` and opening the app shows the placeholder Everest cone at
true scale (8849m), lit and orbitable, rendering cleanly with no precision
artifacts at any zoom level — confirming the true-scale + logarithmic-depth-buffer
approach is sound before building the Earth sphere, physics, or character in
later milestones.
