/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
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

import {Doc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {Storage} from '../runtime/storage';
import {StorageKeys} from '../utils/constants';
import {addQueryParams} from '../utils/url';
import {createElement} from '../utils/dom';
import {feUrl} from './services';
import {setImportantStyles} from '../utils/style';

/**
 * The states of the GisInteropManager.
 */
export enum GisInteropManagerStates {
  WAITING_FOR_PING,
  LOADING_COMMUNICATION_IFRAME,
  COMMUNICATION_IFRAME_ESTABLISHED,
  YIELDED,
}

type RrmGisMsgType =
  // Initial message from gis.js to swg.js for establishing the handshake.
  | 'RRM_GIS_PING'
  // Acknowledgement from swg.js to gis.js for establishign the handshake.
  | 'RRM_GIS_ACK'
  // Message from the secure channel to swg.js notifying it has loaded.
  | 'RRM_GIS_IFRAME_LOADED_RRM'
  // Message from the secure channel to gis.js notifying it has loaded.
  | 'RRM_GIS_IFRAME_LOADED_GIS'
  // Final two-way message from swg.js to gis.js to establish the handshake.
  | 'RRM_GIS_READY_RRM'
  // Final two-way message from gis.js to swg.js to establish the handshake.
  | 'RRM_GIS_READY_GIS'
  // Message from gis.js to swg.js with the settings needed to start a login flow.
  | 'RRM_GIS_SETTINGS'
  // Message from swg.js to gis.js yeilding control of showing the prompt.
  | 'RRM_GIS_YIELD'
  // Message from the secure channel to swg.js with the updated token.
  | 'RRM_GIS_ID_TOKEN'
  // Request for swg.js to provide the secure channel a SwgUserToken for the sync flow.
  | 'RRM_GIS_TOKEN_UPDATE_START'
  // Message from swg.js to the secure channel for the sync flow.
  | 'RRM_GIS_SWG_USER_TOKEN'
  // Message from the secure channel to swg.js with the updated token.
  | 'RRM_GIS_TOKEN_UPDATED'
  // Message from swg.js to gis.js indicating that the page can be redirected.
  | 'RRM_GIS_REDIRECT_OK'
  // Message indicating an error.
  | 'RRM_GIS_ERROR';

function isType(ev: MessageEvent, type: RrmGisMsgType): boolean {
  return ev.data.type === type;
}

function hasSessionId(ev: MessageEvent): boolean {
  return typeof ev.data.sessionId === 'string' && ev.data.sessionId.length > 0;
}

function hasSwgUserToken(ev: MessageEvent): boolean {
  return (
    typeof ev.data.swgUserToken === 'string' && ev.data.swgUserToken.length > 0
  );
}

export class GisInteropManager {
  private state = GisInteropManagerStates.WAITING_FOR_PING;
  // UUID for the connection between swg.js and gis.js. Established in initial PING from gis.js.
  private sessionId?: string;
  // Secure channel to pass secrets between swg.js and gis.js.
  private communicationIframe?: HTMLIFrameElement;
  // Whether the communication iframe has loaded.
  private iframeLoaded = false;
  // Whether gis.js is ready to receive messages through the communication iframe.
  private gisReady = false;
  private readonly messageHandlerBound = this.messageHandler.bind(this);

  constructor(
    private readonly doc: Doc,
    private readonly storage: Storage,
    private readonly entitlementsManager: EntitlementsManager
  ) {
    this.doc.getWin().addEventListener('message', this.messageHandlerBound);
  }

  public getState(): GisInteropManagerStates {
    return this.state;
  }

  public yield() {
    if (
      this.state !== GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED
    ) {
      return;
    }
    this.state = GisInteropManagerStates.YIELDED;
    this.doc.getWin().removeEventListener('message', this.messageHandlerBound);
    setTimeout(() => {
      this.communicationIframe?.remove();
    }, 1000);
  }

  private messageHandler(ev: MessageEvent) {
    if (this.state === GisInteropManagerStates.WAITING_FOR_PING) {
      this.handleWaitingForPingState(ev);
    } else if (
      this.state === GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
    ) {
      this.handleLoadingCommunicationIframeState(ev);
    } else if (
      this.state === GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED
    ) {
      this.handleCommunicationIframeEstablishedState(ev);
    }
  }

  private handleWaitingForPingState(e: MessageEvent) {
    if (!isType(e, 'RRM_GIS_PING') || !hasSessionId(e)) {
      return;
    }

    this.state = GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME;

    this.sessionId = e.data.sessionId;

    this.reply(e, {type: 'RRM_GIS_ACK'});

    const src = addQueryParams(feUrl('/rrmgisinterop'), {
      'sessionId': this.sessionId!,
      'origin': this.doc.getWin().origin,
      'rrmOrigin': this.doc.getWin().origin,
      'gisOrigin': e.origin,
      'role': 'RRM',
    });

    this.communicationIframe = createElement(this.doc.getRootNode(), 'iframe', {
      'src': src,
      'tabindex': '-1',
      'aria-hidden': 'true',
    }) as HTMLIFrameElement;

    setImportantStyles(this.communicationIframe, {
      'width': '0',
      'height': '0',
      'border': 'none',
      'position': 'absolute',
      'visibility': 'hidden',
    });

    this.doc.getBody()?.appendChild(this.communicationIframe);
  }

  private handleLoadingCommunicationIframeState(e: MessageEvent) {
    if (this.invalidSessionId(e)) {
      return;
    }

    if (isType(e, 'RRM_GIS_IFRAME_LOADED_RRM')) {
      this.reply(e, {type: 'RRM_GIS_READY_RRM'});
      this.iframeLoaded = true;
    } else if (isType(e, 'RRM_GIS_READY_GIS')) {
      this.gisReady = true;
    }

    if (this.iframeLoaded && this.gisReady) {
      this.state = GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED;
    }
  }

  private async handleCommunicationIframeEstablishedState(e: MessageEvent) {
    if (this.invalidSessionId(e) || !this.fromIframe(e)) {
      return;
    }

    if (isType(e, 'RRM_GIS_TOKEN_UPDATE_START')) {
      const swgUserToken = await this.storage.get(StorageKeys.USER_TOKEN, true);
      this.reply(e, {type: 'RRM_GIS_SWG_USER_TOKEN', swgUserToken});
    } else if (isType(e, 'RRM_GIS_TOKEN_UPDATED') && hasSwgUserToken(e)) {
      await this.entitlementsManager.updateEntitlements(e.data.swgUserToken);
      this.reply(e, {type: 'RRM_GIS_REDIRECT_OK'});
    }
  }

  private reply(ev: MessageEvent, msg: Record<string, unknown>) {
    ev.source?.postMessage(
      {
        ...msg,
        sessionId: this.sessionId,
      },
      {
        targetOrigin: ev.origin,
      }
    );
  }

  private fromIframe(ev: MessageEvent): boolean {
    return ev.source === this.communicationIframe?.contentWindow;
  }

  private invalidSessionId(ev: MessageEvent): boolean {
    return !hasSessionId(ev) || ev.data.sessionId !== this.sessionId;
  }
}
