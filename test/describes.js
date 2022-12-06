/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview
 *
 * describes.js helps save you from writing a lot of boilerplate test code.
 * It also helps avoid mutating global state in tests by providing mock globals.
 *
 * `describes` is a global test variable that wraps and augments Mocha's test
 * methods. Each test method returns an `env` object containing mocks, etc. that help testing.
 *
 * For example, a typical Mocha test may look like:
 *
 *     describe('myTest', () => {
 *       // I gotta do this sandbox creation and restore for every test? Ugh...
 *       let sandbox;
 *       beforeEach(() => { sandbox = sinon.createSandbox(); })
 *       it('stubbing', () => { sandbox.stub(foo, 'bar'); });
 *       afterEach(() => { sandbox.restore(); });
 *     });
 *
 * A test that uses describes.js can save you the work of setting up sandboxes,
 * embedded iframes, mock windows, etc. For example:
 *
 *     // Yay! describes.sandboxed() sets up the sandbox for me.
 *     // Note the returned `env` object.
 *     describes.sandboxed('myTest', env => {
 *       it('stubbing', () => { env.sandbox.stub(foo, 'bar'); });
 *     });
 *
 * describes.js provides two modes of operation
 * (which actually both support `env.sandbox`):
 *
 * 1. `sandboxed()` just helps you set up and tear down a sinon sandbox.
 *    Use this to save some sinon boilerplate code.
 *
 * 2. `realWin()` provides a real Window in an embedded iframe in `env.win`.
 *    Use this when you're testing APIs that need a real DOM.
 *
 * The returned `env` object contains different objects depending on the
 * mode of operation.
 *
 * The are more advanced usages of the returned `env` objects.
 * See the type definitions for `sandboxed` and `realWin` below.
 */

import 'regenerator-runtime/runtime';
import * as sinon from 'sinon';

/** Should have something in the name, otherwise nothing is shown. */
const SUB = ' ';

/** @type {number} */
let iframeCount = 0;

/**
 * A test with a sandbox.
 * @param {string} name
 * @param {function()} fn
 */
export const sandboxed = describeEnv(() => []);

/**
 * A test with a real (iframed) window.
 * @param {string} name
 * @param {function({
 *   win: !Window,
 *   iframe: !HTMLIFrameElement,
 * })} fn
 */
export const realWin = describeEnv(() => [new RealWinFixture()]);

/**
 * Returns a wrapped version of Mocha's describe(), it() and only() methods
 * that also sets up the provided fixtures and returns the corresponding
 * environment objects of each fixture to the test method.
 * @param {function(!Object):!Array<?Fixture>} factory
 */
function describeEnv(factory) {
  /**
   * @param {string} name
   * @param {function(!Object)} fn
   * @param {function(string, function())} describeFunc
   */
  const templateFunc = function (name, fn, describeFunc) {
    const fixtures = factory().filter((fixture) => fixture && fixture.isOn());
    fixtures.push(new SandboxFixture());

    return describeFunc(name, function () {
      const env = Object.create(null);

      beforeEach(async () => {
        // Set up all fixtures.
        await Promise.all(fixtures.map((fixture) => fixture.setup(env)));
      });

      afterEach(() => {
        // Tear down all fixtures.
        for (const fixture of fixtures.slice(0).reverse()) {
          fixture.teardown(env);
        }

        // Delete all other keys.
        for (const key in env) {
          delete env[key];
        }
      });

      describe(SUB, function () {
        fn.call(this, env);
      });
    });
  };

  /**
   * @param {string} name
   * @param {function(!Object)} fn
   */
  const mainFunc = (name, fn) => {
    return templateFunc(name, fn, describe);
  };

  /**
   * @param {string} name
   * @param {function(!Object)} fn
   */
  mainFunc.only = (name, fn) => {
    return templateFunc(name, fn, describe./*OK*/ only);
  };

  mainFunc.skip = (name, fn) => {
    return templateFunc(name, fn, describe.skip);
  };

  return mainFunc;
}

/** @interface */
class Fixture {
  /** @return {boolean} */
  isOn() {}

  /**
   * @param {!Object} env
   * @return {!Promise|undefined}
   */
  setup(env) {}

  /**
   * @param {!Object} env
   */
  teardown(env) {}
}

/** @implements {Fixture} */
class SandboxFixture {
  constructor() {
    /** @private {boolean} */
    this.sandboxOwner_ = false;
  }

  /** @override */
  isOn() {
    return true;
  }

  /** @override */
  setup(env) {
    // Sandbox.
    let sandbox = global.sandbox;
    if (!sandbox) {
      sandbox = global.sandbox = sinon.createSandbox();
      this.sandboxOwner_ = true;
    }
    env.sandbox = sandbox;
  }

  /** @override */
  teardown(env) {
    // Sandbox.
    if (this.sandboxOwner_) {
      env.sandbox.restore();
      delete global.sandbox;
      this.sandboxOwner_ = false;
    }
  }
}

/** @implements {Fixture} */
class RealWinFixture {
  /** @override */
  isOn() {
    return true;
  }

  /** @override */
  setup(env) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      env.iframe = iframe;
      iframe.name = 'test_' + iframeCount++;
      iframe.srcdoc = '<!doctype><html><head><body style="margin:0">';
      iframe.onload = () => {
        const win = iframe.contentWindow;
        env.win = win;

        // Flag as being a test window.
        win.TEST_IFRAME = true;

        // Block external resource requests.
        doNotLoadExternalResourcesInTest(win);

        resolve();
      };
      iframe.onerror = reject;
      document.body.appendChild(iframe);
    });
  }

  /** @override */
  teardown(env) {
    // TODO(dvoytenko): test that window is returned in a good condition.
    if (env.iframe.parentNode) {
      env.iframe.parentNode.removeChild(env.iframe);
    }
  }
}

/**
 * For the given iframe, makes the creation of iframes and images
 * create elements that do not actually load their underlying
 * resources.
 * @param {!Window} win
 */
function doNotLoadExternalResourcesInTest(win) {
  const createElement = win.document.createElement;
  win.document.createElement = function (tagName) {
    const element = createElement.apply(this, arguments);

    // Only override iframes and images.
    tagName = tagName.toLowerCase();
    if (tagName !== 'iframe' && tagName !== 'img') {
      return element;
    }

    // Make get/set write to a fake property instead of
    // triggering invocation.
    element.fakeSrc = '';
    Object.defineProperty(element, 'src', {
      set: (val) => {
        element.fakeSrc = val;
      },
      get: () => {
        return element.fakeSrc;
      },
    });

    if (tagName == 'iframe') {
      element.srcdoc = '<h1>Fake iframe</h1>';
    }

    return element;
  };
}
