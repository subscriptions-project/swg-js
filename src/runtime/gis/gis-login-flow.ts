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
import {Doc} from '../../model/doc';
import {
  ElementCoordinates,
  LoginButtonCoordinates,
} from '../../proto/api_messages';
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

/**
 * Manages the login flow for GIS.
 */
export class GisLoginFlow {
  private readonly overlays = new Map<string, HTMLElement>();
  private readonly positions = new Map<string, ValidatedCoordinates>();
  private rafId: number | null = null;

  constructor(
    private readonly doc: Doc,
    private readonly clientId: string,
    private readonly onGisIdToken: (idToken: string) => void,
    private readonly activityIframeView_: ActivityIframeView
  ) {
    this.activityIframeView_.on(
      LoginButtonCoordinates,
      this.handleLoginButtonCoordinates.bind(this)
    );
  }

  /**
   * Removes all overlays.
   */
  dispose() {
    for (const overlay of this.overlays.values()) {
      overlay.remove();
    }
    this.overlays.clear();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  private updateOverlays() {
    this.positions.forEach((p, id) => {
      const overlay = this.overlays.get(id);
      if (!overlay) {
        return;
      }

      const iframe = this.activityIframeView_.getElement();
      const iframeBoundingBox = iframe.getBoundingClientRect();
      const iframeHeight = iframeBoundingBox.height;
      const iframeWidth = iframeBoundingBox.width;
      const windowWidth = this.doc.getWin().innerWidth;
      const windowHeight = this.doc.getWin().innerHeight;

      const offsetLeft = (windowWidth - iframeWidth) / 2 + p.left;
      const offsetTop = windowHeight - (iframeHeight - p.top);

      setImportantStyles(overlay, {
        'left': `${offsetLeft}px`,
        'top': `${offsetTop}px`,
        'width': `${p.width}px`,
        'height': `${p.height}px`,
      });
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
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updateOverlays();
    });
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
      'background-color': 'red', // TODO: set 'transparent',
      'z-index': '2147483647',
      'pointer-events': 'auto',
    });
    overlay.onclick = this.login.bind(this);
    this.overlays.set(key, overlay);
    this.doc.getBody()?.appendChild(overlay);
    return overlay;
  }

  private async login() {
    const idToken = await this.getIdToken();
    // Sync token, update entitlements, issue update to iframe.
    this.onGisIdToken(idToken);
  }

  private async getIdToken(): Promise<string> {
    // TODO: replace with id token call.
    return new Promise<string>((resolve) => {
      // @ts-ignore
      const tc = google.accounts.oauth2.initTokenClient({
        'client_id': this.clientId,
        'scope': 'openid email profile',
        'callback': (response: any) => {
          console.log(response);
          resolve('fakeIdToken');
        },
      });
      tc.requestAccessToken();
    });
  }
}
