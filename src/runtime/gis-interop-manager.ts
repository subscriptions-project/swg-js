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
import {exhaustiveCheck} from '../utils/exhaustive';
import {feUrl} from './services';
import {isString} from '../utils/types';
import {setImportantStyles} from '../utils/style';
import {warn} from '../utils/log';

enum GisInteropManagerStates {
  LISTENING,
  LOADING_COMMUNICATION_IFRAME,
  ERROR,
}

export const RRM_GIS_MSG_TYPE = [
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
  private state = GisInteropManagerStates.LISTENING;
  private sessionId?: string;
  private source: MessageEventSource | null = null;
  private sourceOrigin?: string;
  private iframe?: HTMLElement;
  private readonly messageHandlerValue = this.messageHandler.bind(this);

  constructor(private readonly doc: Doc) {
    this.doc.getWin().addEventListener('message', this.messageHandlerValue);
  }

  private messageHandler(ev: MessageEvent) {
    if (!RRM_GIS_MSG_TYPE.includes(ev.data.type)) {
      return;
    }

    switch (this.state) {
      case GisInteropManagerStates.LISTENING:
        this.handleListeningState(ev);
        break;
      case GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME:
      case GisInteropManagerStates.ERROR:
        break;
      default:
        exhaustiveCheck(this.state);
    }
  }

  private handleListeningState(ev: MessageEvent) {
    // Validate the message.
    if (ev.data.type !== 'RRM_GIS_PING' || !isString(ev.data.sessionId)) {
      this.state = GisInteropManagerStates.ERROR;
      warn(
        `[GisInteropManager] Unexpected message in LISTENING state: ${ev.data.type}`
      );
      return;
    }

    // Process the valid message
    this.state = GisInteropManagerStates.LOADING_COMMUNICATION_IFRAME;
    this.sessionId = ev.data.sessionId;
    this.source = ev.source;
    this.sourceOrigin = ev.origin;
    this.source?.postMessage({
      type: 'RRM_GIS_ACK',
      sessionId: this.sessionId,
    });

    const src = addQueryParams(feUrl('/rrmgisinterop'), {
      'sessionId': this.sessionId!,
      'origin': encodeURIComponent(this.doc.getWin().origin),
      'rrmOrigin': encodeURIComponent(this.doc.getWin().origin),
      'gisOrigin': encodeURIComponent(this.sourceOrigin!),
    });

    this.iframe = createElement(this.doc.getRootNode(), 'iframe', {
      'src': src,
      'tabindex': '-1',
      'aria-hidden': 'true',
    });

    setImportantStyles(this.iframe, {
      'width': '0',
      'height': '0',
      'border': 'none',
      'position': 'absolute',
      'visibility': 'hidden',
    });

    this.doc.getBody()?.appendChild(this.iframe);
  }
}
