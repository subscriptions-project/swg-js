# Research Report: SwG Initialization Patterns

## Executive Summary
The `(self.SWG = self.SWG || []).push(...)` pattern used by `swg.js` is a specialized implementation of the **Async Snippet** pattern. While it effectively solves the problem of asynchronous script loading in non-module environments, it lacks the ergonomics of modern JavaScript features like Promises and ES Modules. This report outlines why this pattern exists and how it can be evolved.

---

## 1. Why the Current Pattern Exists
The "Array Push" pattern was the industry standard for third-party libraries (similar to Google Analytics, Facebook Pixel, etc.) for several years. It was chosen for SwG for three primary reasons:

### A. Asynchronous Loading Resilience
By allowing publishers to interact with `self.SWG` before the script has even begun downloading, the library prevents race conditions. The publisher can "queue" their initialization logic in an array. Once `swg.js` loads and executes, it iterates through this array and processes the queued functions.

### B. Non-Blocking Integration
Publishers can include the SwG script using the `async` or `defer` attributes. This ensures that the SwG library doesn't block the critical rendering path of the publisher's website.

### C. Execution Order Independence
Because the library replaces the `.push` method with its own execution handler after initialization (found in `src/runtime/runtime.ts`), any subsequent calls to `.push` by the publisher are executed immediately, ensuring a consistent API regardless of when the code is called.

---

## 2. Modernizing the Initialization Pattern
To align with modern development practices while maintaining backwards compatibility, we can introduce two primary enhancements.

### Proposal A: Promise-Based Initialization
Instead of a callback-based queue, we can expose a Promise that resolves when the runtime is ready. This allows for cleaner `async/await` syntax.

**Proposed Usage:**
```javascript
const subscriptions = await self.SWG.ready();
subscriptions.init({ ... });
```

**Implementation Strategy:**
We can modify `installRuntime` in `src/runtime/runtime.ts` to attach a `ready` function to the `SWG` object that returns a singleton Promise.

### Proposal B: ES Module Support
Currently, SwG is bundled primarily as an IIFE (Immediately Invoked Function Expression). By updating the build configuration to also output an ES Module (ESM), developers using modern build tools (Vite, Webpack, etc.) can import the library directly.

**Proposed Usage:**
```javascript
import { subscriptions } from 'swg-js';

subscriptions.init({ ... });
```

---

## 3. Implementation Roadmap (Backwards Compatible)

To implement these changes without breaking existing implementations:

1.  **Update `vite.config.js`:** Update the configuration to produce both IIFE and ESM outputs.
2.  **Modify `src/main.ts`:** Export the initialized runtime.
    ```typescript
    // src/main.ts
    export const subscriptions = installRuntime(self);
    ```
3.  **Enhance `installRuntime`:**
    *   Initialize `self.SWG` as an object that still supports `.push` (for legacy code).
    *   Add a `.ready()` method to `self.SWG` that returns a Promise resolving to the API.
    *   Ensure that if `self.SWG` was already an array, its contents are still processed.

## 4. Conclusion
The current initialization pattern is a robust legacy solution for a pre-ESM web. Transitioning to a Promise-based API and providing official ESM exports will significantly improve the developer experience, making SwG feel like a modern dependency rather than a legacy "snippet."
