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
'use strict';

const GLOBALS = Object.create(null);
GLOBALS.window = 'Use `self` instead.';
GLOBALS.document = 'Reference it as `self.document` or similar instead.';

module.exports = function (context) {
  return {
    Identifier: function (node) {
      const {name} = node;
      if (!(name in GLOBALS)) {
        return;
      }
      if (!/Expression/.test(node.parent.type)) {
        return;
      }

      if (
        node.parent.type === 'MemberExpression' &&
        node.parent.property === node
      ) {
        return;
      }

      const variable = getVariableByName(context.getScope(), node.name);
      if (variable.defs.length > 0) {
        return;
      }

      let message = 'Forbidden global `' + node.name + '`.';
      if (GLOBALS[name]) {
        message += ' ' + GLOBALS[name];
      }
      context.report({node, message});
    },
  };
};

/**
 * Finds the variable by a given name in a given scope and its upper scopes.
 * @param {eslint-scope.Scope} initScope A scope to start find.
 * @param {string} name A variable name to find.
 * @returns {eslint-scope.Variable|null} A found variable or `null`.
 */
function getVariableByName(initScope, name) {
  let scope = initScope;

  while (scope) {
    const variable = scope.set.get(name);

    if (variable) {
      return variable;
    }

    scope = scope.upper;
  }

  return null;
}
