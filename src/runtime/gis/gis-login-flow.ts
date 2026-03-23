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

import {ActivityIframeView} from '../../ui/activity-iframe-view';
import {
  AnalyticsEvent,
  ElementCoordinates,
  EventParams,
  GisMode as GisModeProto,
  GisSignIn,
  LoginButtonCoordinates,
  StartGisSignIn,
} from '../../proto/api_messages';
import {ClientEventManager} from '../client-event-manager';
import {Doc} from '../../model/doc';
import {GisMode} from './gis-utils';
import {createElement} from '../../utils/dom';
import {setImportantStyles} from '../../utils/style';

/**Position of the overlay inside the iframe.*/
interface ValidatedCoordinates {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const GIS_MODE_TO_EVENT_PARAMS_MAP = {
  [GisMode.GisModeDisabled]: GisModeProto.GIS_MODE_DISABLED,
  [GisMode.GisModeOverlay]: GisModeProto.GIS_MODE_OVERLAY,
  [GisMode.GisModeNormal]: GisModeProto.GIS_MODE_NORMAL,
};

/**
 * Manages the login flow for GIS.
 */
export class GisLoginFlow {
  private readonly overlays = new Map<string, HTMLElement>();
  private readonly positions = new Map<string, ValidatedCoordinates>();
  private rafId: number | null = null;
  private readonly resizeHandler = this.scheduleUpdate.bind(this);
  private gisScriptPromise: Promise<void>;

  constructor(
    private readonly doc: Doc,
    private readonly clientId: string,
    private readonly activityIframeView: ActivityIframeView,
    private readonly gisMode: GisMode,
    private readonly eventManager: ClientEventManager,
    private readonly configurationId?: string
  ) {
    if (this.gisMode === GisMode.GisModeOverlay) {
      this.activityIframeView.on(
        LoginButtonCoordinates,
        this.handleLoginButtonCoordinates.bind(this)
      );
      this.doc.getWin().addEventListener('resize', this.resizeHandler);
      this.activityIframeView.onResize(this.resizeHandler);
    } else if (this.gisMode === GisMode.GisModeNormal) {
      this.activityIframeView.on(StartGisSignIn, this.login.bind(this));
    }

    this.gisScriptPromise = new Promise((resolve) => {
      const hasGis = this.doc
        .getRootNode()
        .querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (!hasGis) {
        const gisScript = createElement(this.doc.getRootNode(), 'script', {
          'src': 'https://accounts.google.com/gsi/client',
          'async': 'true',
        });
        gisScript.onload = () => {
          resolve();
        };
        this.doc.getHead()?.appendChild(gisScript);
      } else {
        resolve();
      }
    });
  }

  /**
   * Removes all overlays.
   */
  dispose() {
    if (this.gisMode === GisMode.GisModeOverlay) {
      for (const overlay of this.overlays.values()) {
        overlay.remove();
      }
      this.overlays.clear();
      if (this.rafId) {
        this.doc.getWin().cancelAnimationFrame(this.rafId);
      }
      this.doc.getWin().removeEventListener('resize', this.resizeHandler);
    }
  }

  private updateOverlays() {
    this.positions.forEach((p, id) => {
      const iframe = this.activityIframeView.getElement();
      const iframeBoundingBox = iframe.getBoundingClientRect();
      const iframeHeight = iframeBoundingBox.height;
      const iframeWidth = iframeBoundingBox.width;
      const windowWidth = this.doc.getWin()./*OK*/ innerWidth;
      const windowHeight = this.doc.getWin()./*OK*/ innerHeight;

      const offsetLeft = (windowWidth - iframeWidth) / 2 + p.left;
      const offsetTop = windowHeight - (iframeHeight - p.top);

      const overlay = this.overlays.get(id)!;
      setImportantStyles(overlay, {
        'left': `${offsetLeft}px`,
        'top': `${offsetTop}px`,
        'width': `${p.width}px`,
        'height': `${p.height}px`,
      });
    });
  }

  private scheduleUpdate() {
    if (this.rafId) {
      this.doc.getWin().cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.rafId = this.doc.getWin().requestAnimationFrame(() => {
      this.rafId = null;
      this.updateOverlays();
    });
  }

  private handleLoginButtonCoordinates(message: LoginButtonCoordinates) {
    message.getLoginButtonCoordinatesList()?.forEach((position) => {
      const p = this.validatedPosition(position);
      if (!p) {
        return;
      }
      if (!this.positions.has(p.id)) {
        this.createOverlay(p.id);
      }
      this.positions.set(p.id, p);
    });
    this.scheduleUpdate();
  }

  private validatedPosition(
    position: ElementCoordinates
  ): ValidatedCoordinates | null {
    const id = position.getId();
    const left = position.getLeft();
    const top = position.getTop();
    const width = position.getWidth();
    const height = position.getHeight();

    if (
      id === null ||
      left === null ||
      top === null ||
      width === null ||
      height === null
    ) {
      return null;
    }
    return {id, left, top, width, height};
  }

  private createOverlay(key: string) {
    const overlay = createElement(this.doc.getRootNode(), 'div', {});
    setImportantStyles(overlay, {
      'position': 'absolute',
      'background-color': 'transparent',
      'z-index': '2147483647',
      'pointer-events': 'auto',
      'cursor': 'pointer',
    });
    overlay.onclick = this.overlayClick.bind(this);
    this.overlays.set(key, overlay);
    this.doc.getBody()?.appendChild(overlay);
    return overlay;
  }

  private overlayClick() {
    const eventParams = new EventParams();
    eventParams.setGisMode(GIS_MODE_TO_EVENT_PARAMS_MAP[this.gisMode]);
    this.eventManager.logSwgEvent(
      AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
      /* isFromUserAction= */ true,
      eventParams,
      /* eventTime= */ undefined,
      this.configurationId
    );
    return this.login();
  }

  private async login() {
    const idToken = await this.getIdToken();
    const gisSignIn = new GisSignIn();
    gisSignIn.setIdToken(idToken);
    gisSignIn.setGisClientId(this.clientId);
    this.activityIframeView.execute(gisSignIn);
  }

  private async getIdToken(): Promise<string> {
    await this.gisScriptPromise;
    // TODO: replace with GIS api call for id toke.
    return new Promise<string>((resolve, reject) => {
      try {
        // @ts-ignore
        this.doc.getWin().google.accounts.id.initialize({
          /* eslint-disable-next-line google-camelcase/google-camelcase */
          client_id: this.clientId,
          callback: (idToken: {credential: string}) => {
            resolve(idToken.credential);
          },
        });
        // @ts-ignore
        this.doc.getWin().google.accounts.id.prompt();
      } catch (e) {
        this.eventManager.logSwgEvent(
          AnalyticsEvent.EVENT_GIS_LOGIN_ERROR,
          /* isFromUserAction= */ false,
          /* eventParams= */ null,
          /* eventTime= */ undefined,
          this.configurationId
        );
        reject(e);
      }
    });
  }
}
