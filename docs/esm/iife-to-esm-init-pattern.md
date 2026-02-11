# Evolution of SwG Initialization: From Snippets to Modules

This document details the transition of the `swg-js` initialization from the legacy "Async Snippet" pattern to a modern, module-based architecture. It explains why the original pattern existed and how the new implementation provides a modern experience without breaking existing sites.

---

## 1. The Legacy: The "Array Push" Pattern
Historically, `swg.js` used a specialized version of the Async Snippet pattern: `(self.SWG = self.SWG || []).push(...)`. This was necessary for several reasons:

- **Async Resilience:** It allowed sites to start using the `SWG` object before the script had even finished downloading. Code could be "queued" in an array and processed once the library executed.
- **Non-Blocking:** By using `async` or `defer` attributes, the library stayed out of the critical rendering path.
- **Automatic Execution:** The IIFE version of the library is "Active-by-Default." As soon as it loads, it scans the DOM for buttons and configuration, handling everything automatically for simple integrations.

---

## 2. The Modernization: ESM and Promises
The implementation now supports two modern initialization tracks alongside the legacy snippet.

### 2.1. Side-Effect-Free ES Modules
Developers can now import the library directly as a module. Unlike the legacy script, the ESM version is "Passive-by-Default."

**Usage:**
```javascript
import { subscriptions } from 'swg.mjs';

// The library is loaded, but hasn't scanned the DOM yet.
subscriptions.init({ ... });
```

The implementation achieves this using a build-time flag, `IS_ESM_BUILD`. When the library is built as a module, it suppresses the automatic DOM scanning and setup. This gives developers full control over when initialization happens, which is standard for modern dependencies.

### 2.2. The .ready() Promise
To move away from callback-heavy code, the `SWG` and `SWG_BASIC` objects now include a `.ready()` method. This returns a Promise that resolves to the public API once the library is fully loaded and initialized.

**Usage:**
```javascript
const subscriptions = await self.SWG.ready();
subscriptions.setupButtons();
```

---

## 3. Technical Architecture

### 3.1. Singletons and Idempotency
The core installers (`installRuntime` and `installBasicRuntime`) were refactored into singletons. The public API instance is stored in a module-level variable. 

If a site mixes patterns—for example, using a legacy snippet and then importing the module later—the library detects the existing instance and returns it immediately. This prevents the creation of duplicate managers, redundant event listeners, or multiple DOM scans.

### 3.2. Granular Initialization Control
The installers now accept an `options` object: `installRuntime(win, {autoStart: boolean})`. 
- **autoStart (true):** The library performs legacy tasks like `setupButtons()` and `setupInlineCta()` automatically.
- **autoStart (false):** The library initializes its internal managers but remains idle until the developer calls a method.

The entry points decide which behavior to use based on the build format. The IIFE bundle defaults to `true` to maintain backward compatibility, while the ESM bundle defaults to `false` to avoid side effects during import.

### 3.3. Multi-Format Build System
The build system was updated to produce both formats simultaneously. Vite generates `.js` (IIFE) and `.mjs` (ESM) files for all entry points. Format-specific logic, such as the outer IIFE wrapper used for certain environments, is gated to ensure it doesn't corrupt the standard exports required for modules.

## 4. Conclusion
The current architecture bridges the gap between legacy and modern web development. It preserves the "auto-pilot" behavior for simple script-tag integrations while providing a clean, side-effect-free, Promise-based experience for developers using modern module-based workflows.
