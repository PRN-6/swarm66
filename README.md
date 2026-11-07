# @leozodiac/swarm66 ⚡

> **Universal plug-and-play visual engine that reverse-engineers any webpage's DOM on the fly. When initialized on ANY website, the page begins blank with its natural background, autonomous AI/Figma-style cursors swarm in to construct the webpage live before the user's eyes, and once the entire page is built, every cursor converges into the user's cursor and vanishes.**

[![npm version](https://img.shields.io/npm/v/@leozodiac/swarm66.svg?style=flat-square&color=0d99ff)](https://www.npmjs.com/package/@leozodiac/swarm66)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%205.7-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-success.svg?style=flat-square)](https://bundlephobia.com/package/@leozodiac/swarm66)

---

## ✨ How It Works

1. **Initial Blank Canvas:**
   When installed in any project (React, Next.js, Vue, Svelte, or Vanilla HTML), `@leozodiac/swarm66` indexes every element on the page. The page begins completely blank while preserving the site's natural background colors and layout flow.
2. **Autonomous Swarm Construction:**
   A squad of 18 vibrant Figma-style AI cursors organized into 4-member squads systematically builds the page:
   - **Focused Tool Cursors:**
     - ↖️ **Primary Arrow Pointer:** The clean, classic cursor used across the swarm for flocking, border navigation, and layout framing.
     - ✋ **Hand Tool (Single Drag Cursor):** Exactly 1 cursor grabs and slides duplicate wireframes across the canvas during copy-pasting.
     - ✏️ **Pencil / Pen Tool:** The lead agent uses the drafting pencil tool with micro sketching vibration to write headings and typewriter text.
   - Snapping **Figma Blue Selection Bounding Boxes** (`#0d99ff`) with live pixel dimension badges (`380 × 48`) and corner resize handles.
   - Drawing **Red Alignment Wireframes** (`#f24822`) with full-screen horizontal and vertical guide lines.
   - Active cursor-drawn box expansion: agents actively pull the 4 corners outward from `0 × 0` before revealing content.
3. **Grand Finale — Convergence & Vanishing:**
   As soon as the entire page is constructed, the swarm accelerates and swirls directly into the user's live mouse cursor, shrinking and vanishing into thin air—leaving the user with a 100% interactive, pristine webpage!

---

## 🚀 Quick Start & Installation

Install via npm, pnpm, or yarn:

```bash
# npm
npm install @leozodiac/swarm66

# pnpm
pnpm add @leozodiac/swarm66

# yarn
yarn add @leozodiac/swarm66
```

### CDN / Standalone Script Tag

Drop `@leozodiac/swarm66` directly into any static HTML, PHP, or WordPress website using a script tag:

```html
<!-- Load swarm66 global bundle from CDN -->
<script src="https://cdn.jsdelivr.net/npm/@leozodiac/swarm66@1.0.0/dist/index.global.js"></script>

<script>
  // Mount the swarm engine
  const swarm = enableSwarm({
    agentCount: 18,
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
import { enableSwarm } from 'swarm66';

const swarm = enableSwarm({
  agentCount: 18,
  hideOnStart: true,
  vanishAtCursor: true,
  typewriterEffect: true,
  showGuides: true,
});
```

### 2. React (`useEffect`)

```tsx
import React, { useEffect } from 'react';
import { enableSwarm } from 'swarm66';

export function App() {
  useEffect(() => {
    const swarm = enableSwarm({
      agentCount: 18,
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

`swarm66` has automatic SSR guards, so importing it in Next.js will never throw `window is not defined` errors.

```tsx
'use client';

import { useEffect } from 'react';
import { enableSwarm } from 'swarm66';

export default function SwarmProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const swarm = enableSwarm({
      agentCount: 18,
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

### 4. Vue 3 & Nuxt 3 (`onMounted`)

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { enableSwarm, type DomSwarmInstance } from 'swarm66';

let swarm: DomSwarmInstance | null = null;

onMounted(() => {
  swarm = enableSwarm({
    agentCount: 18,
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

### 5. Angular (`ngOnInit` & `ngOnDestroy`)

Works seamlessly in Angular standalone components or module-based architectures:

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { enableSwarm, DomSwarmInstance } from 'swarm66';

@Component({
  selector: 'app-root',
  template: `
    <main>
      <h1>Angular Live Construction</h1>
      <p>Autonomous AI cursors reverse-engineer and construct your Angular DOM.</p>
    </main>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  private swarm?: DomSwarmInstance;

  ngOnInit(): void {
    this.swarm = enableSwarm({
      agentCount: 18,
      teamSize: 4,
      hideOnStart: true,
      buildOrder: 'top-to-bottom',
      rebuildOnRouteChange: true, // Auto-rebuilds across Angular Router navigation
    });
  }

  ngOnDestroy(): void {
    this.swarm?.destroy();
  }
}
```

### 6. Svelte & SvelteKit (`onMount`)

```svelte
<script>
  import { onMount } from 'svelte';
  import { enableSwarm } from 'swarm66';

  onMount(() => {
    const swarm = enableSwarm({
      hideOnStart: true,
      typewriterEffect: true,
    });

    return () => swarm.destroy();
  });
</script>

<main>
  <h1>SvelteKit Swarm Experience</h1>
  <p>Universal zero-dependency client animation.</p>
</main>
```

### 7. PHP (Vanilla PHP, Laravel, WordPress, Symfony)

`swarm66` requires zero npm build steps for PHP and server-side languages. Simply load the IIFE bundle via CDN or local asset:

#### **Vanilla PHP (`index.php`):**
```php
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo "My PHP Application"; ?></title>
</head>
<body>
  <h1>Welcome to PHP with swarm66</h1>
  <p>Rendered on the server, built live by cursors in the client.</p>

  <!-- Load swarm66 bundle -->
  <script src="https://cdn.jsdelivr.net/npm/swarm66@1.0.0/dist/index.global.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      window.enableSwarm({
        hideOnStart: true,
        typewriterEffect: true,
        vanishAtCursor: true
      });
    });
  </script>
</body>
</html>
```

#### **Laravel (Blade Template `welcome.blade.php`):**
```html
@extends('layouts.app')

@section('content')
  <div class="hero">
    <h1>{{ __('Empowering Developers') }}</h1>
    <p>{{ __('Built with Laravel and styled with Tailwind.') }}</p>
  </div>
@endsection

@push('scripts')
  <script src="https://cdn.jsdelivr.net/npm/swarm66@1.0.0/dist/index.global.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      enableSwarm({
        hideOnStart: true,
        concurrency: 4,
      });
    });
  </script>
@endpush
```

#### **WordPress (`footer.php` or `functions.php`):**
```php
// In functions.php:
function enqueue_swarm66() {
    wp_enqueue_script(
        'swarm66',
        'https://cdn.jsdelivr.net/npm/swarm66@1.0.0/dist/index.global.js',
        array(),
        '1.0.0',
        true
    );
    wp_add_inline_script(
        'swarm66',
        'document.addEventListener("DOMContentLoaded", function() { window.enableSwarm({ hideOnStart: true }); });'
    );
}
add_action('wp_enqueue_scripts', 'enqueue_swarm66');
```

### 8. Python (Django, Flask, FastAPI)

In your Django template (`base.html`):

```html
{% load static %}
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  {% block content %}{% endblock %}

  <script src="https://cdn.jsdelivr.net/npm/swarm66@1.0.0/dist/index.global.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      window.enableSwarm({ hideOnStart: true });
    });
  </script>
</body>
</html>
```

### 9. Ruby on Rails & ASP.NET Core

- **Rails (ERB `application.html.erb`):** Include via `<%= javascript_include_tag 'https://cdn.jsdelivr.net/npm/swarm66@1.0.0/dist/index.global.js' %>` or importmap `pin "swarm66"`.
- **ASP.NET Core (`_Layout.cshtml`):** Add `<script src="~/js/swarm66.global.js"></script>` before the closing `</body>` tag.

---

## 📱 Mobile & Touch Compatibility

`swarm66` is built from the ground up for modern responsive web development and touch screens:

- **Touch Interaction**: Automatically captures `touchstart` and `touchmove` events on smartphones and tablets, allowing idle cursors to orbit and converge directly around the user's thumb or finger.
- **Adaptive Screen Sizing**: Evaluates `window.innerWidth` and `window.innerHeight` dynamically during simulation. Boids flock boundaries gracefully scale whether on a 360px mobile viewport or a 3840px ultrawide monitor.
- **Single-Agent Touch Drags**: The Figma-style diagonal corner drag scales smoothly to mobile dimensions, rendering pixel dimension badges that adapt to compact screens without horizontal overflow.
- **Orientation & Viewport Resize**: Listens to viewport `resize` and `scroll` events with passive handlers to keep bounding box overlays pixel-aligned during dynamic mobile device rotation.

---

---

## ⚙️ Configuration API Reference

Pass an options object to `enableSwarm(config)` or `new DomSwarm(config)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `hideOnStart` | `boolean` | `true` | Starts the webpage blank while preserving the background, allowing the swarm to construct it live. |
| `vanishAtCursor` | `boolean` | `true` | Once all elements are constructed, all cursors accelerate into the user's cursor and vanish. |
| `concurrency` | `number` | `2` | Number of elements constructed in parallel waves. |
| `buildOrder` | `'top-to-bottom' \| 'random' \| 'viewport'` | `'top-to-bottom'` | Sequence in which elements are constructed. |
| `agentCount` | `number` | `18` | Total number of autonomous cursor agents in the swarm. |
| `teamSize` | `number` | `4` | Number of agents in each team (dispatched to the 4 borders of elements). |
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
| `customAgentNames` | `string[]` | `['Figma AI', 'Cursor-01', 'Copilot', 'Agent-α', 'Agent-β', 'PixelCraft', 'Architect', 'DevBot']` | List of avatar label badges rendered alongside cursors. |
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

MIT © [leozodiac](https://github.com/leozodiac/swarm66)
