# `dom-swarm` Engineering Roadmap & Task Tracker

`dom-swarm` is a zero-dependency, universal visual engine in TypeScript that reverse-engineers any webpage's DOM and simulates autonomous AI cursors constructing the UI in real time, with Reynolds Boids flocking physics when idle.

---

## Phase 1: Project Scaffolding & Build Pipeline
- [x] Configure `package.json` with ESM (`import`), CommonJS (`require`), and IIFE browser bundle declarations.
- [x] Set up strict `tsconfig.json` (ES2020 target, strict null checks, no unused locals/parameters, declaration map).
- [x] Configure `tsup.config.ts` for dual ESM/CJS outputs + standalone browser-ready IIFE (`DomSwarm` window global) with minification and `.d.ts` generation.
- [x] Establish zero-dependency architecture ensuring zero external runtime packages.
- [x] Set up project directory structure (`src/`, `core/`, `dom/`, `utils/`, `demo/`).

---

## Phase 2: Shadow DOM Overlay & Visual Primitives
- [x] Implement `OverlayManager.ts` to attach an open Shadow DOM root on `dom-swarm-overlay` with `position: fixed; inset: 0; pointer-events: none; z-index: 2147483647`.
- [x] Inject strictly scoped styles in Shadow DOM to prevent any host CSS bleeding or selector collisions.
- [x] Design crisp SVG cursor assets:
  - [x] Colored Pointer arrow cursor with white stroke and subtle drop shadow.
  - [x] Colored I-beam text cursor with centered stem and crossbars.
- [x] Design Figma-style Blue Selection Bounding Box (`#0d99ff` border, corner resize handles, translucent fill).
- [x] Design Red Wireframe Alignment Box (`#f24822` border, full-screen horizontal/vertical guide lines `1px solid rgba(242, 72, 34, 0.45)`).
- [x] Implement Dimension Badge (`{width} × {height}` in px) and Red Distance Badge (`{distance}px`).
- [x] Add hardware-accelerated transforms (`translate3d(x, y, 0) rotate(deg)`) with `will-change: transform`.

---

## Phase 3: 2D Vector Math & Boids Flocking Engine
- [x] Implement `src/utils/math.ts`:
  - [x] Vector arithmetic: `add`, `sub`, `mult`, `div`, `mag`, `normalize`, `setMag`, `limit`, `heading`.
  - [x] Distance metrics: `dist`, `distSq`.
  - [x] Interpolation & clamping: `lerp`, `clamp`, `randomRange`.
- [x] Implement Reynolds Boids flocking algorithms in `BoidsPhysics.ts`:
  - [x] **Separation:** Avoid crowding local flockmates with inverse-distance force.
  - [x] **Alignment:** Steer towards the average heading/velocity of neighbors.
  - [x] **Cohesion:** Steer toward the center of mass of neighbors.
  - [x] **Viewport Boundary Repulsion:** Soft boundary avoidance steering agents away from viewport edges.
  - [x] **Cursor Attraction / Orbiting:** Spring attraction towards the live cursor or touch coordinates.
- [x] Implement `Agent.ts` state machine:
  - [x] `IDLE_FLOCKING`: Running standard Boids physics around cursor.
  - [x] `MOVING_TO_TARGET`: Steering directly towards assigned DOM element target coordinates.
  - [x] `CONSTRUCTING_ELEMENT`: Holding position, typing or scaling element into view.
  - [x] `RETURNING_TO_SWARM`: Smooth transition back to flocking after construction completes.
- [x] High-precision 60fps delta-time `requestAnimationFrame` loop in `SwarmEngine.ts`.

---

## Phase 4: DOM Reverse-Engineering & Live Construction
- [x] Implement `DomScanner.ts`:
  - [x] Scan host DOM with configurable selector list (defaults: `'h1, h2, h3, h4, p, button, a, img, pre, code, .swarm-item'`).
  - [x] Exclude hidden elements (`display: none`, `visibility: hidden`), elements `< 10px`, and elements above the fold if specified.
  - [x] Non-destructively set `opacity: 0` on unbuilt elements below the fold.
  - [x] Setup `IntersectionObserver` to trigger construction as elements enter viewport.
  - [x] Setup debounced `MutationObserver` on `document.body` for React/Next.js/Vue SPA dynamic route/component updates.
  - [x] Implement scroll-locked bounding box tracking via lightweight scroll/resize sync loop.
- [x] Implement `BuilderEffects.ts`:
  - [x] High-speed typewriter reveal for text nodes with morphing I-beam agent cursor.
  - [x] Smooth scale/opacity reveal animation for block, image, and interactive elements.
  - [x] Element style backup and failsafe restoration to guarantee zero damage to host DOM.

---

## Phase 5: Public API, Framework Wrappers & Documentation
- [x] Implement `src/types.ts` containing all configuration options, agent states, and interface definitions.
- [x] Implement `src/index.ts` with public entry points:
  - [x] `enableSwarm(config?: SwarmConfig): DomSwarmInstance`
  - [x] `class DomSwarm` with `.destroy()`, `.pause()`, `.resume()`, `.buildElement(el)`
  - [x] SSR guards (`typeof window !== 'undefined'`) to ensure crash-free execution in Next.js / Nuxt / SvelteKit.
- [x] Build interactive showcase testbed page `demo/index.html`:
  - [x] Realistic multi-section landing page (hero, cards, code preview, accordion, testimonials).
  - [x] Interactive live control panel (agent count, color themes, guide toggles, typewriter toggles, manual build trigger).
  - [x] Live telemetry HUD (active agents, current FPS, state counts).
- [x] Author exhaustive `ARCHITECTURE.md` with system diagrams, lifecycle models, and performance considerations.
- [x] Author complete `README.md` with npm badges, quick start, framework guides (React, Next.js, Vue), and full API reference table.
