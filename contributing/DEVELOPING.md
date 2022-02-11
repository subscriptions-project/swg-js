<!---
Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.

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

# Development on Subscribe with Google

## How to get started

Before you start developing in Subscribe with Google, check out these resources:

- [CONTRIBUTING.md](../CONTRIBUTING.md) has details on various ways you can contribute to the Subscribe with Google.
  - If you're developing in Subscribe with Google, you should read the [Contributing code](../CONTRIBUTING.md#contributing-code).

## Setup

Now that you have all of the files copied locally you can actually build the code and run a local server to try things out. We use Node.js, the Yarn package manager, Closure Compiler, and the Gulp build system to build `swg-js` and start up a local server that lets you try out your changes.

- Install the latest LTS version of [Node.js](https://nodejs.org/) (which includes npm). If you're on Mac or Linux, an easy way to install Node.js is with `nvm`: [here](https://github.com/creationix/nvm).

  ```
  nvm install --lts
  ```

- If you have a global install of [Gulp](https://gulpjs.com/), uninstall it. (Instructions [here](https://github.com/gulpjs/gulp/blob/v3.9.1/docs/getting-started.md). See [this article](https://medium.com/gulpjs/gulp-sips-command-line-interface-e53411d4467) for why.)

  ```
  npx yarn global remove gulp
  ```

- Install Swgjs with the following bash commands, instead of simply cloning the repo. These commands install Swgjs in a standardized location and they also install helpful bash scripts, like `swgjs_start_server`.

  ```
  curl https://raw.githubusercontent.com/subscriptions-project/swg-js/main/shortcuts.sh -o /tmp/swgjs-shortcuts.sh
  source /tmp/swgjs-shortcuts.sh
  swgjs_install && swgjs_add_shortcuts_to_bashrc
  ```

- In your local repository directory (e.g. `~/projects/swgjs`), install the packages that SWG uses by running
  ```
  npx yarn
  ```
  You should see a progress indicator and some messages scrolling by.

Now whenever you're ready to build `swg-js` and start up your local server, simply go to your local repository directory and run:

```
npx gulp
```

Running the `npx gulp` command will compile the code and start up a Node.js server listening on port 8000. Once you see a message like `Finished 'default'` you can access the local server in your browser at [http://localhost:8000](http://localhost:8000)

You can browse the [http://localhost:8000/examples](http://localhost:8000/examples) directory to see some demo pages for various SwG components and combination of components.

## Code quality and style

SwG uses [Eslint](https://eslint.org/) to ensure code quality and [Prettier](https://prettier.io/) to standardize code style. For easy development, here are two recommendations:

- Use a code editor with Eslint support to make sure that your code satisfies all of SwG's quality and style rules. [Here](https://eslint.org/docs/user-guide/integrations#editors) is a list of editors with Eslint extension support.
- Set your editor to automatically fix Eslint errors in your code on save.

For example, if you use [Visual Studio Code](https://code.visualstudio.com/), you can install its [Eslint plugin](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint), and enable the `eslint.autoFixOnSave` setting.

Alternatively, you can manually fix lint errors in your code by running:

```
npx gulp lint --local_changes --fix
```

## DNS Aliases

For some local testing we refer to fake local URLs in order to simulate referencing third party URLs. This requires extra setup so your browser will know that these URLs actually point to your local server.

You can do this by adding this line to your hosts file (`/etc/hosts` on Mac or Linux, `%SystemRoot%\System32\drivers\etc\hosts` on Windows):

```
127.0.0.1 pub.localhost sp.localhost
```

## Build & Test

Use the following Gulp commands:

| Command                                       | Description                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **`npx gulp`**<sup>[[1]](#footnote-1)</sup>   | Runs "watch" and "serve". Use this for standard local dev.                                                     |
| `npx gulp dist`<sup>[[1]](#footnote-1)</sup>  | Builds production binaries.                                                                                    |
| `npx gulp lint`                               | Validates against Google Closure Linter.                                                                       |
| `npx gulp lint --watch`                       | Watches for changes in files, Validates against Google Closure Linter.                                         |
| `npx gulp lint --fix`                         | Fixes simple lint warnings/errors automatically.                                                               |
| `npx gulp build`<sup>[[1]](#footnote-1)</sup> | Builds the library.                                                                                            |
| `npx gulp check-links --files foo.md,bar.md`  | Reports dead links in `.md` files.                                                                             |
| `npx gulp clean`                              | Removes build output.                                                                                          |
| `npx gulp watch`<sup>[[1]](#footnote-1)</sup> | Watches for changes in files, re-build.                                                                        |
| `npx gulp unit`                               | Runs unit tests in Chrome.                                                                                     |
| `npx gulp unit --coverage`                    | Runs unit tests in code coverage mode. After running, the report will be available at test/coverage/index.html |
| `npx gulp e2e`                                | Runs end-to-end tests in Chrome.                                                                               |
| `npx gulp serve`                              | Serves Scenic site on http://localhost:8000/.                                                                  |
| `npx gulp serve --quiet`                      | Same as `serve`, with logging silenced.                                                                        |

<a id="footnote-1">[1]</a> On Windows, this command must be run as administrator.

## Manual testing

For manual testing build Subscribe with Google and start the Node.js server by running `npx gulp`.

## [Code of Conduct](../CODE_OF_CONDUCT.md)

## Repository Layout

<pre>
  assets/         - static assets and i18n translations
  build/          - (generated) intermediate generated files
  build-system/   - build infrastructure and development server
  contributing/   - docs for code contributors
  dist/           - (generated) Web releases are compiled here, then deployed to a CDN
  exports/        - AMP releases use these files to export specific JavaScript symbols
                    for AMP extensions (ex: amp-subscriptions-google) to reference
  docs/           - documentation for publishers
  examples/       - example publisher website, used for local development
  src/            - source code and unit tests
  test/           - e2e tests and libraries for unit tests
  third_party/    - third party code, not developed by the Swgjs team
</pre>
