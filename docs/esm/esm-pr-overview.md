# Overview: ES Module Support and Modern Initialization

This document provides a comprehensive summary of the changes implemented to support ES Modules (ESM) and modern initialization patterns in `swg-js`. It is intended to guide reviewers through the architectural decisions and implementation details.

## 1. Motivation and Goals
The primary goal of this update is to evolve the library's initialization from a legacy "Async Snippet" pattern to a modern, module-ready API without breaking existing integrations.

### Key Objectives:
- **Enable ESM Imports:** Allow developers to use `import { subscriptions } from 'swg.mjs'`.
- **Passive-by-Default ESM:** Ensure that importing the library as a module does not trigger automatic side effects (like DOM scanning) unless explicitly requested.
- **100% Backwards Compatibility:** Maintain the "Active-by-Default" behavior for the IIFE build (`swg.js`) to support zero-config markup-only implementations.
- **Improved Async Handling:** Introduce a Promise-based `.ready()` API for cleaner asynchronous interaction.
- **Idempotency:** Guarantee that the library only initializes once per page, regardless of how many times it is imported or pushed to the global queue.

## 2. Architectural Approach

### 2.1. Runtime Refactoring
The core installation functions (`installRuntime` and `installBasicRuntime`) were refactored into a singleton pattern.
- **Singleton Storage:** The public API instance is now stored in a module-level variable.
- **Return Value:** `installRuntime` now returns the `SubscriptionsInterface`, allowing entry points to export it directly.
- **Idempotency:** Subsequent calls to `installRuntime` detect the existing instance and return it immediately.

### 2.2. Conditional Auto-Start Logic
To distinguish between the IIFE (Active) and ESM (Passive) environments, we introduced a build-time flag:
- **`IS_ESM_BUILD`:** Injected by Vite during the build process.
- **Safe Branching:** Entry points use a safe check (`typeof IS_ESM_BUILD !== 'undefined'`) to ensure stability in development (Gulp) environments where the flag may not be defined.
- **Behavior:**
    - If `IS_ESM_BUILD` is true, `autoStart` is disabled.
    - If false (IIFE), `autoStart` remains enabled to preserve legacy behavior.

### 2.3. The `ready()` Promise API
The global `SWG` and `SWG_BASIC` objects now include a `.ready()` method. This method returns a Promise that resolves to the public API, providing an alternative to the `.push(callback)` pattern.

## 3. Build System Updates

### 3.1. Vite Configuration
`vite.config.js` was updated to support multi-format output:
- **Dual Formats:** Now generates both `iife` and `es` bundles.
- **Smart Wrapping:** The `add-outer-iife` plugin is gated to only apply to IIFE builds, preventing it from breaking standard ES exports in the `.mjs` files.
- **Filename Extension:** ESM builds are explicitly named with the `.mjs` extension.

### 3.2. Production Script (`build_binaries.sh`)
The official build script was expanded to:
- Build template binaries for both JS and MJS formats.
- Specialized environment variants (Production, Autopush, Qual) are now generated for both formats.
- All environment-specific string replacements (Frontend URLs, Pay/Play environments) are applied to both extensions.

## 4. Verification and Testing

### 4.1. Unit & Integration Tests
- **Existing Coverage:** All ~1900 existing tests were executed and passed, confirming no regressions in legacy logic.
- **New Tests:** Two new integration suites were added:
    - `src/runtime/esm-integration-test.js`
    - `src/runtime/esm-basic-integration-test.js`
- **Scenarios Covered:**
    - Idempotency of `installRuntime`.
    - Return value of `installRuntime` matches the public API.
    - Legacy `.push()` functionality remains intact.
    - New `.ready()` promise resolves correctly.
    - `autoStart: false` successfully suppresses automatic initialization in module mode.

### 4.2. Build Integrity
- I manually verified that the Gulp-based development build remains stable and does not suffer from `ReferenceError` issues due to the new build-time constants.
- Verified that Vite correctly produces `.mjs` files with the expected `export` statements.
