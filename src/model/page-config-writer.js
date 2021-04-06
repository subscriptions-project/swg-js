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

import {Doc, resolveDoc} from './doc'; // eslint-disable-line no-unused-vars
import {createElement} from '../utils/dom';
import {tryParseJson} from '../utils/json';

/**
 * Page configuration writer, which writes the details of the publication in the
 * JSON-LD markup of the page. If a valid, existing JSON-LD markup already
 * exists on the page, we will attempt to merge the values in the existing
 * markup with the values passed to this class, with the existing values taking
 * precedence.
 */
export class PageConfigWriter {
  /**
   * @param {!Window|!Document|!Doc} winOrDoc
   */
  constructor(winOrDoc) {
    /** @private @const {!Doc} */
    this.doc_ = resolveDoc(winOrDoc);

    /** @private {?{
     *   type: (string|!Array<string>),
     *   isAccessibleForFree: boolean,
     *   isPartOfType: (string|!Array<string>),
     *   isPartOfProductId: string,
     * }} */
    this.markupValues_ = null;

    /** @private {?function()} */
    this.configWrittenResolver_ = null;

    /** @private @const {!Promise} */
    this.configWrittenPromise_ = new Promise((resolve) => {
      this.configWrittenResolver_ = resolve;
    });
  }

  /**
   * Writes the markup to the DOM, when ready.
   * @param {{
   *   type: (string|!Array<string>),
   *   isAccessibleForFree: boolean,
   *   isPartOfType: (string|!Array<string>),
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
        const possibleConfigs = tryParseJson(element.textContent);
        if (!possibleConfigs) {
          continue;
        }

        // Support arrays of JSON objects.
        let possibleConfig;
        if (Array.isArray(possibleConfigs)) {
          possibleConfig = possibleConfigs[0];
        } else {
          possibleConfig = possibleConfigs;
        }

        // Merge the '@type' lists, and set the other fields, preferring the
        // existing values
        possibleConfig['@type'] = this.merge_(
          possibleConfig['@type'],
          this.markupValues_.type
        );
        possibleConfig['isAccessibleForFree'] =
          possibleConfig['isAccessibleForFree'] ||
          this.markupValues_.isAccessibleForFree;
        if (possibleConfig['isPartOf']) {
          possibleConfig['isPartOf']['@type'] = this.merge_(
            possibleConfig['isPartOf']['@type'],
            this.markupValues_.isPartOfType
          );
          possibleConfig['isPartOf']['productID'] =
            possibleConfig['isPartOf']['productID'] ||
            this.markupValues_.isPartOfProductId;
        } else {
          possibleConfig['isPartOf'] = isPartOfObj;
        }

        element.textContent = JSON.stringify(possibleConfigs);
        this.configWrittenResolver_();
        this.configWrittenResolver_ = null;
        return;
      }
    }

    // No valid existing ld+json markup to modify, so insert the markup in a new
    // script tag.
    const element = createElement(
      this.doc_.getWin().document,
      'script',
      {'type': 'application/ld+json'},
      JSON.stringify(obj)
    );
    this.doc_.getHead().appendChild(element);
    this.configWrittenResolver_();
    this.configWrittenResolver_ = null;
  }

  /*
   * @param {?Array|string} valueOne
   * @param {?Array|string} valueTwo
   * @return {Array|string}
   * @private
   */
  merge_(valueOne, valueTwo) {
    if (!valueOne && !valueTwo) {
      return [];
    }
    if (!valueOne) {
      return valueTwo;
    }
    if (!valueTwo) {
      return valueOne;
    }

    /** @type {Array} */
    const arrayOne = this.toArray_(valueOne);
    const arrayTwo = this.toArray_(valueTwo);
    const mergedArray = arrayOne.concat(
      arrayTwo.filter((item) => arrayOne.indexOf(item) < 0)
    );
    if (mergedArray.length == 1) {
      return mergedArray.pop();
    }
    return mergedArray;
  }

  /*
   * @param {?Array|string} value
   * @return {Array}
   * @private
   */
  toArray_(value) {
    return Array.isArray(value) ? value : [value];
  }
}
