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

module.exports = (context) => ({
  ExportNamedDeclaration: ({declaration}) => {
    if (declaration?.type !== 'VariableDeclaration') {
      return;
    }

    const inits = declaration.declarations
      .map(({init}) => init)
      .filter((init) => init && /(?:Call|New)Expression/.test(init.type));
    for (const init of inits) {
      context.report({
        node: init,
        message: 'Cannot export side-effect',
      });
    }
  },
});
