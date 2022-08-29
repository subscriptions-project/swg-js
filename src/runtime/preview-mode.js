/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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
 * Preview mode manager
 */
import {Dialog} from '../components/dialog';
import {ErrorUtils} from '../utils/errors';
import {
  PREVIEW_FRAME_HTML,
  PREVIEW_FRAME_JS,
  PREVIEW_FRAME_STYLE,
} from './preview-frame';
import {parseQueryString} from '../utils/url';
import {removeElement} from '../utils/dom';
import {setImportantStyles} from '../utils/style';

// Singleton
let swgPreviewManager = null;

// Constants
const QUERY_KEY = 'swg.preview';
const SENTINEL = 'SWGPREV';
const MENU_HEIGHT = '56px';
const MAX_Z_INDEX = 2147483647;

const IMPORTANT_STYLES = {
  'opacity': '1',
  'position': 'fixed',
  'background': 'white',
  'color': 'black',
  'inset': '0 0 auto auto',
  'top': '0',
  'left': 'auto',
  'bottom': 'auto',
  'height': MENU_HEIGHT,
  'max-height': '70vh',
  'right': '0',
  'min-width': '320px',
  'width': '70vw',
  'z-index': MAX_Z_INDEX,
  'border': '1px solid black',
  'visibility': 'visible',
};

const DIALOG_CONFIG = {
  iframeCssClassOverride: 'swg-preview-dialog',
  isCenterPositioned: false,
};

// Keys to skip when stringifying
const SKIPPED_KEYS = [
  'isReadyToPay',
  'raw',
  'usePrefixedHostPath',
  'useUpdatedOfferFlows',
  'skipAccountCreationScreen',
  'product_',
];

// Period units
const UNITS = {
  'D': 'day',
  'M': 'month',
  'Y': 'year',
};

/**
 * @typedef {{
 *   name: string,
 *   previewCallback: function(*),
 *   cbParams: Array,
 * }} PreviewOption
 **/
export let PreviewOption;

/**
 * Singleton class to manage preview/debug mode
 * dialog state and avoid having to pass runtime with every call
 */
export class PreviewManager {
  /**
   * initialize the singlton preview manager
   * @param {!../runtime/runtime.ConfiguredRuntime} runtime
   */
  static init(runtime) {
    // Check hash, preview mode requested

    try {
      const query = parseQueryString(runtime.win().location.hash);
      if (!query[QUERY_KEY]) {
        return; // If preview is not enabled bail
      }
      // Create the singleton if needed
      if (!swgPreviewManager) {
        swgPreviewManager = new PreviewManager(runtime, query[QUERY_KEY]);
      }
    } catch (e) {
      // Ignore: query parsing cannot block runtime.
      ErrorUtils.throwAsync(e);
      return;
    }
  }

  /**
   * isPreviewEnabled
   * @public
   * @returns {boolean}
   */
  static isPreviewEnabled() {
    return !!swgPreviewManager;
  }

  /**
   * getPreviewManager
   * @returns{?PreviewManager}
   */
  static getPreviewManager() {
    return swgPreviewManager;
  }

  /**
   * @param {!../runtime/runtime.ConfiguredRuntime} runtime
   * @param {string} level
   */
  constructor(runtime, level) {
    /** @private @const {!../runtime/runtime.ConfiguredRuntime} */
    this.runtime_ = runtime;

    /** @private @const {string} */
    this.level_ = level;

    /** @private @const */
    this.globalDoc_ = runtime.doc();
    /** @private @const */
    this.doc_ = this.globalDoc_.getRootNode();

    /** @private {?Promise} */
    this.openPromise_ = null;

    /** @private {?Document} */
    this.frameDoc_ = null;

    /** @private {?Element} */
    this.frameElement_ = null;

    /** @private {!Array<!string>} */
    this.errorsDetected = [];

    this.dialog_ = new Dialog(
      this.globalDoc_,
      IMPORTANT_STYLES,
      /* styles */ {},
      DIALOG_CONFIG
    );

    /**
     * available preview functions
     * @private {!Array<PreviewOption>}
     */
    this.availablePreviews_ = [];

    // Init our listner and window
    addEventListener('message', (e) => this.messageHandler_(e), false);

    this.openPromise_ = this.dialog_.open(true);
    this.openPromise_.then((previewDialog) => {
      this.frameElement_ = previewDialog.getElement();
      setImportantStyles(this.frameElement_, IMPORTANT_STYLES);
      this.frameDoc_ = this.frameElement_.contentWindow.document;

      // Add some Styles
      const previewStyle = this.frameDoc_.createElement('style');
      previewStyle.textContent = PREVIEW_FRAME_STYLE;
      this.frameDoc_.head.appendChild(previewStyle);

      // and our minimal script
      const previewScript = this.frameDoc_.createElement('script');
      previewScript.textContent = PREVIEW_FRAME_JS;
      this.frameDoc_.head.appendChild(previewScript);

      previewDialog.getContainer().innerHTML = PREVIEW_FRAME_HTML;

      this.setPageConfig();

      this.tidy_();
    });
  }

  /**
   * messaheHandler
   * @param {!Event} message
   * @private
   */
  messageHandler_(message) {
    if (message.data.sentinel != SENTINEL || !message.data.target) {
      return;
    }

    switch (message.data.target) {
      case 'close':
        this.exit_();
        break;
      case 'ents':
      case 'conf':
      case 'prev':
        this.show_(message.data.target);
        break;
      case 'tidy':
        this.tidy_();
        break;
      case 'subscription':
        this.tidy_(); // hide the menu
        //this.runtime_.showSubscribeOption();
        this.runtime_.showOffers();
        break;
      case 'contribution':
        this.tidy_();
        this.runtime_.showContributionOptions();
        break;
    }
  }

  /**
   * exit preview mode, delete our frame and remove the manager instance.
   */
  exit_() {
    if (this.frameElement_) {
      removeElement(this.frameElement_);
    }
    swgPreviewManager = null;
  }

  /**
   * resize the preview frame
   * @param {string} pane;
   */
  expand_(pane) {
    const elementHeight = this.frameDoc_.getElementById(
      `${pane}Data`
    ).scrollHeight;
    this.frameDoc_.body.classList.add('expand');
    this.frameElement_.style.setProperty(
      'height',
      `${elementHeight + 100}px`,
      'important'
    );
  }

  /**
   * show a pane
   * @param {string} pane
   */
  show_(pane) {
    this.hideData_();
    this.frameDoc_.getElementById(`${pane}`).classList.add('active');
    this.frameDoc_.getElementById(`${pane}Data`).classList.add('show');
    this.expand_(pane);
  }

  /**
   * tidy - hide data panes and go back to small menu
   * @private
   */
  tidy_() {
    // Restore the  z-index of swg-dialogs
    [...this.doc_.getElementsByClassName('swg-dialog')].forEach((dialog) =>
      setImportantStyles(dialog, {'z-index': MAX_Z_INDEX})
    );
    this.frameElement_.style.setProperty('height', MENU_HEIGHT, 'important');
    this.frameDoc_.body.classList.remove('expand');
    this.hideData_();
  }

  /**
   * Hide the data elements
   * @private
   */
  hideData_() {
    const dataElements = [...this.frameDoc_.getElementsByClassName('show')];
    dataElements.forEach((el) => el.classList.remove('show'));
    const menuElements = [...this.frameDoc_.getElementsByClassName('active')];
    menuElements.forEach((el) => el.classList.remove('active'));
  }

  /**
   * build the preview menu
   * @param {ClientConfig} clientConfig;
   * @private
   */
  buildPreviewMenu_(clientConfig) {
    if (clientConfig.previewAvailable) {
      /* TODO:(jpettitt) customized the menu based on config */
    }
  }

  /**
   * setPageConfig
   * @public
   */
  setPageConfig() {
    this.openPromise_.then(() => {
      this.frameDoc_.getElementById('pageConfig').innerText = JSON.stringify(
        this.runtime_.pageConfig(),
        (key, value) => this.replacer_(key, value),
        /* spaces */ 2
      );
    });
  }

  /**
   * setClientConfig
   * @param {!../model/client-config.ClientConfig} clientConf
   * @public
   */
  setClientConfig(clientConf) {
    const clientConfig = /** @type {!JsonObject} */ clientConf;
    this.openPromise_
      .then(() => {
        this.frameDoc_.getElementById('clientConfig').innerText =
          JSON.stringify(
            clientConfig,
            (key, value) => this.replacer_(key, value),
            /* spaces */ 2
          );
        if (clientConfig.previewAvailable || this.level_ == 'debug') {
          this.buildPreviewMenu_(clientConfig);
          return 'prev';
        } else {
          this.frameDoc_.getElementById('prev').remove();
          return 'conf';
        }
      })
      .then((pane) => {
        this.show_(pane);
      });
  }

  /**
   * setEntitlements
   * @param {!../api/entitlements.Entitlements} entitlements
   * @public
   */
  setEntitlements(entitlements) {
    const ents = /** @type {JsonObject} */ entitlements;
    this.openPromise_.then(() => {
      this.frameDoc_.getElementById('entitlementDetail').innerText =
        JSON.stringify(
          ents,
          (key, value) => this.replacer_(key, value),
          /* spaces */ 2
        );
    });
  }

  /**
   * replacer - sugar to remove keys from stringify
   * @param {string} key
   * @param {*} value
   * @returns {*}
   * @private
   */
  replacer_(key, value) {
    // Expand json subscription tokens
    if (key == 'subscriptionToken' && /^{\"/.test(value)) {
      try {
        value = JSON.parse(value.replace('\\"', '"'));
      } catch (e) {
        // ignore parse failures
      }
    }
    // Change decrypted key to N/A if we're not in debug
    if (
      this.level_ != 'debug' &&
      key == 'decryptedDocumentKey' &&
      value === null
    ) {
      value = 'N/A (plain text document)';
    }
    // If we're in debug mode show all the keys
    // Otherwsie skip the ones in the SKIPPED_KEYS array
    if (this.level_ != 'debug' && SKIPPED_KEYS.indexOf(key) != -1) {
      return undefined;
    }
    // Expand Periods
    if (key && /Period$/.test(key)) {
      const [val, period, unit] = value.match(/P(\d+)(.)$/);
      return `${val} (per ${period} ${
        period == 1 ? UNITS[unit] : UNITS[unit] + 's'
      })`;
    }
    return value;
  }

  /**
   * showPreviewResult
   * @public
   * @param {!../model/client-config.ClientConfig} clientConfig
   * @param {!../api/subscriptions.SubscriptionRequest} subscriptionRequest
   * @param {!../api/subscriptions.ProductType} productType
   */
  showPreviewResult(clientConfig, subscriptionRequest, productType) {
    // Move the swGFrame down one layer so we overlay it.
    [...this.doc_.getElementsByClassName('swg-dialog')].forEach((dialog) =>
      setImportantStyles(dialog, {'z-index': MAX_Z_INDEX - 1})
    );
    // Get the offers now becasue we need to page
    // config to be valid before we can do it
    /** @type {!../api/subscriptions.Subscriptions} */
    (this.runtime_).getOffers().then((offers) => {
      // Find the offer that matches this sku
      const [selectedOffer] = offers.filter((offer) => {
        return offer.skuId == subscriptionRequest.skuId;
      });
      // Show what the user clicked
      const prodInfo = JSON.stringify(
        selectedOffer,
        (key, value) => this.replacer_(key, value),
        /* spaces */ 2
      );
      this.frameDoc_.getElementById(
        'previewResultData'
      ).innerText = `Product type: ${productType.replace(
        'UI_',
        ''
      )}\n${prodInfo}`;
      this.frameDoc_.getElementById('previewResult').classList.remove('hidden');
      this.show_('prev');
    });
  }
}
