#!/bin/bash

# Remove previously built binaries.
rm -rf dist/

# Define version based on git commit hash.
SWG_VERSION=$(git rev-parse HEAD)

# Enable these experiments by default.
# TODO: b/279620260 - Clean up flag after launch is finalized.
# TODO: b/279620593 - Clean up flag after launch is finalized.
EXPERIMENTS="disable-desktop-miniprompt,logging-audience-activity"

# Build template binaries, in parallel.
function build_template_binary() {
    local -r target="$1"
    local -r experiments="$2"
    shift 2

    local filename="swg"
    if [[ $target != "classic" ]]; then
        filename="$filename-$target"
    fi
    filename="$filename.template.js"

    npx vite build -- \
        "--assets=https://news.google.com/swg/js/v1" \
        "--experiments=$experiments" \
        "--frontend=https://FRONTEND.com" \
        "--frontendCache=nocache" \
        "--minifiedBasicName=$filename" \
        "--minifiedGaaName=$filename" \
        "--minifiedName=$filename" \
        "--payEnvironment=___PAY_ENVIRONMENT___" \
        "--playEnvironment=___PLAY_ENVIRONMENT___" \
        "--swgVersion=$SWG_VERSION" \
        "--target=$target"
}
build_template_binary basic   $EXPERIMENTS &
build_template_binary classic $EXPERIMENTS &
build_template_binary gaa     $EXPERIMENTS &
wait

# Create binaries for each environment, in parallel.
function create_binaries_for_environment() {
    local -r target="$1"
    local -r frontend="$2"
    local -r pay_environment="$3"
    local -r play_environment="$4"
    shift 4

    for variant in "" "-basic" "-gaa"; do
        # Copy files.
        cp dist/swg$variant.template.js dist/swg$variant$target.js
        cp dist/swg$variant.template.js.map dist/swg$variant$target.js.map

        # Replace values.
        sed -i "s|https://FRONTEND.com|$frontend|g"                dist/swg$variant$target*
        sed -i "s|___PAY_ENVIRONMENT___|$pay_environment|g"        dist/swg$variant$target*
        sed -i "s|___PLAY_ENVIRONMENT___|$play_environment|g"      dist/swg$variant$target*
        sed -i "s|swg$variant.template.js.map|swg$variant$target.js.map|g" dist/swg$variant$target*
    done
}
create_binaries_for_environment \
    "" \
    "https://news.google.com" \
    "PRODUCTION" \
    "PROD" &
create_binaries_for_environment \
    "-autopush" \
    "https://subscribe-autopush.sandbox.google.com" \
    "PRODUCTION" \
    "AUTOPUSH" &
create_binaries_for_environment \
    "-qual" \
    "https://subscribe-qual.sandbox.google.com" \
    "SANDBOX" \
    "STAGING" &
wait

# Remove template binaries.
rm dist/*template.js*
