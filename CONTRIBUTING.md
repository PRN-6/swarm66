# Contributing to @leozodiac/swarm66 ⚡

Thank you for your interest in contributing to **`@leozodiac/swarm66`**! 

`swarm66` is an open-source, zero-dependency visual engine designed to reverse-engineer any webpage's DOM on the fly and construct it live with autonomous Figma-style AI cursors. Whether you are fixing a bug, adding new physics behaviors, optimizing animation frames, or writing documentation, all contributions are warmly welcomed!

---

## 🧭 Core Principles

Before opening a pull request, please keep our core architectural rules in mind:

1. **Zero Runtime Dependencies:**
   `@leozodiac/swarm66` must remain 100% dependency-free at runtime. All math, Boids physics, DOM scanning, typewriter effects, and overlay managers are implemented in native TypeScript/JavaScript. Keep the minified bundle under ~55 KB.
2. **Non-Destructive DOM Operations:**
   Never mutate React Fiber text nodes, Vue component trees, or hydration states. Visual reveals must use hardware-accelerated CSS properties (`clipPath`, `transform`, `opacity`) rather than mutating `textContent` or removing DOM elements.
3. **Shadow DOM Isolation:**
   All cursor elements, dimension badges, bounding boxes, and alignment guides must be rendered inside a single isolated Shadow Root (`#dom-swarm-overlay`) to prevent CSS leakage to/from the host webpage.
4. **Universal Framework Compatibility:**
   `swarm66` must run cleanly across React, Next.js, Vue, Nuxt, Svelte, Angular, Astro, and Vanilla HTML/PHP/WordPress without crashing on Server-Side Rendering (SSR).

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### 2. Fork and Clone
```bash
git clone https://github.com/PRN-6/swarm66.git
cd swarm66
npm install
```

### 3. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts `tsup` in watch mode; re-compiles `dist/` on every save |
| `npm run build` | Builds production bundles (ESM, CJS, IIFE, and TypeScript types) |
| `npm run typecheck` | Runs `tsc --noEmit` to verify strict TypeScript types |
| `npm test` | Runs the Vitest test suite once |
| `npm run test:watch` | Runs Vitest in interactive watch mode during development |
| `npm run demo` | Builds the package and boots the local multi-demo server on port 3000 |
| `npm run clean` | Deletes the `dist/` folder |

---

## 🧪 Testing Demos Locally

We provide 5 diverse testbeds in the repository to verify behavior against different website designs:

```bash
npm run demo
```

Once running, navigate to:
- **Playground (Interactive Controls):** [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **SaaS Landing Page:** [http://localhost:3000/demo/index.html](http://localhost:3000/demo/index.html)
- **E-Commerce Store:** [http://localhost:3000/demo1/index.html](http://localhost:3000/demo1/index.html)
- **Developer Documentation:** [http://localhost:3000/demo2/index.html](http://localhost:3000/demo2/index.html)
- **Creative Portfolio:** [http://localhost:3000/demo3/index.html](http://localhost:3000/demo3/index.html)

---

## 📁 Codebase Architecture

```
swarm66/
├── src/
│   ├── core/
│   │   ├── SwarmEngine.ts    # Main animation loop, task scheduler, and state machine
│   │   ├── Agent.ts          # Physics, velocity, tool icons (pointer, pen, hand), borders
│   │   └── BoidsPhysics.ts   # Flocking vectors (separation, cohesion, alignment, mouse)
│   ├── dom/
│   │   ├── DomScanner.ts     # Tree traversal, element eligibility, build order sorting
│   │   ├── OverlayManager.ts # Shadow DOM host, bounding boxes, guides, dimensions
│   │   └── BuilderEffects.ts # Progressive typewriter reveal, clipPath, scale/fade
│   ├── utils/
│   │   └── math.ts           # 2D Vector math, lerp, clamp, random helpers
│   ├── types.ts              # TypeScript interfaces and configuration options
│   └── index.ts              # Universal public API and window global exports
├── tests/                    # Vitest unit test suites
└── scripts/
    └── serve.js              # Standalone local HTTP static demo server
```

---

## 🔄 Pull Request Workflow

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make Your Changes:**
   - Adhere to existing code formatting and naming conventions.
   - Ensure all new public methods or options are documented with JSDoc comments.

3. **Verify Tests and Types:**
   Before committing, verify that your changes introduce 0 type errors and pass all tests:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

4. **Commit with Conventional Messages:**
   Use clear, conventional commit messages:
   - `feat: add custom cursor trail effect`
   - `fix: resolve typewriter clipPath clipping on nested code blocks`
   - `perf: optimize Boids distance calculation using squared distance`
   - `docs: update quick start instructions for Next.js 15`

5. **Submit a Pull Request:**
   - Push your branch to GitHub:
     ```bash
     git push origin feat/your-feature-name
     ```
   - Open a PR against the `main` branch with a clear description of your changes and any relevant screenshots/recordings.

---

## 🐛 Reporting Issues

If you find a bug or have a suggestion:
1. Check the [existing GitHub Issues](https://github.com/PRN-6/swarm66/issues) to make sure it hasn't already been reported.
2. If opening a new issue, include:
   - **Description:** What happened vs what you expected to happen.
   - **Environment:** Browser version, OS, framework (e.g. Next.js 15, Vite React, plain HTML).
   - **Minimal Reproduction:** Code snippet or link to reproduce the behavior.

---

## 📜 License

By contributing to `@leozodiac/swarm66`, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).

