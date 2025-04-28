import {ActionToIframeMapping, parseUrl} from '../utils/url';
import {ActivityIframeView} from '../ui/activity-iframe-view';
import {ActivityPorts} from '../components/activities';
import {Deps} from './deps';
import {Doc} from '../model/doc';
import {Intervention} from './intervention';
import {ProductType} from '../api/subscriptions';
import {feArgs, feUrl} from './services';
import {setImportantStyles} from '../utils/style';

const INLINE_CTA_ATTRIUBUTE_QUERY = 'div[rrm-inline-cta]';
const INLINE_CTA_ATTRIUBUTE = 'rrm-inline-cta';
const DEFAULT_PRODUCT_TYPE = ProductType.UI_CONTRIBUTION;

export class InlincCtaApi {
  private readonly doc_: Doc;
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;

  constructor(private readonly deps_: Deps) {
    this.doc_ = deps_.doc();
    this.win_ = deps_.win();
    this.activityPorts_ = deps_.activities();
  }

  init() {}

  actionToUrlPrefix(
    configId: string | null,
    actions: Intervention[] = []
  ): string {
    if (!configId || actions.length <= 0) {
      return '';
    }
    for (const action of actions) {
      if (action.configurationId === configId) {
        return ActionToIframeMapping[action.type];
      }
    }
    return '';
  }

  async attachInlineCtaWithAttribute(
    div: HTMLElement,
    actions: Intervention[] = []
  ) {
    const configId = div.getAttribute(INLINE_CTA_ATTRIUBUTE);
    const urlPrefix = this.actionToUrlPrefix(configId, actions);
    if (!urlPrefix) {
      return;
    }
    const iframeParams: {[key: string]: string} = {
      'origin': parseUrl(this.win_.location.href).origin,
      'configurationId': configId || '',
      'isClosable': 'false',
      'calledManually': 'false',
      'previewEnabled': 'false',
      'publicationId': this.deps_.pageConfig().getPublicationId(),
      'ctaMode': 'CTA_MODE_INLINE',
    };
    const fetchUrl = feUrl(urlPrefix, iframeParams);
    const fetchArgs = feArgs({
      'supportsEventManager': true,
      'productType': DEFAULT_PRODUCT_TYPE,
    });
    const activityIframeView = new ActivityIframeView(
      this.win_,
      this.activityPorts_,
      fetchUrl,
      fetchArgs
    );
    setImportantStyles(activityIframeView.getElement(), {
      'height': '100%',
      'width': '100%',
    });

    div.appendChild(activityIframeView.getElement());

    const port = await this.activityPorts_.openIframe(
      activityIframeView.getElement(),
      fetchUrl,
      fetchArgs
    );
    await port.whenReady();
  }

  attachInlineCtasWithAttribute(actions: Intervention[] = []) {
    const elements: HTMLElement[] = Array.from(
      this.doc_.getWin().document.querySelectorAll(INLINE_CTA_ATTRIUBUTE_QUERY)
    );
    for (const element of elements) {
      this.attachInlineCtaWithAttribute(element, actions);
    }
  }
}
