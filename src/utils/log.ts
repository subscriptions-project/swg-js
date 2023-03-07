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
 * Debug logger, only log message if #swg.log=1 exists in URL.
 */
export function debugLog(...args: unknown[]) {
  if (/swg.debug=1/.test(self.location.hash)) {
    args.unshift('[Subscriptions]');
    log(...args);
  }
}

export function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console /*OK*/
    .log(...args);
}

export function warn(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console /*OK*/
    .warn(...args);
}

/**
 * Throws an error if the first argument isn't trueish.
 *
 * Supports argument substitution into the message via %s placeholders.
 * @param shouldBeTrueish The value to assert. The assert fails if it does
 *     not evaluate to true.
 * @param message The assertion message
 * @param args Arguments substituted into %s in the message.
 */
export function assert(
  shouldBeTrueish: unknown,
  message = 'Assertion failed',
  ...args: unknown[]
): void {
  if (shouldBeTrueish) {
    return;
  }

  const splitMessage = message.split('%s');
  const first = splitMessage.shift();
  let formatted = first;
  for (const arg of args) {
    const nextConstant = splitMessage.shift();
    formatted += toString(arg) + nextConstant;
  }
  throw new Error(formatted);
}

function toString(val: any): string {
  // Do check equivalent to `val instanceof Element` without cross-window bug
  const possibleElement = val as Element;
  if (possibleElement?.nodeType == 1) {
    return (
      possibleElement.tagName.toLowerCase() +
      (possibleElement.id ? '#' + possibleElement.id : '')
    );
  }
  return String(val);
}
