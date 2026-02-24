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

import { Doc } from '../../model/doc';
import { createElement } from '../../utils/dom';
import { setImportantStyles } from '../../utils/style';

/**Position of the overlay inside the iframe.*/
export interface OverlayPosition {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Manages the login flow for GIS.
 */
export class GisLoginFlow {
  private overlay?: HTMLElement;

  constructor(
    private readonly doc: Doc,
    private readonly clientId: string,
    private readonly onGisIdToken: (idToken: string) => void
  ) { }

  /**
   * Creates an invisible overlay and positions it based on the provided position.
   */
  setOverlay(iframe: HTMLIFrameElement, position: OverlayPosition) {
    if (!this.overlay) {
      this.overlay = createElement(this.doc.getRootNode(), 'div', {});
      setImportantStyles(this.overlay, {
        'position': 'absolute',
        'background-color': 'transparent',
        'z-index': '2147483647',
        'pointer-events': 'auto',
      });
      this.overlay.onclick = async () => {
        const idToken = await this.login(this.clientId);
        await this.syncToken(idToken);
        this.onGisIdToken(idToken);
        this.dispose();
        // Update entitlements.
        // Close prompt.
      };
      this.doc.getBody()?.appendChild(this.overlay);
    }

    // Overlay position = iframe position + button position inside iframe
    const overlayLeft = iframe.offsetLeft + position.left;
    const overlayTop = iframe.offsetTop + position.top;

    setImportantStyles(this.overlay, {
      'left': `${overlayLeft}px`,
      'top': `${overlayTop}px`,
      'width': `${position.width}px`,
      'height': `${position.height}px`,
    });

    // The bounds of the iframe relative to the overlay's coordinate space
    const maxClipTop = Math.max(0, -position.top);
    const maxClipBottom = Math.min(
      position.height,
      iframe.offsetHeight - position.top
    );
    const maxClipLeft = Math.max(0, -position.left);
    const maxClipRight = Math.min(
      position.width,
      iframe.offsetWidth - position.left
    );

    // Only show the overlay if at least SOME part of it is visible
    if (maxClipTop >= maxClipBottom || maxClipLeft >= maxClipRight) {
      setImportantStyles(this.overlay, {
        'visibility': 'hidden',
      });
    } else {
      setImportantStyles(this.overlay, {
        'visibility': 'visible',
        'clip-path': `polygon(
          ${maxClipLeft}px ${maxClipTop}px,
          ${maxClipRight}px ${maxClipTop}px,
          ${maxClipRight}px ${maxClipBottom}px,
          ${maxClipLeft}px ${maxClipBottom}px
        )`,
      });
    }
  }

  /**
   * Removes the overlay if it exists.
   */
  dispose() {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  private async login(clientId: string): Promise<string> {
    // Call GIS API, return id_token.
    return 'dummy_id_token';
  }

  private async syncToken(idToken: string): Promise<void> {
    // Call SWG API to sync the token.
    return Promise.resolve();
  }
}