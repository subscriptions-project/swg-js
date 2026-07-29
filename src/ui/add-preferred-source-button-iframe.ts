import {ActivityIframePort, ActivityPorts} from '../components/activities';
import {
  AddPreferredSourceRequest,
  AddPreferredSourceStatus,
  UpdateAddPreferredSourceButtonRequest,
} from '../proto/api_messages';
import {Deps} from '../runtime/deps';
import {feUrl} from '../runtime/services';
import {log} from '../utils/log';
import {parseUrl} from '../utils/url';
import {setStyle, setStyles} from '../utils/style';

export class AddPreferredSourceButtonIframe {
  private readonly activityPorts_: ActivityPorts;
  private portPromise_?: Promise<ActivityIframePort>;

  constructor(
    private readonly deps_: Deps,
    private readonly container_: Element,
    private readonly options_: {lang?: string; theme?: string}
  ) {
    this.activityPorts_ = deps_.activities();
  }

  async updateStatus(status: AddPreferredSourceStatus): Promise<void> {
    if (this.portPromise_) {
      try {
        log(`[AddPreferredSourceButtonIframe] Awaiting portPromise_ for status ${status}`);
        const port = await this.portPromise_;
        const updateMsg = new UpdateAddPreferredSourceButtonRequest();
        updateMsg.setStatus(status);
        log(
          '[AddPreferredSourceButtonIframe] Updating iframe button status:',
          status, 'on port', port
        );
        port.execute(updateMsg);
        log(`[AddPreferredSourceButtonIframe] Successfully executed updateMsg on port for status ${status}`);
      } catch (reason) {
        log(
          '[AddPreferredSourceButtonIframe] Error updating status on port:',
          reason
        );
      }
    } else {
      log(`[AddPreferredSourceButtonIframe] No portPromise_ available for status ${status}`);
    }
  }

  async attach(onResult: () => void): Promise<void> {
    log('[AddPreferredSourceButtonIframe] Attaching button iframe...');
    const doc = this.deps_.doc();
    const iframe = doc.getWin().document.createElement('iframe');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('title', 'Add Preferred Source');

    // Default styling so that it's invisible until loaded, or handles sizing.
    // The iframe contents should tell us its size.
    setStyles(iframe, {
      'width': '100%',
      'border': 'none',
    });

    this.container_.appendChild(iframe);

    // Provide the full href instead of just host, to capture the exact context
    const params: {[key: string]: string} = {
      'origin': parseUrl(doc.getWin().location.href).origin,
      'source': doc.getWin().location.href,
    };
    if (this.options_.theme) {
      params['theme'] = this.options_.theme;
    }
    if (this.options_.lang) {
      params['hl'] = this.options_.lang;
    }

    const url = feUrl('/addpreferredsourcebuttoniframe', params);
    log('[AddPreferredSourceButtonIframe] Opening iframe with URL:', url);

    try {
      this.portPromise_ = this.activityPorts_.openIframe(iframe, url, {});
      const port = await this.portPromise_;
      log(
        '[AddPreferredSourceButtonIframe] ActivityPort connected successfully.'
      );

      port.onResizeRequest((height) => {
        log(
          '[AddPreferredSourceButtonIframe] Resize request received:',
          height
        );
        setStyle(iframe, 'height', `${height}px`);
        port.resized();
      });

      log(
        '[AddPreferredSourceButtonIframe] Registering listener for AddPreferredSourceRequest clicks...'
      );
      port.on(AddPreferredSourceRequest, (request) => {
        log(
          '[AddPreferredSourceButtonIframe] Received AddPreferredSourceRequest from iframe:',
          request
        );
        log(
          '[AddPreferredSourceButtonIframe] Triggering onResult callback (launching AddPreferredSourceFlow)...'
        );
        onResult();
      });

      await port.whenReady();
    } catch (reason) {
      log('[AddPreferredSourceButtonIframe] Error or port closure:', reason);
      // Ignored. The user might have closed the iframe or blocked cross-domain ports.
    }
  }
}
