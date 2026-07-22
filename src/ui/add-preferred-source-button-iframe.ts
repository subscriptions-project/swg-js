import {ActivityPorts} from '../components/activities';
import {Deps} from '../runtime/deps';
import {feUrl} from '../runtime/services';
import {setStyle, setStyles} from '../utils/style';

export class AddPreferredSourceButtonIframe {
  private readonly activityPorts_: ActivityPorts;

  constructor(
    private readonly deps_: Deps,
    private readonly container_: Element,
    private readonly options_: {lang?: string; theme?: string}
  ) {
    this.activityPorts_ = deps_.activities();
  }

  async attach(onResult: () => void): Promise<void> {
    const doc = this.deps_.doc();
    const iframe = doc.getWin().document.createElement('iframe');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');

    // Default styling so that it's invisible until loaded, or handles sizing.
    // The iframe contents should tell us its size.
    setStyles(iframe, {
      'width': '100%',
      'border': 'none',
    });

    this.container_.appendChild(iframe);

    // Provide the full href instead of just host, to capture the exact context
    const params: {[key: string]: string} = {
      source: doc.getWin().location.href,
    };
    if (this.options_.theme) {
      params['theme'] = this.options_.theme;
    }
    if (this.options_.lang) {
      params['hl'] = this.options_.lang;
    }

    const url = feUrl('/addpreferredsourcebuttoniframe', params);

    try {
      const port = await this.activityPorts_.openIframe(iframe, url, {});

      port.onResizeRequest((height) => {
        setStyle(iframe, 'height', `${height}px`);
        port.resized();
      });

      const result = await port.acceptResult();
      if (result) {
        onResult();
      }

      await port.whenReady();
    } catch {
      // Ignored. The user might have closed the iframe or blocked cross-domain ports.
    }
  }
}
