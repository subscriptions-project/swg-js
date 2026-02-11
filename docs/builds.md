# Build Process

This document outlines how the various binaries are produced in this project, specifically how source files like `main.ts` are transformed into distributable files like `swg.js`.

## Orchestration

The project uses two primary build systems:
1. **Gulp (Browserify):** Used primarily for local development and testing. It supports `gulp watch` for rapid iteration and serves files via the local dev server.
2. **Vite (Rollup):** Used for production builds and official releases. It is optimized for minification and environment-specific deployments.

The entry point for official builds is the `build_binaries.sh` script.

## The `build_binaries.sh` Script

The `build_binaries.sh` script orchestrates the production of environment-specific binaries.

### 1. Building Templates
The script first builds "template" binaries for each major product variant using Vite.

| Target | Entry Point | Template Output |
| :--- | :--- | :--- |
| `classic` | `src/main.ts` | `dist/swg.template.js` |
| `basic` | `src/basic-main.ts` | `dist/swg-basic.template.js` |
| `gaa` | `src/gaa-main.ts` | `dist/swg-gaa.template.js` |

This is done via the `build_template_binary` function which calls:
```bash
npx vite build -- --target=[target] --minifiedName=[filename] ...
```

### 2. Environment Substitution
Once the templates are built, the script creates specific versions for different environments (Production, Autopush, Qual) by performing string replacements using `sed`.

For each variant (Classic, Basic, GAA), it produces:
- **Production:** `swg.js`, `swg-basic.js`, `swg-gaa.js`
- **Autopush:** `swg-autopush.js`, `swg-basic-autopush.js`, `swg-gaa-autopush.js`
- **Qual:** `swg-qual.js`, `swg-basic-qual.js`, `swg-gaa-qual.js`

The replacements include:
- `https://FRONTEND.com` -> The environment's frontend URL.
- `___PAY_ENVIRONMENT___` -> `PRODUCTION` or `SANDBOX`.
- `___PLAY_ENVIRONMENT___` -> `PROD`, `AUTOPUSH`, or `STAGING`.

## Constants Injection

During the build process, several constants in `src/constants.ts` are overwritten with values passed via CLI arguments. This allows the same source code to be built for different environments.

The values are resolved in `build-system/tasks/compile-config.js` and injected:
- **In Vite:** Via `@rollup/plugin-replace`.
- **In Gulp:** Via a custom Babel transform (`build-system/transform-define-constants.js`).

Commonly injected constants include:
- `FRONTEND`: The URL of the SwG server.
- `PAY_ENVIRONMENT`: The environment for Google Pay (PRODUCTION/SANDBOX).
- `INTERNAL_RUNTIME_VERSION`: The version of the library (often the git commit hash).

## Development Build (Gulp)

For local development, running `npm run build` or `gulp build` uses the Gulp-based build system.

- **Configuration:** `build-system/tasks/compile.js`
- **Tooling:** Browserify + tsify + Babel.
- **Output:** Files are typically placed in `dist/` with names like `subscriptions.js` (equivalent to `swg.js`).

## How to Add a New Build

To add a new binary/build target to the project:

1. **Create an Entry Point:**
   Add a new `.ts` file in `src/` (e.g., `src/new-feature-main.ts`).

2. **Update Vite Configuration:**
   Add the new target to the `builds` object in `vite.config.js`:
   ```javascript
   const builds = {
     // ... existing builds
     'new-feature': {
       output: args.minifiedNewFeatureName || 'new-feature-subscriptions.js',
       input: './src/new-feature-main.ts',
     },
   };
   ```

3. **Update Gulp Configuration (Optional):**
   If you want the new target to be available via Gulp tasks (e.g., for local development with `gulp watch` or testing with the local demo server), update `build-system/tasks/compile.js`:
   ```javascript
   const scriptCompilations = {
     // ...
     'new-feature': () => compileScript('./src/', 'new-feature-main.ts', './dist', {
       toName: 'new-feature-subscriptions.max.js',
       minifiedName: args.minifiedNewFeatureName || 'new-feature-subscriptions.js',
       wrapper: '(function(){<%= contents %>})();',
       ...options
     }),
   };
   ```
   *Note: You might skip this if the build is a production-only artifact and you don't need hot-reloading or local demo support for it.*

4. **Update `build_binaries.sh`:**
   Add the new target to the template build section:
   ```bash
   build_template_binary new-feature $EXPERIMENTS &
   ```
   The `create_binaries_for_environment` function will automatically pick up the new `-new-feature` variant if you add it to the loop:
   ```bash
   for variant in "" "-basic" "-gaa" "-new-feature"; do
   ```
