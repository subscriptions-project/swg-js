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
}

const RRM_GIS_MSG_TYPE = [
  // Initial message from gis.js to swg.js for establishing the handshake.
  'RRM_GIS_PING',
  // Acknowledgement from swg.js to gis.js for establishign the handshake.
  'RRM_GIS_ACK',
  // Message from the secure channel to swg.js and gis.js notifying them it has loaded.
  'RRM_GIS_IFRAME_LOADED',
  // Final two-way message between swg.js and gis.js to establish the handshake.
  'RRM_GIS_READY',
  // Message from gis.js to swg.js with the settings needed to start a login flow.
  'RRM_GIS_SETTINGS',
  // Message from swg.js to gis.js yeilding control of showing the prompt.
  'RRM_GIS_YIELD',
  // Message from an RRM prompt to gis.js with a id token to be handled.
  'RRM_GIS_LOGIN',
  // Message from the secure channel to swg.js with the updated token.
  'RRM_GIS_ID_TOKEN',
  // Request for swg.js to provide the secure channel a SwgUserToken for the sync flow.
  'RRM_GIS_TOKEN_UPDATE_START',
  // Message from swg.js to the secure channel for the sync flow.
  'RRM_GIS_SWG_USER_TOKEN',
  // Message from the secure channel to swg.js with the updated token.
  'RRM_GIS_TOKEN_UPDATED',
  // Message from swg.js to gis.js indicating that the page can be redirected.
  'RRM_GIS_REDIRECT_OK',
  // Message indicating an error.
  'RRM_GIS_ERROR',
] as const;

export class GisInteropManager {
  private state = GisInteropManagerStates.WAITING_FOR_PING;
  // UUID for the connection between swg.js and gis.js. Established in initial PING from gis.js.
  private sessionId?: string;
  // The source of the message from gis.js.
  private gisSource: MessageEventSource | null = null;
  // The origin of the message from gis.js.
  private sourceOrigin?: string;
  // Secure channel to pass secrets between swg.js and gis.js.
  private communicationIframe?: HTMLIFrameElement;
  // Whether the communication iframe has loaded.
  private iframeLoaded = false;
  // Whether gis.js is ready to receive messages through the communication iframe.
  private gisReady = false;
  private readonly messageHandlerValue = this.messageHandler.bind(this);

  constructor(private readonly doc: Doc) {
    this.doc.getWin().addEventListener('message', this.messageHandlerValue);
  }

  public getState(): GisInteropManagerStates {
    return this.state;
  }

  private messageHandler(ev: MessageEvent) {
    const notRrmGisMessage = !RRM_GIS_MSG_TYPE.includes(ev.data.type);
    const sessionNeeded =
      this.state !== GisInteropManagerStates.WAITING_FOR_PING;
    const wrongSession = ev.data.sessionId !== this.sessionId;
    const shouldIgnoreMessage =
      notRrmGisMessage || (sessionNeeded && wrongSession);
    if (shouldIgnoreMessage) {
      return;
    }

    if (this.state === GisInteropManagerStates.WAITING_FOR_PING) {
      this.handleWaitingForPingState(ev);
    } else if (
      this.state === GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME
    ) {
      this.handleLoadingCommunicationIframeState(ev);
    }
  }

  private handleWaitingForPingState(ev: MessageEvent) {
    const notPingMessage = ev.data.type !== 'RRM_GIS_PING';
    const invalidSessionId = typeof ev.data.sessionId !== 'string';
    if (notPingMessage || invalidSessionId) {
      return;
    }

    this.state = GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME;
    this.sessionId = ev.data.sessionId;
    this.gisSource = ev.source;
    this.sourceOrigin = ev.origin;

    this.gisSource?.postMessage({
      type: 'RRM_GIS_ACK',
      sessionId: this.sessionId,
    });

    const src = addQueryParams(feUrl('/rrmgisinterop'), {
      'sessionId': this.sessionId!,
      'origin': this.doc.getWin().origin,
      'rrmOrigin': this.doc.getWin().origin,
      'gisOrigin': this.sourceOrigin!,
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

  private handleLoadingCommunicationIframeState(ev: MessageEvent) {
    const isIframeLoadedMessage = ev.data.type === 'RRM_GIS_IFRAME_LOADED';
    const isFromCommunicationIframe =
      ev.source === this.communicationIframe?.contentWindow;
    const isGisReadyMessage = ev.data.type === 'RRM_GIS_READY';
    const isFromGis = ev.source === this.gisSource;
    if (isIframeLoadedMessage && isFromCommunicationIframe) {
      this.gisSource?.postMessage({
        type: 'RRM_GIS_READY',
        sessionId: this.sessionId,
      });
      this.iframeLoaded = true;
    } else if (isGisReadyMessage && isFromGis) {
      this.gisReady = true;
    }

    if (this.iframeLoaded && this.gisReady) {
      this.state = GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED;
    }
  }
}
