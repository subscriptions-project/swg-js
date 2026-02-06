# Implementation Plan: ES Module Support (Proposal B)

This document outlines the steps to implement ES Module (ESM) support for the SwG library. The goal is to allow modern developers to use `import { subscriptions } from 'swg.js'` while ensuring 100% backwards compatibility with the existing `(self.SWG = self.SWG || []).push(...)` pattern.

## 1. Objectives
- Enable `import` syntax for `swg.js`, `swg-basic.js`, and `swg-gaa.js`.
- Maintain full functionality of the legacy async snippet pattern.
- Ensure the library only initializes once, even if imported multiple times or mixed with legacy snippets.
- Achieve 100% test coverage for new initialization paths.

## 2. Core Library Changes

### 2.1. Update Runtime Initialization (`src/runtime/runtime.ts`)
The `installRuntime` function must be updated to return the public API. It must also be idempotent and return the existing instance if already installed.

- **Storage:** Create a module-level variable `let publicRuntimeInstance: SubscriptionsInterface | null = null;`.
- **Logic:**
  - If `publicRuntimeInstance` exists, return it immediately.
  - If it doesn't exist but `win[RUNTIME_PROP]` is already an object (not an array), attempt to retrieve or recreate the public API (or better, ensure `publicRuntimeInstance` is always set when `installRuntime` runs).
- **Return Type:** Change from `void` to `SubscriptionsInterface`.
- **Parameter:** Add an optional `options` object: `installRuntime(win: Window, options?: {autoStart?: boolean})`.

Repeat similar changes for `installBasicRuntime` in `src/runtime/basic-runtime.ts`.

### 2.2. Update Entry Points (`src/main.ts`, `src/basic-main.ts`, `src/gaa-main.ts`)
Modify entry points to export the initialized instances.

**Example (`src/main.ts`):**
The entry point will now behave differently depending on how it's bundled. For ESM, we suppress auto-start.

```typescript
export const subscriptions = installRuntime(self, {
  autoStart: /* logic to detect if we are in an ESM build */
});
```

**Example (`src/gaa-main.ts`):**
```typescript
export {
  GaaGoogle3pSignInButton,
  GaaGoogleSignInButton,
  GaaMetering,
  GaaMeteringRegwall,
  GaaSignInWithGoogleButton,
} from './runtime/extended-access';
```

## 3. Build Configuration Changes (`vite.config.js`)

The Vite configuration needs to be updated to output both IIFE (for legacy `<script>` tags) and ESM (for modern `import` statements).

- **Output Formats:** Update `rollupOptions.output` to include both `iife` and `es`.
- **IIFE Wrapping:** Ensure the `add-outer-iife` plugin only applies to the IIFE build. ESM files should not be wrapped in an IIFE as it breaks exports.
- **Targeted Logic:** Use Vite's `define` or environment variables to inject a flag (e.g., `IS_ESM`) so that `main.ts` knows whether to auto-start.

## 4. Backwards Compatibility Verification

Existing publishers use:
```html
<script async src=".../swg.js" subscriptions-control="manual"></script>
<script>
  (self.SWG = self.SWG || []).push(subscriptions => {
    subscriptions.init('PUB_ID');
  });
</script>
```

**Why this still works:**
1. The IIFE build still executes `installRuntime(self)` with `autoStart: true` immediately upon loading.
2. `installRuntime` still processes the `win.SWG` array and replaces it with a `.push` proxy.
3. The ESM build, when loaded via `import`, *also* executes the side effect of calling `installRuntime(self)`, ensuring the global `self.SWG` is initialized for any legacy snippets that might coexist on the page.

### 4.1. Manual vs Auto Initialization
SwG supports an "auto-initialization" mode where it scans the DOM for configuration (e.g., meta tags) and starts automatically unless suppressed.

- **IIFE Behavior:** Remains "Active-by-Default". It will attempt to auto-start immediately to support zero-config markup-only implementations.
- **ESM Behavior:** Becomes "Passive-by-Default". The `import` side-effect will install the runtime and support legacy snippets, but it will **not** trigger an automatic `start()`.
- **The Benefit:** This eliminates the need for ESM developers to use the `subscriptions-control="manual"` flag. They can simply `import` and `init()` without worrying about race conditions with an autonomous auto-start process.
- **Backwards Compatibility:**
  - **Legacy Snippets:** Will still work perfectly. If a snippet calls `api.init()`, the runtime will initialize as expected.
  - **Markup-Only:** If a publisher wants SwG to handle everything via markup without writing JS, they should continue using the IIFE `<script>` tag. ESM is intended for developers who want explicit control.

### 4.2. DOM Configuration (LD+JSON) Support
Being "Passive" does not mean the library loses its ability to read markup. It simply transfers the control of *when* that scan happens to the developer.

- **Using Markup with ESM:** If a developer wants the library to use the configuration defined in LD+JSON or meta tags, they should call `subscriptions.start()` instead of `subscriptions.init()`.
- **Logic flow:** When `start()` is called, the library checks if it has been initialized via `init()`. If not, it automatically triggers the `PageConfigResolver` to scan the DOM, exactly as it would in "Auto" mode.
- **Why this is better:** It allows the developer to ensure that their own dependencies or tracking scripts are loaded before SwG starts scanning the DOM or making entitlement requests, without requiring a `manual` control flag.

## 5. Testing Strategy (100% Coverage)

### 5.1. Unit Tests
- **Idempotency Test:** Verify that calling `installRuntime` multiple times returns the exact same object instance.
- **Global Interaction Test:** Verify that `import`-ing the module correctly populates `window.SWG` and processes existing callbacks in the array.
- **Mixed Mode Test:** Verify that a page using both an ES `import` and a legacy `<script>` tag (IIFE) only initializes the runtime once.
- **Auto-Start Fork Test:** Verify that `autoStart: false` correctly suppresses the DOM scan and entitlement fetch, even if valid markup is present.

### 5.2. Integration/E2E Tests
- Create a test page using `<script type="module">` to import SwG and verify it can successfully call `subscriptions.init()`.
- Create a test page using a legacy snippet and verify it works even if the library is loaded via a module import.

## 6. Update `build_binaries.sh`

The production build script needs to be updated to handle the new ESM output files.

- **Loop over extensions:** Update the `create_binaries_for_environment` function to iterate over both `.js` and `.mjs`.
- **Update replacements:** Ensure the `sed` commands correctly target both file types.

## 7. Implementation Steps for the Agent

1.  **Refactor Runtimes:** Update `runtime.ts` and `basic-runtime.ts` to return the public API and support the `autoStart` option.
2.  **Add Exports:** Update entry point files to export the relevant objects/functions and use the `autoStart` logic.
3.  **Configure Vite:** Add the `es` format to the output array and gate the IIFE-wrapping plugin. Use `define` to set the build format flag.
4.  **Add Tests:** Update `runtime-test.js` and `basic-runtime-test.js` with new test cases covering the return values and module-style initialization.
5.  **Update Production Scripts:** Modify `build_binaries.sh` to produce and environment-specialize the new ESM binaries.
6.  **Verify Build:** Run the build and inspect the output files to confirm both IIFE and ESM versions contain the expected code and exports.
