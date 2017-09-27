/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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
 * Class to expose document level settings relevant to subscription platform.
 */
export class SubscriptionMarkup {
  /**
   * Creates a subscription markup class.
   * @param  {!Window} win
   */
  constructor(win) {
    this.win = win;

    this.accessType_ = null;
    this.accessContent_ = null;
    this.accessControl_ = null;
  }

  /**
   * @return {string} Returns the access type setting for a given page.
   */
  getAccessType() {
    if (this.accessType_ == null) {
      this.accessType_ = this.getMetaTag_('access-type');
    }
    return this.accessType_;
  }

  /**
   * @return {string} Returns the access content setting for a given page.
   */
  getAccessContent() {
    if (this.accessContent_ == null) {
      this.accessContent_ = this.getMetaTag_('access-content');
    }
    return this.accessContent_;
  }

  /**
   * @return {string} Returns the access control setting for a given page.
   */
  getAccessControl() {
    if (this.accessControl_ == null) {
      this.accessControl_ = this.getMetaTag_('access-control');
    }
    return this.accessControl_;
  }

  /**
   * Returns the value from content attribute of a meta tag with given name.
   *
   * If multiple tags are found, the first value is returned.
   *
   * @private
   * @param  {string} tagName The tag name to look for.
   * @return {string} attribute value or empty string.
   */
  getMetaTag_(tagName) {
    const el = this.win.document.querySelector(`meta[name="${tagName}"]`);
    if (el) {
      return el.getAttribute('content') || '';
    }
    return '';
  }
}
