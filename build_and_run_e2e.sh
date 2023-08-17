#!/bin/bash

# Build all binaries, in parallel.
npx vite build -- --target=classic &
npx vite build -- --target=gaa &
npx vite build -- --target=basic &
wait

# Run all test configurations. Report failure if any run fails.
status=0
npx gulp e2e || ((status++))
npx gulp e2e --env=all_experiments_enabled || ((status++))

exit $status
