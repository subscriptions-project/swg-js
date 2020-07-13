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
 * methods. For each test method, it takes an additional `spec` parameter and
 * returns an `env` object containing mocks, etc. that help testing.
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
 *     // Note the second `spec` param, and the returned `env` object.
 *     describes.sandboxed('myTest', {}, env => {
 *       it('stubbing', () => { env.sandbox.stub(foo, 'bar'); });
 *     });
 *
 * In addition to `sandboxed()`, describes.js has three other modes of
 * operation (that actually all support `env.sandbox`):
 *
 * 1. `sandboxed()` just helps you set up and tear down a sinon sandbox.
 *    Use this to save some sinon boilerplate code.
 *
 * 2. `realWin()` provides a real Window in an embedded iframe in `env.win`.
 *    Use this when you're testing APIs that need a real DOM.
 *
 * The returned `env` object contains different objects depending on (A) the
 * mode of operation and (B) the `spec` object you provide it.
 *
 * The are more advanced usages of the various `spec` and returned `env`
 * objects. See the type definitions for `sandboxed` and `realWin` below.
 */

import 'regenerator-runtime/runtime';
import * as sinon from 'sinon';

/** Should have something in the name, otherwise nothing is shown. */
const SUB = ' ';

/** @type {number} */
let iframeCount = 0;

/**
 * @typedef {{
 * }}
 */
export let TestSpec;

/**
 * A test with a sandbox.
 * @param {string} name
 * @param {!TestSpec} spec
 * @param {function()} fn
 */
export const sandboxed = describeEnv(spec => []);

/**
 * A test with a real (iframed) window.
 * @param {string} name
 * @param {{}} spec
 * @param {function({
 *   win: !Window,
 *   iframe: !HTMLIFrameElement,
 * })} fn
 */
export const realWin = describeEnv(spec => [new RealWinFixture(spec)]);

/**
 * A test with a real fixture window.
 * @param {string} name
 * @param {{}} spec
 * @param {function({
 *   win: !Window,
 *   iframe: !HTMLIFrameElement,
 *   fixture: !IntegrationFixtureController,
 * })} fn
 */
export const fixture = describeEnv(spec => [
  new RealWinFixture(Object.assign(spec, {allowExternalResources: true})),
  new IntegrationFixture(spec),
]);

/**
 * A repeating test.
 * @param {string} name
 * @param {!Object<string, *>} variants
 * @param {function(string, *)} fn
 */
export const repeated = (function() {
  /**
   * @param {string} name
   * @param {!Object<string, *>} variants
   * @param {function(string, *)} fn
   * @param {function(string, function())} describeFunc
   */
  const templateFunc = function(name, variants, fn, describeFunc) {
    return describeFunc(name, function() {
      for (const name in variants) {
        describe(name ? ` ${name} ` : SUB, function() {
          fn.call(this, name, variants[name]);
        });
      }
    });
  };

  /**
   * @param {string} name
   * @param {!Object<string, *>} variants
   * @param {function(string, *)} fn
   */
  const mainFunc = function(name, variants, fn) {
    return templateFunc(name, variants, fn, describe);
  };

  /**
   * @param {string} name
   * @param {!Object<string, *>} variants
   * @param {function(string, *)} fn
   */
  mainFunc.only = function(name, variants, fn) {
    return templateFunc(name, variants, fn, describe./*OK*/ only);
  };

  return mainFunc;
})();

/**
 * Returns a wrapped version of Mocha's describe(), it() and only() methods
 * that also sets up the provided fixtures and returns the corresponding
 * environment objects of each fixture to the test method.
 * @param {function(!Object):!Array<?Fixture>} factory
 */
function describeEnv(factory) {
  /**
   * @param {string} name
   * @param {!Object} spec
   * @param {function(!Object)} fn
   * @param {function(string, function())} describeFunc
   */
  const templateFunc = function(name, spec, fn, describeFunc) {
    const fixtures = [new SandboxFixture(spec)];
    factory(spec).forEach(fixture => {
      if (fixture && fixture.isOn()) {
        fixtures.push(fixture);
      }
    });
    return describeFunc(name, function() {
      const env = Object.create(null);

      beforeEach(() => {
        let totalPromise = undefined;
        // Set up all fixtures.
        fixtures.forEach((fixture, index) => {
          if (totalPromise) {
            totalPromise = totalPromise.then(() => fixture.setup(env));
          } else {
            const res = fixture.setup(env);
            if (res && typeof res.then == 'function') {
              totalPromise = res;
            }
          }
        });
        return totalPromise;
      });

      afterEach(() => {
        // Tear down all fixtures.
        fixtures
          .slice(0)
          .reverse()
          .forEach(fixture => {
            fixture.teardown(env);
          });

        // Delete all other keys.
        for (const key in env) {
          delete env[key];
        }
      });

      describe(SUB, function() {
        fn.call(this, env);
      });
    });
  };

  /**
   * @param {string} name
   * @param {!Object} spec
   * @param {function(!Object)} fn
   */
  const mainFunc = function(name, spec, fn) {
    return templateFunc(name, spec, fn, describe);
  };

  /**
   * @param {string} name
   * @param {!Object} spec
   * @param {function(!Object)} fn
   */
  mainFunc.only = function(name, spec, fn) {
    return templateFunc(name, spec, fn, describe./*OK*/ only);
  };

  mainFunc.skip = function(name, variants, fn) {
    return templateFunc(name, variants, fn, describe.skip);
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
  /** @param {!TestSpec} spec */
  constructor(spec) {
    /** @const */
    this.spec = spec;

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
  /** @param {!{
   *   allowExternalResources: boolean,
   * }} spec */
  constructor(spec) {
    /** @const */
    this.spec = spec;
  }

  /** @override */
  isOn() {
    return true;
  }

  /** @override */
  setup(env) {
    const spec = this.spec;
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      env.iframe = iframe;
      iframe.name = 'test_' + iframeCount++;
      iframe.srcdoc = '<!doctype><html><head><body style="margin:0">';
      iframe.onload = function() {
        const win = iframe.contentWindow;
        env.win = win;

        // Flag as being a test window.
        win.TEST_IFRAME = true;

        if (!spec.allowExternalResources) {
          doNotLoadExternalResourcesInTest(win);
        }

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

/** @implements {Fixture} */
class IntegrationFixture {
  /**
   * @param {!{}} spec
   */
  constructor(spec) {
    /** @const */
    this.spec = spec;
  }

  /** @override */
  isOn() {
    return true;
  }

  /** @override */
  setup(env) {
    const win = env.win;
    const iframe = win.document.createElement('iframe');
    env.iframe = iframe;
    iframe.name = 'test_' + iframeCount++;
    env.fixtureUrl = function(name, hostPrefix) {
      const loc = win.top.location;
      return (
        loc.protocol +
        '//' +
        (hostPrefix ? hostPrefix + '.' : '') +
        loc.host +
        '/test/fixtures/' +
        name +
        '.html'
      );
    };
    const fixture = new IntegrationFixtureController(win, iframe);
    env.fixture = fixture;
    win.document.body.appendChild(iframe);
  }

  /** @override */
  teardown(env) {
    if (env.fixture) {
      env.fixture.disconnect();
    }
    if (env.iframe.parentNode) {
      env.iframe.parentNode.removeChild(env.iframe);
    }
  }
}

/**
 */
class IntegrationFixtureController {
  /**
   * @param {!Window} parent
   * @param {!HTMLIFrameElement} iframe
   */
  constructor(parent, iframe) {
    this.parent = parent;
    this.iframe = iframe;
    this.win = null;
    this.connectedResolver_ = null;
    this.connected_ = new Promise(resolve => {
      this.connectedResolver_ = resolve;
    });
    this.handlers_ = {};
    this.handleMessage_ = this.handleMessage_.bind(this);
    parent.addEventListener('message', this.handleMessage_);
  }

  /**
   * @return {!Promise}
   */
  connected() {
    return this.connected_;
  }

  /**
   */
  disconnect() {
    parent.removeEventListener('message', this.handleMessage_);
  }

  /**
   * @param {!MessageEvent} event
   * @private
   */
  handleMessage_(event) {
    if (
      event.source != this.iframe.contentWindow ||
      !event.data ||
      event.data['sentinel'] != '__FIXTURE__'
    ) {
      return;
    }
    if (!this.win) {
      this.win = this.iframe.contentWindow;
    }
    const type = event.data['type'];
    const payload = event.data['payload'];
    if (type == 'connect') {
      this.connectedResolver_();
      this.connectedResolver_ = null;
    } else {
      const handlers = this.handlers_[type];
      if (handlers) {
        handlers.forEach(handler => {
          handler(payload);
        });
      }
    }
  }

  /**
   * @param {string} type
   * @param {function(*)} handler
   */
  on(type, handler) {
    let handlers = this.handlers_[type];
    if (!handlers) {
      handlers = [];
      this.handlers_[type] = handlers;
    }
    handlers.push(handler);
  }

  /**
   * @param {string} type
   * @param {*} data
   */
  send(type, payload) {
    this.win.postMessage(
      {
        sentinel: '__FIXTURE__',
        type,
        payload,
      },
      '*'
    );
  }
}

/**
 * For the given iframe, makes the creation of iframes and images
 * create elements that do not actually load their underlying
 * resources.
 * Calling `triggerLoad` makes the respective resource appear loaded.
 * Calling `triggerError` on the respective resources makes them
 * appear in error state.
 * @param {!Window} win
 */
function doNotLoadExternalResourcesInTest(win) {
  const createElement = win.document.createElement;
  win.document.createElement = function(tagName) {
    const element = createElement.apply(this, arguments);
    tagName = tagName.toLowerCase();
    if (tagName == 'iframe' || tagName == 'img') {
      // Make get/set write to a fake property instead of
      // triggering invocation.
      element.fakeSrc = '';
      Object.defineProperty(element, 'src', {
        set: function(val) {
          this.fakeSrc = val;
        },
        get: function() {
          return this.fakeSrc;
        },
      });
      // Triggers a load event on the element in the next micro task.
      element.triggerLoad = function() {
        const e = new Event('load');
        Promise.resolve().then(() => {
          this.dispatchEvent(e);
        });
      };
      // Triggers an error event on the element in the next micro task.
      element.triggerError = function() {
        const e = new Event('error');
        Promise.resolve().then(() => {
          this.dispatchEvent(e);
        });
      };
      if (tagName == 'iframe') {
        element.srcdoc = '<h1>Fake iframe</h1>';
      }
    }
    return element;
  };
}
