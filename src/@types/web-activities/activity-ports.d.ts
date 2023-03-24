/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
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

/**
 * @fileoverview Type definitions for parts of `web-activities` imported by Swgjs' TypeScript.
 */

declare module 'web-activities/activity-ports' {
  /**
   * Activity client-side binding. The port provides limited ways to communicate
   * with the activity and receive signals and results from it. Not every type
   * of activity exposes a port.
   */
  export interface ActivityPort {
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
  }

  /**
   * The activity "open" options used for popups and redirects.
   *
   * - returnUrl: override the return URL. By default, the current URL will be
   *   used.
   * - skipRequestInUrl: removes the activity request from the URL, in case
   *   redirect is used. By default, the activity request is appended to the
   *   activity URL. This option can be used if the activity request is passed
   *   to the activity by some alternative means.
   * - disableRedirectFallback: disallows popup fallback to redirect. By default
   *   the redirect fallback is allowed. This option has to be used very carefully
   *   because there are many user agents that may fail to open a popup and it
   *   won't be always possible for the opener window to even be aware of such
   *   failures.
   */
  export interface ActivityOpenOptions {
    returnUrl?: string;
    skipRequestInUrl?: boolean;
    disableRedirectFallback?: boolean;
    width?: number;
    height?: number;
  }

  /**
   * The result of an activity. The activity implementation returns this object
   * for a successful result, a cancelation or a failure.
   */
  interface ActivityResult {
    readonly ok: boolean;
    readonly error: Error | null;

    constructor(
      readonly code: ActivityResultCode,
      readonly data: unknown,
      readonly mode: ActivityMode,
      readonly origin: string,
      readonly originVerified: boolean,
      readonly secureChannel: boolean
    );
  }

  export enum ActivityMode {
    IFRAME = 'iframe',
    POPUP = 'popup',
    REDIRECT = 'redirect',
  }

  /**
   * The `ActivityPort` implementation for the iframe case. Unlike other types
   * of activities, iframe-based activities are always connected and can react
   * to size requests.
   */
  export class ActivityIframePort {
    private readonly win_: Window;
    private readonly targetOrigin_: string;
    private connected_: boolean;
    private connectedResolver_: (() => void) | null;
    private readonly connectedPromise_: Promise<void>;
    private readyResolver_: (() => void) | null;
    private readonly readyPromise_: Promise<void>;
    private resultResolver_:
      | ((result: ActivityResult | Promise<ActivityResult>) => void)
      | null;
    private readonly resultPromise_: Promise<ActivityResult>;
    private onResizeRequest_: ((size: number) => void) | null;
    private requestedHeight_: number | null;
    private readonly messenger_: Messenger;

    constructor(
      private readonly iframe_: HTMLIFrameElement,
      private readonly url_: string,
      private readonly args_?: unknown
    );

    getMode(): ActivityMode;

    /**
     * Waits until the activity port is connected to the host.
     */
    connect(): Promise<void>;

    /**
     * Disconnect the activity binding and cleanup listeners.
     */
    disconnect(): void;

    acceptResult(): Promise<ActivityResult>;

    getTargetWin(): Window | null;

    message(payload: unknown): void;

    onMessage(callback: (data: {'RESPONSE'?: unknown[]}) => void): void;

    messageChannel(opt_name?: string): Promise<MessagePort>;

    /**
     * Returns a promise that yields when the iframe is ready to be interacted
     * with.
     */
    whenReady(): Promise<void>;

    /**
     * Register a callback to handle resize requests. Once successfully resized,
     * ensure to call `resized()` method.
     */
    onResizeRequest(callback: (size: number) => void): void;

    /**
     * Signals back to the activity implementation that the client has updated
     * the activity's size.
     */
    resized(): void;

    private handleCommand_(cmd: string, payload: object | null): void;
  }

  /**
   * The page-level activities manager ports. This class is intended to be used
   * as a singleton. It can start activities of all modes: iframe, popup, and
   * redirect.
   */
  class ActivityPorts {
    readonly version: string;
    private readonly fragment_: string;
    private readonly requestHandlers_: {
      [key: string]: ((port: ActivityPort) => void)[];
    };
    /** The result buffer is indexed by `requestId`. */
    private readonly resultBuffer_: {[key: string]: ActivityPort};
    private redirectErrorResolver_: (error: Error) => void | null;
    redirectErrorPromise_: Promise<Error>;

    constructor(private readonly win_: Window);

    /**
     * Start an activity within the specified iframe.
     */
    openIframe(
      iframe: HTMLIFrameElement,
      url: string,
      opt_args?: unknown
    ): Promise<ActivityIframePort>;

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
      opt_args?: object | null,
      opt_options?: ActivityOpenOptions | null
    ): {targetWin: Window | null};

    /**
     * Start an activity in a separate window and tries to setup messaging with
     * this window.
     *
     * See `open()` method for more details, including `onResult` callback.
     */
    openWithMessaging(
      requestId: string,
      url: string,
      target: string,
      opt_args?: object | null,
      opt_options?: ActivityOpenOptions | null
    ): Promise<ActivityMessagingPort>;

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
     * ports.onResult('request1', function(port) {
     *   port.acceptResult().then(function(result) {
     *     // Only verified origins are allowed.
     *     if (result.origin == expectedOrigin &&
     *         result.originVerified &&
     *         result.secureChannel) {
     *       handleResultForRequest1(result);
     *     }
     *   });
     * })
     *
     * ports.open('request1', request1Url, '_blank');
     * ```
     */
    onResult(requestId: string, callback: (port: ActivityPort) => void);

    onRedirectError(handler: (error: Error) => void);

    private openWin_(
      requestId: string,
      url: string,
      target: string,
      opt_args?: object | null,
      opt_options?: ActivityOpenOptions | null
    ): ActivityWindowPort;

    private discoverResult_(requestId: string): ActivityPort | null;

    private consumeResult_(
      port: ActivityPort,
      callback: (port: ActivityPort) => void
    ): void;

    private consumeResultAll_(requestId: string, port: ActivityPort): void;
  }

  /**
   * The result of an activity. The activity implementation returns this object
   * for a successful result, a cancelation or a failure.
   */
  export interface ActivityResult {
    readonly ok: boolean;
    readonly error: Error | null;

    constructor(
      readonly code: ActivityResultCode,
      readonly data: unknown,
      readonly mode: ActivityMode,
      readonly origin: string,
      readonly originVerified: boolean,
      readonly secureChannel: boolean
    );
  }

  /** Not currently needed in Swgjs' TypeScript. */
  export interface Messenger {}
}
