<!---
Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS-IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Development on __PROJECT__

## How to get started

Before you start developing in __PROJECT__, check out these resources:
* [CONTRIBUTING.md](../CONTRIBUTING.md) has details on various ways you can contribute to the __PROJECT__.
  * If you're developing in __PROJECT__, you should read the [Contributing code](../CONTRIBUTING.md#contributing-code).

## Setup

TODO: Node.js, Yarn, Gulp

## DNS Aliases

For some local testing we refer to fake local URLs in order to simulate referencing third party URLs.  This requires extra setup so your browser will know that these URLs actually point to your local server.

   You can do this by adding this line to your hosts file (`/etc/hosts` on Mac or Linux, `%SystemRoot%\System32\drivers\etc\hosts` on Windows):

    ```127.0.0.1               pub.localhost sp.localhost```


## Build & Test

Use the following Gulp commands:

| Command                                                                 | Description                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **`gulp`**<sup>[[1]](#footnote-1)</sup>                                 | Runs "watch" and "serve". Use this for standard local dev.            |
| `gulp dist`<sup>[[1]](#footnote-1)</sup>                                | Builds production binaries.                                           |
| `gulp lint`                                                             | Validates against Google Closure Linter.                              |
| `gulp lint --watch`                                                     | Watches for changes in files, Validates against Google Closure Linter.|
| `gulp lint --fix`                                                       | Fixes simple lint warnings/errors automatically.                      |
| `gulp build`<sup>[[1]](#footnote-1)</sup>                               | Builds the __PROJECT__ library.                                               |
| `gulp check-links --files foo.md,bar.md`                                | Reports dead links in `.md` files.                                                 |
| `gulp clean`                                                            | Removes build output.                                                 |
| `gulp watch`<sup>[[1]](#footnote-1)</sup>                               | Watches for changes in files, re-build.                               |
| `gulp test`<sup>[[1]](#footnote-1)</sup>                                | Runs tests in Chrome.                                                 |

<a id="footnote-1">[1]</a> On Windows, this command must be run as administrator.

## Manual testing

For manual testing build __PROJECT__ and start the Node.js server by running `gulp`.

## Repository Layout
<pre>
  build/          - (generated) intermediate generated files
  build-system/   - build infrastructure
  contributing/   - docs for people contributing to the __PROJECT__
  dist/           - (generated) main JS binaries are created here. This is what
                    gets deployed to cdn.__PROJECT__.
  docs/           - documentation about __PROJECT__
  examples/       - example __PROJECT__ files and corresponding assets
  src/            - source code for the __PROJECT__
  test/           - tests for the __PROJECT__
</pre>

## Deploying for testing

### Deploying to App Engine

This repo is configured to be deployable to App Engine. The relevant configuration files are [app.yaml](../app.yaml) and [Dockerfile](../Dockerfile).

To deploy:

1. Install and init [Google Cloud SDK](https://cloud.google.com/sdk/downloads)
2. Create App Engine project if you don't have one yet. Go to the [Google Cloud Console](https://console.cloud.google.com/) and select "Create Project" option. If the project already exists, make sure you have deploy privileges. For more details, see [Node.js on App Engine tutorial](https://cloud.google.com/nodejs/getting-started/hello-world).
3. Deploy by executing in command line from the project's root folder: `gcloud app deploy --project $PROJECT_ID`.


## [Code of conduct](../CODE_OF_CONDUCT.md)
