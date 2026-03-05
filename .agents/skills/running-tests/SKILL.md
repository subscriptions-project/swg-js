---
name: Running Unit Tests
description: How to correctly run unit tests in the Subscribe with Google (swg-js) repository
---

# Running Unit Tests in swg-js

When running tests in the Subscribe with Google repository, follow these precise rules to ensure tests run smoothly without errors or unnecessary overhead:

## The Test Command

Do **NOT** guess the test command or use default commands like `npm run test` or `gulp test` unless verified. The official test task is **`unit`**.

The standard way to execute tests is via `gulp unit`.

### Required Flags

1. **`--headless`**: You must **ALWAYS** append `--headless` to ensure the Karma runner executes in the background without popping up visible browsers, which can crash or hang the CI/terminal.
2. **`--files`**: Instead of running the entire suite (which takes a long time), you should target the specific test file you are working on.

### Example Syntax

To run a specific test file, pass the exact relative path to the file you want to test in quotes:

```bash
npx gulp unit --headless --files="src/runtime/gis/gis-login-flow-test.js"
```

## Troubleshooting
- If you see `Task never defined: test`, it means you incorrectly forgot to use the `unit` task name.
- Do not use wildcards in `--files` (e.g. `*gis-login-flow-test.js*`) because the shell may expand them incorrectly. Pass the literal path.
