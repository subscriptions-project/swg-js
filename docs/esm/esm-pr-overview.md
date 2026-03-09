# Moving swg-js to ES Modules

This PR gets `swg-js` ready for the modern web without breaking the thousands of sites that already use it. It adds ES Module (ESM) support and cleans up how the library starts up.

## The Goal

The web has moved to native modules, and `swg-js` needs to follow. But we have a lot of history here. This implementation avoids breaking the "Async Snippet" pattern that publishers have relied on for years.

The compromise is simple:
- **Modules are quiet.** If a site uses `import { subscriptions } from 'swg.mjs'`, nothing happens automatically. There are no surprise DOM scans or side effects. The developer is in control.
- **Script tags are loud.** The traditional `swg.js` bundle still acts as it always has—it scans the page and sets up buttons on its own.
- **It's safe.** Every one of the 1,900+ existing tests still passes.

## How it works

### Singletons
This PR refactors `installRuntime` and `installBasicRuntime` into singletons. The library now stores the API instance in a module-level variable. If the installer is called twice—which is easy to do when mixing imports and snippets—it just returns the existing instance. This prevents doubling up on event listeners or managers.

### The autoStart option
The installers now include an `autoStart` flag. 
- In the IIFE build, this defaults to `true` to keep things simple for markup-only sites.
- In the ESM build, it defaults to `false`. 
The entry points use a build-time constant (`IS_ESM_BUILD`) to decide which behavior to use.

### The ready() Promise
This PR adds a `.ready()` method to the global `SWG` and `SWG_BASIC` objects. This provides a promise-based alternative to the legacy `.push(callback)` pattern, offering a more modern way to handle asynchronous initialization.

## Build System

Vite is now configured to output both formats. Format-specific hacks (like the outer IIFE wrapper) are now gated so they only apply to the `.js` files, preventing them from breaking standard ES exports.

The `build_binaries.sh` script also handles both formats now, ensuring that the right URLs are injected into both the legacy and module versions for Prod, Autopush, and Qual.

## Verification

The migration was validated with an emphasis on preventing regressions in the production runtime:
1.  **100% Pass Rate:** The entire suite of ~1,900 tests was executed with no failures.
2.  **New ESM Tests:** Integration suites were added to test module-only scenarios, verifying that `autoStart: false` works and that multiple imports do not collide.
3.  **Manual Checks:** The development server was verified for stability, and the generated `.mjs` files were confirmed to be valid and exportable.

This PR delivers modules and a cleaner API without breaking existing integrations.
