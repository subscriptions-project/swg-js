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


import {ActivityIframeView} from '../ui/activity-iframe-view';
import {PayStartFlow} from './pay-flow';
import {feArgs, feUrl} from './services';


/**
 * The class for Offers flow.
 */
export class OffersFlow {

  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/offersiframe'),
        feArgs({
          'productId': deps.pageConfig().getProductId(),
          'publicationId': deps.pageConfig().getPublicationId(),
          'showNative': deps.callbacks().hasSubscribeRequestCallback(),
        }),
        /* shouldFadeBody */ true);
  }

  /**
   * Starts the offers flow or alreadySubscribed flow.
   * @return {!Promise}
   */
  start() {
    // If result is due to OfferSelection, redirect to payments.
    this.activityIframeView_.onMessage(result => {
      if (result['alreadySubscribed']) {
        this.deps_.callbacks().triggerLoginRequest({
          linkRequested: !!result['linkRequested'],
        });
        return;
      }
      if (result['sku']) {
        new PayStartFlow(
            this.deps_,
            /** @type {string} */ (result['sku']))
            .start();
        return;
      }
      if (result['native']) {
        this.deps_.callbacks().triggerSubscribeRequest();
        return;
      }
    });

    return this.dialogManager_.openView(this.activityIframeView_);
  }
}


/**
 * The class for subscribe option flow.
 */
export class SubscribeOptionFlow {

  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        deps.win(),
        this.activityPorts_,
        feUrl('/optionsiframe'),
        feArgs({
          'publicationId': deps.pageConfig().getPublicationId(),
        }),
        /* shouldFadeBody */ false);
  }

  /**
   * Starts the offers flow or alreadySubscribed flow.
   * @return {!Promise}
   */
  start() {
    this.activityIframeView_.onMessage(data => {
      this.maybeOpenOffersFlow_(data);
    });
    this.activityIframeView_.acceptResult().then(result => {
      this.maybeOpenOffersFlow_(result.data);
    });
    return this.dialogManager_.openView(this.activityIframeView_);
  }

  /**
   * @param {*} data
   * @private
   */
  maybeOpenOffersFlow_(data) {
    if (data && data['subscribe']) {
      new OffersFlow(this.deps_).start();
    }
  }
}


/**
 * The class for Abbreviated Offer flow.
 *
 */
export class AbbrvOfferFlow {

  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {

    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!HTMLDocument} */
    this.document_ = this.win_.document;

    /** @private @const {!web-activities /activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/abbrvofferiframe'),
        feArgs({
          'productId': deps.pageConfig().getProductId(),
          'publicationId': deps.pageConfig().getPublicationId(),
        }),
        /* shouldFadeBody */ true);
  }

  /**
   * Starts the offers flow
   * @return {!Promise}
   */
  start() {

    // If the user is already subscribed, trigger login flow
    this.activityIframeView_.onMessage(data => {
      if (data['alreadySubscribed'] && !data['loggedIn']) {
        this.deps_.callbacks().triggerLoginRequest();
        return;
      }
      // TODO(sohanirao) : Handle the case when user is logged in
    });
    console.log('view', this.activityIframeView_);
    // If result is due to requesting offers, redirect to offers flow
    this.activityIframeView_.acceptResult().then(result => {
      console.log(result);
      if (result.data['viewOffers']) {
        new OffersFlow(this.deps_).start();
      }
    });

    return this.dialogManager_.openView(this.activityIframeView_);
  }
}

