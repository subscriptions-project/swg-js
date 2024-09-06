#!/bin/bash

# Build all binaries, in parallel.
npx vite build -- --target=classic &
npx vite build -- --target=gaa &
npx vite build -- --target=basic &
wait

# Run E2E tests and report failures.
status=0
if [[ "$1" == "all_experiments_enabled" ]]; then
    npx gulp e2e --env=all_experiments_enabled || ((status++))
else
    npx gulp e2e || ((status++))
fi

# exit $status
