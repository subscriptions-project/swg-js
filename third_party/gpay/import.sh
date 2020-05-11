#!/bin/bash
set -o errexit ; set -o nounset

# Vars.
readonly IMPORT_DIR="$(pwd)"
readonly WORK_DIR="/var/tmp/swg/$(date +%Y%m%d-%H%M%S)"
readonly WORK_DIR_PROJ="$WORK_DIR/payjs"

echo "Import dir: $IMPORT_DIR"

# Create and cd to work dir.
echo "Work dir: $WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Git clone.
echo "Git clone: https://github.com/google/payjs.git"
git clone https://github.com/google/payjs.git
cd "$WORK_DIR_PROJ"

# Get current branch and commit.
echo "Current branch: $(git rev-parse --abbrev-ref HEAD)"
readonly GIT_COMMIT=$(git log --pretty=format:'%H' -n 1)
echo "Commit: $GIT_COMMIT"

# Version.
echo "$GIT_COMMIT" > "$IMPORT_DIR"/version.txt

# Copy sources.
mkdir -p "$IMPORT_DIR"/src
cp -r "$WORK_DIR_PROJ/src"/* "$IMPORT_DIR"/src/

# Copy third_party.
mkdir -p "$IMPORT_DIR"/third_party
cp -r "$WORK_DIR_PROJ/third_party"/* "$IMPORT_DIR"/third_party/

# Cleanup.
rm -f "$IMPORT_DIR"/src/BUILD.bazel
rm -f "$IMPORT_DIR"/src/button.js
rm -f "$IMPORT_DIR"/src/payjs.js
rm -rf "$IMPORT_DIR"/third_party/web_activities


######################
# SwG modifications.
######################

# Replace imports of Web Activities.
cat "$WORK_DIR_PROJ"/src/payments_web_activity_delegate.js \
    | sed "s/\.\.\/third_party\/web_activities\/activity-ports.js/web-activities\/activity-ports/" \
    | sed "s/this.useIframe_ = useIframe || false;//" \
    | sed "s/this.useIframe_/null/" \
    > "$IMPORT_DIR"/src/payments_web_activity_delegate.js

# Remove button renderer.
cat "$WORK_DIR_PROJ"/src/payjs_async.js \
    | sed "s/\.\.\/third_party\/web_activities\/activity-ports.js/web-activities\/activity-ports/" \
    | sed "s/import {createButtonHelper} from '.\/button.js';//" \
    | sed "s/createButtonHelper(options)/null/" \
    > "$IMPORT_DIR"/src/payjs_async.js
