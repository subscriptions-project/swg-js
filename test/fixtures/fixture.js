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
 * Fixture script in ES5 to support control and direction inside a 3p iframe.
 */

/** @const */
const SENTINEL = '__FIXTURE__';

/**
 * @param {!Window} win
 * @constructor
 */
const Fixture = function (win) {
  /** @const {!Window} */
  this.win = win;

  /** @private @const {!Object<string, !Array<function(*)>>} */
  this.handlers_ = {};

  this.win.addEventListener('message', this.handleMessage_.bind(this));
  this.send('connect');
};

/**
 * @param {!MessageEvent} event
 * @param {function(*)} handler
 * @private
 */
Fixture.prototype.on = function (type, handler) {
  let handlers = this.handlers_[type];
  if (!handlers) {
    handlers = [];
    this.handlers_[type] = handlers;
  }
  handlers.push(handler);
};

/**
 * @param {string} type
 * @param {*} payload
 * @private
 */
Fixture.prototype.send = function (type, payload) {
  this.win.parent.postMessage(
    {
      'sentinel': SENTINEL,
      'type': type,
      'payload': payload,
    },
    '*'
  );
};

/**
 * @param {!MessageEvent} event
 * @private
 */
Fixture.prototype.handleMessage_ = function (event) {
  if (!event.data || event.data['sentinel'] != SENTINEL) {
    return;
  }
  const type = event.data['type'];
  const payload = event.data['payload'];
  const handlers = this.handlers_[type];
  if (handlers) {
    handlers.forEach(function (handler) {
      handler(payload);
    });
  }
};
