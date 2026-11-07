# dom-swarm ⚡

> **Universal plug-and-play visual engine that reverse-engineers any webpage's DOM on the fly. When initialized on ANY website, the page begins blank with its natural background, autonomous AI/Figma-style cursors swarm in to construct the webpage live before the user's eyes, and once the entire page is built, every cursor converges into the user's cursor and vanishes.**

[![npm version](https://img.shields.io/npm/v/dom-swarm.svg?style=flat-square&color=0d99ff)](https://www.npmjs.com/package/dom-swarm)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%205.7-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg?style=flat-square)](https://bundlephobia.com/package/dom-swarm)
[![Bundle Size](https://img.shields.io/badge/Minified%20Bundle-~31KB-informational.svg?style=flat-square)](https://bundlephobia.com/package/dom-swarm)

---

## ✨ How It Works

1. **Initial Blank Canvas:**
   When installed in any project (React, Next.js, Vue, Svelte, or Vanilla HTML), `dom-swarm` indexes every element on the page. The page begins completely blank while preserving the site's natural background colors and layout flow.
2. **Autonomous Swarm Construction:**
   A squad of 15–30 vibrant Figma-style AI cursors burst in and systematically build the page from top to bottom:
   - Snapping **Figma Blue Selection Bounding Boxes** (`#0d99ff`) with live pixel dimension badges (`380 × 48`) and corner resize handles.
   - Drawing **Red Alignment Wireframes** (`#f24822`) with full-screen horizontal and vertical guide lines.
   - Morphing cursors into **`I-beam`** text tools to type out headings and paragraphs letter by letter.
   - Scaling and fading in buttons, interactive cards, and images with realistic inspection and construction motions.
3. **Grand Finale — Convergence & Vanishing:**
   As soon as the entire page is constructed, the swarm accelerates and swirls directly into the user's live mouse cursor, shrinking and vanishing into thin air—leaving the user with a 100% interactive, pristine webpage!

---

## 🚀 Quick Start & Installation

Install via npm, pnpm, or yarn:

```bash
# npm
npm install dom-swarm

# pnpm
pnpm add dom-swarm

# yarn
yarn add dom-swarm
```

### CDN / Standalone Script Tag

Drop `dom-swarm` directly into any static HTML or WordPress website using a script tag:

```html
<!-- Load dom-swarm global bundle from CDN -->
<script src="https://unpkg.com/dom-swarm/dist/index.global.js"></script>

<script>
  // Mount the swarm engine
  const swarm = DomSwarm.enableSwarm({
    agentCount: 20,
    hideOnStart: true,      // Page starts blank with native background
    vanishAtCursor: true,   // Swarm converges into user's cursor and vanishes when done
    typewriterEffect: true
  });
</script>
```

---

## 🛠️ Framework Integration Guides

### 1. Vanilla HTML / JavaScript

```js
import { enableSwarm } from 'dom-swarm';

const swarm = enableSwarm({
  agentCount: 20,
  hideOnStart: true,
  vanishAtCursor: true,
  typewriterEffect: true,
  showGuides: true,
});
```

### 2. React (`useEffect`)

```tsx
import React, { useEffect } from 'react';
import { enableSwarm } from 'dom-swarm';

export function App() {
  useEffect(() => {
    const swarm = enableSwarm({
      agentCount: 20,
      hideOnStart: true,
      vanishAtCursor: true,
      typewriterEffect: true,
    });

    // Cleanup on unmount
    return () => {
      swarm.destroy();
    };
  }, []);

  return (
    <main>
      <h1>Autonomous Cursor Swarm</h1>
      <p>Watch cursors build components live, then vanish into your pointer.</p>
    </main>
  );
}
```

### 3. Next.js App Router (`'use client'`)

`dom-swarm` has automatic SSR guards, so importing it in Next.js will never throw `window is not defined` errors.

```tsx
'use client';

import { useEffect } from 'react';
import { enableSwarm } from 'dom-swarm';

export default function SwarmProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const swarm = enableSwarm({
      agentCount: 25,
      hideOnStart: true,
      vanishAtCursor: true,
      typewriterEffect: true,
      showGuides: true,
    });

    return () => swarm.destroy();
  }, []);

  return <>{children}</>;
}
```

### 4. Vue 3 (`onMounted`)

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { enableSwarm, type DomSwarmInstance } from 'dom-swarm';

let swarm: DomSwarmInstance | null = null;

onMounted(() => {
  swarm = enableSwarm({
    agentCount: 20,
    hideOnStart: true,
    vanishAtCursor: true,
    typewriterEffect: true,
  });
});

onUnmounted(() => {
  swarm?.destroy();
});
</script>

<template>
  <div class="landing-page">
    <h1>Autonomous UI Builder</h1>
    <p>The swarm constructs this page live.</p>
  </div>
</template>
```

---

## ⚙️ Configuration API Reference

Pass an options object to `enableSwarm(config)` or `new DomSwarm(config)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `buildOnScroll` | `boolean` | `true` | When true, elements are constructed live strictly as the user scrolls them into the viewport. When false, builds through queue. |
| `showRulers` | `boolean` | `true` | Displays Figma top and left measurement rulers with real-time coordinate segments during construction. |
| `hideOnStart` | `boolean` | `true` | Starts the webpage blank while preserving the background, allowing the swarm to construct it live. |
| `vanishAtCursor` | `boolean` | `true` | Once all elements are constructed, all cursors accelerate into the user's cursor and vanish. |
| `concurrency` | `number` | `2` | Number of elements constructed in parallel waves. |
| `buildOrder` | `'top-to-bottom' \| 'random' \| 'viewport'` | `'top-to-bottom'` | Sequence in which elements are constructed. |
| `agentCount` | `number` | `20` | Total number of autonomous cursor agents in the swarm. |
| `colors` | `string[]` | `['#FF5722', '#00BCD4', '#8BC34A', '#9C27B0', '#FFC107', '#E91E63', '#2196F3']` | Vibrant color palette for cursors, wireframes, and name tags. |
| `selector` | `string` | `'nav, header, h1, h2, h3, h4, h5, h6, p, button, a, img, pre, code, .swarm-item'` | CSS selector targeting elements to construct. |
| `ignoreSelector` | `string` | `'[data-no-swarm], script, style, noscript, dom-swarm-overlay, .swarm-hud'` | CSS selector to exclude elements from swarm construction. |
| `typewriterEffect` | `boolean` | `true` | Simulates high-speed character typewriter reveals for text nodes (`p`, `h1`-`h6`, `code`). |
| `showGuides` | `boolean` | `true` | Displays full-screen horizontal and vertical Figma-style red alignment guides during construction. |
| `showDimensions` | `boolean` | `true` | Shows pixel dimension badges (e.g. `380 × 48`) on selection boxes. |
| `followMouse` | `boolean` | `true` | Idle agents flock and orbit dynamically around the user's cursor or touch location. |
| `maxSpeed` | `number` | `9.0` | Maximum agent velocity in pixels per frame. |
| `maxForce` | `number` | `0.38` | Maximum steering force applied during Boids calculations. |
| `buildDuration` | `number` | `600` | Duration (in milliseconds) spent constructing each element before moving to the next. |
| `showAgentNames` | `boolean` | `false` | When true, renders text name badges beside cursor avatars; when false, renders clean, minimalist cursors. |
| `customAgentNames` | `string[]` | `['Figma AI', 'Cursor-01', 'Copilot', 'Agent-α', 'Agent-β', 'PixelCraft', 'Architect', 'DevBot']` | List of avatar label badges rendered alongside cursors if `showAgentNames` is true. |
| `onAllElementsConstructed` | `() => void` | `undefined` | Callback fired when every detected element has finished construction. |
| `onSwarmVanished` | `() => void` | `undefined` | Callback fired when all cursors have converged into the user's cursor and vanished. |

---

## 🕹️ Instance Methods

`enableSwarm()` returns a `DomSwarmInstance` with control methods:

### `.replay(): void`
Clears the page back to blank, re-spawns cursors, and replays the entire live construction sequence from scratch.

### `.buildElement(element: HTMLElement): Promise<void>`
Manually dispatches nearest autonomous agents to inspect and construct any element immediately.

### `.pause(): void` / `.resume(): void`
Pauses or resumes the Boids physics loop and active construction tasks.

### `.isFinished(): boolean`
Returns `true` if all elements are constructed and the swarm has vanished.

### `.destroy(): void`
Completely tears down the overlay, cancels animation frames, unbinds event listeners, and cleanly restores all native DOM inline styles.

---

## 🧪 Local Testbed Demo

To run the interactive demo locally:

```bash
# 1. Install dependencies
npm install

# 2. Build library bundle
npm run build

# 3. Start demo server
npm run demo
```
Then visit `http://localhost:3000/demo/index.html`.

---

## 📄 License

MIT © [Dom Swarm Authors](https://github.com/dom-swarm/dom-swarm)
