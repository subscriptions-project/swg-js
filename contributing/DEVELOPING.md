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
* [CONTRIBUTING.md](../CONTRIBUTING.md) has details on various ways you can contribute to the Subscribe with Google.
  * If you're developing in Subscribe with Google, you should read the [Contributing code](../CONTRIBUTING.md#contributing-code).

## Setup

Now that you have all of the files copied locally you can actually build the code and run a local server to try things out. We use Node.js, the Yarn package manager, Closure Compiler, and the Gulp build system to build `swg-js` and start up a local server that lets you try out your changes.

* Install the latest LTS version of [Node.js](https://nodejs.org/) (which includes npm). If you're on Mac or Linux, an easy way to install Node.js is with `nvm`: [here](https://github.com/creationix/nvm).

   ```
   nvm install --lts
   ```

* Install the stable version of [Yarn](https://yarnpkg.com/) (Mac and Linux: [here](https://yarnpkg.com/en/docs/install#alternatives-stable), Windows: [here](https://yarnpkg.com/lang/en/docs/install/#windows-stable))

   ```
   curl -o- -L https://yarnpkg.com/install.sh | bash
   ```
  An alternative to installing `yarn` is to invoke each Yarn command in this guide with `npx yarn` during local development. This will automatically use the current stable version of `yarn`.

* Closure Compiler is automatically installed by Yarn, but it requires Java 8 which you need to install separately. SWG's version of Closure Compiler won't run with newer versions of Java. Download an installer for Mac, Linux or Windows [here](http://www.oracle.com/technetwork/java/javase/downloads/jre8-downloads-2133155.html).
  * Note: If you are using Mac OS and have multiple versions of Java installed, make sure you are using Java 8 by adding this to `~/.bashrc`:

  ```
  export JAVA_HOME=`/usr/libexec/java_home -v 1.8`
  ```

* If you have a global install of [Gulp](https://gulpjs.com/), uninstall it. (Instructions [here](https://github.com/gulpjs/gulp/blob/v3.9.1/docs/getting-started.md). See [this article](https://medium.com/gulpjs/gulp-sips-command-line-interface-e53411d4467) for why.)

   ```
   yarn global remove gulp
   ```

* Install the [Gulp](https://gulpjs.com/) command line tool, which will automatically use the version of `gulp` packaged with the the `swg-js` repository. (instructions [here](https://github.com/gulpjs/gulp/blob/v3.9.1/docs/getting-started.md))

   ```
   yarn global add gulp-cli
   ```
  An alternative to installing `gulp-cli` is to invoke each Gulp command in this guide with `npx gulp` during local development. This will also use the version of `gulp` packaged with the `swg-js` repository.

* In your local repository directory (e.g. `~/projects/swg-js`), install the packages that SWG uses by running
   ```
   yarn
   ```
   You should see a progress indicator and some messages scrolling by.  You may see some warnings about optional dependencies, which are generally safe to ignore.

Now whenever you're ready to build `swg-js` and start up your local server, simply go to your local repository directory and run:

```
gulp
```

Running the `gulp` command will compile the code and start up a Node.js server listening on port 8000.  Once you see a message like `Finished 'default'` you can access the local server in your browser at [http://localhost:8000](http://localhost:8000)

You can browse the [http://localhost:8000/examples](http://localhost:8000/examples) directory to see some demo pages for various AMP components and combination of components.

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
| `gulp build`<sup>[[1]](#footnote-1)</sup>                               | Builds the library.                                               |
| `gulp check-links --files foo.md,bar.md`                                | Reports dead links in `.md` files.                                                 |
| `gulp clean`                                                            | Removes build output.                                                 |
| `gulp watch`<sup>[[1]](#footnote-1)</sup>                               | Watches for changes in files, re-build.                               |
| `gulp test`<sup>[[1]](#footnote-1)</sup>                                | Runs tests in Chrome.                                                 |

<a id="footnote-1">[1]</a> On Windows, this command must be run as administrator.

## Manual testing

For manual testing build Subscribe with Google and start the Node.js server by running `gulp`.

## Repository Layout
<pre>
  build/          - (generated) intermediate generated files
  build-system/   - build infrastructure
  contributing/   - docs for people contributing to the project
  dist/           - (generated) main JS binaries are created here. This is what
                    gets deployed to CDN.
  docs/           - documentation
  examples/       - example files and corresponding assets
  src/            - source code
  test/           - tests
</pre>

## Deploying for testing

### Deploying to App Engine

This repo is configured to be deployable to App Engine. The relevant configuration files are [app.yaml](../app.yaml) and [Dockerfile](../Dockerfile).

To deploy:

1. Install and init [Google Cloud SDK](https://cloud.google.com/sdk/downloads)
2. Create App Engine project if you don't have one yet. Go to the [Google Cloud Console](https://console.cloud.google.com/) and select "Create Project" option. If the project already exists, make sure you have deploy privileges. For more details, see [Node.js on App Engine tutorial](https://cloud.google.com/nodejs/getting-started/hello-world).
3. Deploy by executing in command line from the project's root folder: `gcloud app deploy --project $PROJECT_ID --stop-previous-version`.


## [Code of conduct](../CODE_OF_CONDUCT.md)
