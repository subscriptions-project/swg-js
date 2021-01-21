/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

import {ALLOWED_TYPES, TypeChecker} from '../model/page-config-resolver';
import {createElement} from '../utils/dom';
import {resolveDoc} from './doc';
import {tryParseJson} from '../utils/json';

/**
 * Page configuration writer, which writes the markup detailing the publication
 * in the JSON-LD markup of the page. If a valid, existing JSON-LD markup
 * already exists on the page, we will attempt to merge the values in the
 * existing markup with the values passed to this class, with the existing
 * values taking precedence.
 */
export class PageConfigWriter {
  /**
   * @param {!Window|!Document|!Doc} winOrDoc
   */
  constructor(winOrDoc) {
    /** @private @const {!Doc} */
    this.doc_ = resolveDoc(winOrDoc);

    /** @private @const {?Map} */
    this.markupValues_ = null;

    /** @private {?function(!Promise)} */
    this.configWrittenResolver_ = null;

    /** @private @const {!Promise} */
    this.configWrittenPromise_ = new Promise((resolve) => {
      this.configWrittenResolver_ = resolve;
    });

    /** @private @const @function */
    this.checkType_ = new TypeChecker();
  }

  /**
   * Writes the markup to the DOM, when ready.
   * @param {{
   *   type: string,
   *   isAccessibleForFree: boolean,
   *   isPartOfType: !Array<string>,
   *   isPartOfProductId: string,
   * }} markupValues
   * @return {!Promise} */
  writeConfigWhenReady(markupValues) {
    this.markupValues_ = markupValues;
    this.doc_.whenReady().then(() => {
      this.writeConfig_();
    });
    return this.configWrittenPromise_;
  }

  /** Parses the DOM and modifies it to include the new markup values. */
  writeConfig_() {
    // Already resolved.
    if (!this.configWrittenResolver_) {
      return;
    }

    // Create the markup object according to values specified in the parameters.
    const isPartOfObj = {
      'productID': this.markupValues_.isPartOfProductId,
      '@type': this.markupValues_.isPartOfType,
    };
    const obj = {
      '@type': this.markupValues_.type,
      'isAccessibleForFree': this.markupValues_.isAccessibleForFree,
      'isPartOf': isPartOfObj,
    };

    // Try to find an existing ld+json markup to update, if one exists.
    const elements = this.doc_
      .getRootNode()
      .querySelectorAll('script[type="application/ld+json"]');
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.textContent) {
        let possibleConfigs = tryParseJson(element.textContent);
        if (!possibleConfigs) {
          continue;
        }

        // Support arrays of JSON objects.
        const isPossibleConfigsInArray = Array.isArray(possibleConfigs);
        if (!isPossibleConfigsInArray) {
          possibleConfigs = [possibleConfigs];
        }
        for (let i = 0; i < possibleConfigs.length; i++) {
          const possibleConfig = possibleConfigs[i];

          // If there is a type specified, it must be an ALLOWED_TYPE, since we
          // are preserving existing values over values specified in the config
          // params.
          if (
            !possibleConfig['@type'] ||
            this.checkType_.checkValue(possibleConfig['@type'], ALLOWED_TYPES)
          ) {
            Object.assign(obj, possibleConfig);
            // Also merge the isPartOf nested object, since Object.assign does
            // not merge nested objects.
            Object.assign(isPartOfObj, possibleConfig['isPartOf']);
            obj['isPartOf'] = isPartOfObj;
            possibleConfigs[i] = obj;

            element.textContent = JSON.stringify(
              isPossibleConfigsInArray ? possibleConfigs : possibleConfigs[i]
            );
            this.configWrittenResolver_();
            this.configWrittenResolver_ = null;
            return;
          }
        }
      }
    }

    // No valid existing ld+json markup to modify, so insert the markup in a new
    // script tag.
    const element = createElement(
      this.doc_.getRootNode(),
      'script',
      {'type': 'application/ld+json'},
      JSON.stringify(obj)
    );
    this.doc_.getHead().appendChild(element);
    this.configWrittenResolver_();
    this.configWrittenResolver_ = null;
  }
}
