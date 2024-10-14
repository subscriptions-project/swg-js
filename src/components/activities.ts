/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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
import {
  AnalyticsRequest,
  EventOriginator,
  Message,
  deserialize,
  getLabel,
} from '../proto/api_messages';
import {INTERNAL_RUNTIME_VERSION} from '../constants';

import {StorageKeys} from '../utils/constants';
import {addQueryParam} from '../utils/url';

import {
  ActivityMode,
  ActivityOpenOptions,
  ActivityResult,
  ActivityIframePort as WebActivityIframePort,
  ActivityPort as WebActivityPort,
  ActivityPorts as WebActivityPorts,
} from 'web-activities/activity-ports';
import {Deps} from '../runtime/deps';

export interface ActivityPortDef {
  acceptResult(): Promise<ActivityResult>;
}

export interface ActivityPort extends ActivityPortDef {
  /**
   * Returns the mode of the activity: iframe, popup or redirect.
   */
  getMode(): ActivityMode;

  /**
   * Accepts the result when ready. The client should verify the activity's
   * mode, origin, verification and secure channel flags before deciding
   * whether or not to trust the result.
   *
   * Returns the promise that yields when the activity has been completed and
   * either a result, a cancelation or a failure has been returned.
   */
  acceptResult(): Promise<ActivityResult>;

  /**
   * Returns a promise that yields when the iframe is ready to be interacted
   * with.
   */
  whenReady(): Promise<void>;

  /**
   * Waits until the activity port is connected to the host.
   */
  connect(): Promise<void>;

  /**
   * Disconnect the activity binding and cleanup listeners.
   */
  disconnect(): void;

  /**
   * Register a callback to handle resize requests. Once successfully resized,
   * ensure to call `resized()` method.
   */
  onResizeRequest(callback: (size: number) => void): void;

  execute(request: Message): void;

  on<T extends Message>(
    messageType: new (data?: unknown[], includesLabel?: boolean) => T,
    callback: (p1: T) => void
  ): void;

  /**
   * Signals back to the activity implementation that the client has updated
   * the activity's size.
   */
  resized(): void;
}

class ActivityPortDeprecated implements ActivityPortDef {
  constructor(private readonly port_: WebActivityPort) {}

  acceptResult(): Promise<ActivityResult> {
    return this.port_.acceptResult();
  }
}

export class ActivityIframePort implements ActivityPortDef {
  private readonly iframePort_: WebActivityIframePort;
  private readonly callbackMap_: {[key: string]: (message: Message) => void};

  constructor(
    iframe: HTMLIFrameElement,
    url: string,
    private readonly deps_: Deps,
    args?: unknown
  ) {
    this.iframePort_ = new WebActivityIframePort(iframe, url, args);
    this.callbackMap_ = {};
  }

  /**
   * Returns a promise that yields when the iframe is ready to be interacted
   * with.
   */
  whenReady(): Promise<void> {
    return this.iframePort_.whenReady();
  }

  /**
   * Waits until the activity port is connected to the host.
   */
  async connect(): Promise<void> {
    await this.iframePort_.connect();

    // Attach a callback to receive messages after connection complete
    this.iframePort_.onMessage((data) => {
      const response = data?.['RESPONSE'];
      if (!response) {
        return;
      }
      const cb = this.callbackMap_[response[0] as string];
      if (cb) {
        const message = deserialize(response);
        cb(message);
      }
    });

    if (this.deps_ && this.deps_.eventManager()) {
      this.on(AnalyticsRequest, (request) => {
        this.deps_.eventManager().logEvent({
          eventType: request.getEvent(),
          eventOriginator: EventOriginator.SWG_SERVER,
          isFromUserAction: request.getMeta()?.getIsFromUserAction(),
          additionalParameters: request.getParams(),
          configurationId: request.getMeta()?.getConfigurationId(),
        });
      });
    }
  }

  /**
   * Disconnect the activity binding and cleanup listeners.
   */
  disconnect() {
    this.iframePort_.disconnect();
  }

  /**
   * Returns the mode of the activity: iframe, popup or redirect.
   */
  getMode(): ActivityMode {
    return this.iframePort_.getMode();
  }

  /**
   * Accepts the result when ready. The client should verify the activity's
   * mode, origin, verification and secure channel flags before deciding
   * whether or not to trust the result.
   *
   * Returns the promise that yields when the activity has been completed and
   * either a result, a cancelation or a failure has been returned.
   */
  acceptResult(): Promise<ActivityResult> {
    return this.iframePort_.acceptResult();
  }

  /**
   * Register a callback to handle resize requests. Once successfully resized,
   * ensure to call `resized()` method.
   */
  onResizeRequest(callback: (size: number) => void) {
    return this.iframePort_.onResizeRequest(callback);
  }

  execute(request: Message) {
    this.iframePort_.message({'REQUEST': request.toArray()});
  }

  on<T extends Message>(
    message: new (data?: unknown[], includesLabel?: boolean) => T,
    callback: (p1: T) => void
  ) {
    let label = null;
    try {
      label = getLabel(message);
    } catch (ex) {
      // Thrown if message is not a proto object and has no label
      label = null;
    }
    if (!label) {
      throw new Error('Invalid data type');
    } else if (this.callbackMap_[label]) {
      throw new Error('Invalid type or duplicate callback for ' + label);
    }
    this.callbackMap_[label] = callback as (p1: Message) => void;
  }

  /**
   * Signals back to the activity implementation that the client has updated
   * the activity's size.
   */
  resized() {
    this.iframePort_.resized();
  }
}

export class ActivityPorts {
  activityPorts_: WebActivityPorts;

  constructor(private readonly deps_: Deps) {
    this.activityPorts_ = new WebActivityPorts(deps_.win());
  }

  /**
   * Adds client version, publication, product and logging context information.
   */
  addDefaultArguments(args?: {} | null): {} {
    const deps = this.deps_;
    const pageConfig = deps.pageConfig();
    const context = deps.analytics().getContext();
    return Object.assign(
      {
        'analyticsContext': context.toArray(),
        'publicationId': pageConfig.getPublicationId(),
        'productId': pageConfig.getProductId(),
        '_client': `SwG ${INTERNAL_RUNTIME_VERSION}`,
        'supportsEventManager': true,
      },
      args || {}
    );
  }

  /*
   * Start an activity within the specified iframe.
   */
  private async openActivityIframePort_(
    iframe: HTMLIFrameElement,
    url: string,
    args?: unknown
  ) {
    const activityPort = new ActivityIframePort(iframe, url, this.deps_, args);
    await activityPort.connect();
    return activityPort;
  }

  /**
   * Start an activity within the specified iframe.
   */
  async openIframe(
    iframe: HTMLIFrameElement,
    url: string,
    args?: {} | null,
    addDefaultArguments = false
  ): Promise<ActivityIframePort> {
    if (addDefaultArguments) {
      args = this.addDefaultArguments(args);
    }

    const swgUserToken = await this.deps_
      .storage()
      .get(StorageKeys.USER_TOKEN, /* useLocalStorage= */ true);

    const queryParams = new URL(url).searchParams;
    if (swgUserToken && !queryParams.has('sut')) {
      url = addQueryParam(url, 'sut', swgUserToken);
    }

    const pubId = this.deps_.pageConfig().getPublicationId();
    if (pubId && !queryParams.has('publicationId')) {
      url = addQueryParam(url, 'publicationId', pubId);
    }

    return this.openActivityIframePort_(iframe, url, args);
  }

  /**
   * Start an activity in a separate window. The result will be delivered
   * to the `onResult` callback.
   *
   * The activity can be opened in two modes: "popup" and "redirect". This
   * depends on the `target` value, but also on the browser/environment.
   *
   * The allowed `target` values are `_blank`, `_top` and name targets. The
   * `_self`, `_parent` and similar targets are not allowed.
   *
   * The `_top` target indicates that the activity should be opened as a
   * "redirect", while other targets indicate that the activity should be
   * opened as a popup. The activity client will try to honor the requested
   * target. However, it's not always possible. Some environments do not
   * allow popups and they either force redirect or fail the window open
   * request. In this case, the activity will try to fallback to the "redirect"
   * mode.
   */
  open(
    requestId: string,
    url: string,
    target: string,
    args?: {} | null,
    options?: ActivityOpenOptions | null,
    addDefaultArguments = false
  ): {targetWin: Window | null} {
    if (addDefaultArguments) {
      args = this.addDefaultArguments(args);
    }
    return this.activityPorts_.open(requestId, url, target, args, options);
  }

  /**
   * Registers the callback for the result of the activity opened with the
   * specified `requestId` (see the `open()` method). The callback is a
   * function that takes a single `ActivityPort` argument. The client
   * can use this object to verify the port using it's origin, verified and
   * secure channel flags. Then the client can call
   * `ActivityPort.acceptResult()` method to accept the result.
   *
   * The activity result is handled via a separate callback because of a
   * possible redirect. So use of direct callbacks and/or promises is not
   * possible in that case.
   *
   * A typical implementation would look like:
   * ```
   * ports.onResult('request1', async (port) => {
   *   const result = await port.acceptResult();
   *   // Only verified origins are allowed.
   *   if (result.origin == expectedOrigin &&
   *       result.originVerified &&
   *       result.secureChannel) {
   *     handleResultForRequest1(result);
   *   }
   * })
   *
   * ports.open('request1', request1Url, '_blank');
   * ```
   */
  onResult(requestId: string, callback: (port: ActivityPortDef) => void): void {
    this.activityPorts_.onResult(requestId, (port) => {
      callback(new ActivityPortDeprecated(port));
    });
  }

  onRedirectError(handler: (error: Error) => void) {
    this.activityPorts_.onRedirectError(handler);
  }

  getOriginalWebActivityPorts(): WebActivityPorts {
    return this.activityPorts_;
  }
}
