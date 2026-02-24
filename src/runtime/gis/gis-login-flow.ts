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

import {Doc} from '../../model/doc';
import {createElement} from '../../utils/dom';
import {setImportantStyles} from '../../utils/style';

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
  private readonly overlays = new Map<string, HTMLElement>();

  constructor(
    private readonly doc: Doc,
    private readonly clientId: string,
    private readonly onGisIdToken: (idToken: string) => void
  ) {}

  /**
   * Creates or updates invisible overlays and positions them based on the provided positions.
   * Overlays not present in the positions object will be removed.
   */
  updateOverlays(
    iframe: HTMLIFrameElement,
    positions: Record<string, OverlayPosition>
  ) {
    // 1. Create or update overlays.
    for (const [key, position] of Object.entries(positions)) {
      let overlay = this.overlays.get(key);
      if (!overlay) {
        overlay = createElement(this.doc.getRootNode(), 'div', {});
        setImportantStyles(overlay, {
          'position': 'absolute',
          'background-color': 'transparent',
          'z-index': '2147483647',
          'pointer-events': 'auto',
        });
        overlay.onclick = async () => {
          const idToken = await this.login(this.clientId);
          await this.syncToken(idToken);
          this.onGisIdToken(idToken);
          this.dispose(); // Or maybe just hide/remove this overlay?
          // The snippet says "Update entitlements. Close prompt." which implies the whole flow ends.
        };
        this.doc.getBody()?.appendChild(overlay);
        this.overlays.set(key, overlay);
      }

      // Overlay position = iframe position + button position inside iframe
      const overlayLeft = iframe.offsetLeft + position.left;
      const overlayTop = iframe.offsetTop + position.top;

      setImportantStyles(overlay, {
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
        setImportantStyles(overlay, {
          'visibility': 'hidden',
        });
      } else {
        setImportantStyles(overlay, {
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

    // 2. Remove overlays that are no longer requested.
    for (const key of this.overlays.keys()) {
      if (!positions[key]) {
        this.overlays.get(key)?.remove();
        this.overlays.delete(key);
      }
    }
  }

  /**
   * Removes all overlays.
   */
  dispose() {
    for (const overlay of this.overlays.values()) {
      overlay.remove();
    }
    this.overlays.clear();
  }

  // @ts-ignore
  private async login(unused: string): Promise<string> {
    // Call GIS API, return id_token.
    return 'dummy_id_token';
  }

  // @ts-ignore
  private async syncToken(unused: string): Promise<void> {
    // Call SWG API to sync the token.
    return Promise.resolve();
  }
}
