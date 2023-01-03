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

/**
 * Babel plugin to replace usages of `goog.define` with
 * either the overrides provided in options or the default
 * value provided to the caller.
 */
module.exports = function (babel) {
  const {types: t} = babel;

  function isGoogDefine(node) {
    return (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.object, {
        name: 'goog',
      }) &&
      t.isIdentifier(node.callee.property, {
        name: 'define',
      })
    );
  }

  return {
    name: 'transform-define-constants',
    visitor: {
      VariableDeclarator(path, state) {
        if (isGoogDefine(path.node.init)) {
          if (
            state.opts.replacements &&
            state.opts.replacements[path.node.id.name] != null
          ) {
            path.node.init = t.stringLiteral(
              state.opts.replacements[path.node.id.name]
            );
          } else {
            path.node.init = path.node.init.arguments[1];
          }
        }
      },
    },
  };
};
