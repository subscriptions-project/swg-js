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
} from '../../proto/api_messages';
import {ClientEventManager} from '../client-event-manager';
import {Deps} from '../deps';
import {Doc} from '../../model/doc';
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
  private readonly resizeHandler = this.scheduleUpdate.bind(this);
  private resizeObserver: ResizeObserver | null = null;

  private observedFrameElement: HTMLIFrameElement | null = null;

  private readonly doc: Doc;
  private readonly eventManager: ClientEventManager;

  constructor(
    private readonly deps: Deps,
    private readonly activityIframeView: ActivityIframeView,
    private readonly configurationId?: string
  ) {
    this.doc = deps.doc();
    this.eventManager = deps.eventManager();

    this.activityIframeView.on(
      LoginButtonCoordinates,
      this.handleLoginButtonCoordinates.bind(this)
    );
    this.doc.getWin().addEventListener('resize', this.resizeHandler);
    this.doc.getWin().addEventListener('scroll', this.resizeHandler, {
      passive: true,
    });
    this.activityIframeView.onResize(this.resizeHandler);

    const iframe = this.activityIframeView.getElement();
    const win = this.doc.getWin();
    const ResizeObserverClass = (
      win as unknown as {ResizeObserver?: typeof ResizeObserver}
    ).ResizeObserver;
    if (ResizeObserverClass && iframe) {
      this.resizeObserver = new ResizeObserverClass(() => {
        win.setTimeout(() => {
          this.scheduleUpdate();
        }, 0);
      });
      this.resizeObserver.observe(iframe);
      const frameElement = this.getFrameElement(iframe);
      if (frameElement) {
        this.resizeObserver.observe(frameElement);
        this.observedFrameElement = frameElement;
      }
    }

    this.deps
      .gisInteropManager()
      ?.setCompleteLoginCallback?.(this.completeLogin.bind(this));
  }

  /**
   * Removes all overlays.
   */
  dispose() {
    this.resizeObserver?.disconnect();
    this.observedFrameElement = null;
    for (const overlay of this.overlays.values()) {
      overlay.remove();
    }
    this.overlays.clear();
    if (this.rafId) {
      this.doc.getWin().cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.doc.getWin().removeEventListener('resize', this.resizeHandler);
    this.doc.getWin().removeEventListener('scroll', this.resizeHandler);
    this.deps.gisInteropManager()?.setCompleteLoginCallback?.(null);
  }

  private getFrameOffset(element: HTMLIFrameElement): {
    left: number;
    top: number;
  } {
    let left = 0;
    let top = 0;
    let currentWin: Window | null = null;
    try {
      currentWin = element.ownerDocument?.defaultView || null;
    } catch {
      return {left: 0, top: 0};
    }

    const rootWin = this.doc.getWin();
    while (currentWin && currentWin !== rootWin) {
      try {
        const frame = currentWin.frameElement as HTMLIFrameElement | null;
        if (!frame) {
          break;
        }
        const rect = frame.getBoundingClientRect();
        left += rect.left;
        top += rect.top;
        currentWin = frame.ownerDocument?.defaultView || null;
      } catch {
        break;
      }
    }
    return {left, top};
  }

  private getFrameElement(
    element: HTMLIFrameElement
  ): HTMLIFrameElement | null {
    try {
      const win = element.ownerDocument?.defaultView;
      if (win === this.doc.getWin()) {
        return null;
      }
      return (win?.frameElement || null) as HTMLIFrameElement | null;
    } catch {
      return null;
    }
  }

  private updateOverlays() {
    this.positions.forEach((p, id) => {
      const iframe = this.activityIframeView.getElement();
      if (this.resizeObserver && !this.observedFrameElement) {
        const frameElement = this.getFrameElement(iframe);
        if (frameElement) {
          this.resizeObserver.observe(frameElement);
          this.observedFrameElement = frameElement;
        }
      }

      const frameOffset = this.getFrameOffset(iframe);
      const innerRect = iframe.getBoundingClientRect();

      const offsetLeft = frameOffset.left + innerRect.left + p.left;
      const offsetTop = frameOffset.top + innerRect.top + p.top;

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
      'position': 'fixed',
      'box-sizing': 'border-box',
      'border': 'none',
      'margin': '0',
      'padding': '0',
      'overflow': 'hidden',
      'opacity': '0',
      'background-color': 'transparent',
      'z-index': '2147483647',
      'pointer-events': 'auto',
      'cursor': 'pointer',
    });
    this.overlays.set(key, overlay);
    this.doc.getBody()?.appendChild(overlay);
    this.renderButton(overlay);
    return overlay;
  }

  private renderButton(overlay: HTMLElement) {
    this.doc.getWin().google?.accounts?.id?.renderButton(overlay, {
      'type': 'standard',
      'theme': 'outline',
      'text': 'continue_with',
      'logo_alignment': 'left',
      'click_listener': this.overlayClick.bind(this),
    });
  }

  private overlayClick() {
    const eventParams = new EventParams();
    eventParams.setGisMode(GisModeProto.GIS_MODE_OVERLAY);
    this.eventManager.logSwgEvent(
      AnalyticsEvent.ACTION_REGWALL_OPT_IN_BUTTON_CLICK,
      /* isFromUserAction= */ true,
      eventParams,
      /* eventTime= */ undefined,
      this.configurationId
    );
    this.deps.gisInteropManager()?.setRegwallClickPending?.(true);
  }

  private async completeLogin(swgUserToken: string): Promise<boolean> {
    try {
      const gisSignIn = new GisSignIn();
      gisSignIn.setSwgUserToken(swgUserToken);
      await this.activityIframeView.execute(gisSignIn);
      return true;
    } catch {
      this.eventManager.logSwgEvent(
        AnalyticsEvent.EVENT_GIS_LOGIN_ERROR,
        /* isFromUserAction= */ false,
        /* eventParams= */ null,
        /* eventTime= */ undefined,
        this.configurationId
      );
      return false;
    }
  }
}
