/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
 * abstract View Class. Used to render the content within the Dialog. The
 * extended class has actual content.
 * @abstract
 */
export class View {

  /**
   * Empty constructor.
   */
  constructor() {}

  /**
   * Gets the iframe element.
   * @return {!Element}
   * @abstract
   */
  getElement() {}

  /**
   * @param {!./dialog.Dialog} unusedDialog
   * @return {!Promise}
   * @abstract
   */
  init(unusedDialog) {}

  /**
   * Resizes the content.
   */
  resized() {
    // Do nothing by default. Override if needed.
  }

  /**
   * @return {boolean}
   * @abstract
   */
  shouldFadeBody() {}

  /**
   * @return {boolean}
   * @abstract
   */
  shouldShowCloseAction() {}
}
