import {ActivityPorts} from '../components/activities';
import {AddPreferredSourceButtonIframe} from '../ui/add-preferred-source-button-iframe';
import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {
  AddPreferredSourceResponse,
  AddPreferredSourceStatus,
} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {Callbacks} from './callbacks';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {ClientTheme, Config} from '../api/subscriptions';
import {Deps} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {Doc, resolveDoc} from '../model/doc';
import {EntitlementsManager} from './entitlements-manager';
import {GisInteropManager} from './gis/gis-interop-manager';
import {JsError} from './jserror';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {PayClient} from './pay-client';
import {
  PreferredSourceApi,
  PreferredSourceButtonOptions,
} from '../api/preferred-source';
import {Storage} from './storage';
import {Toast} from '../ui/toast';
import {feUrl} from './services';
const PUBLISHER_RUNTIME_PROP = 'PREFERRED_SOURCE';

export function installPublisherRuntime(win: Window): void {
  const pubWin = win as unknown as {[key: string]: unknown};
  if (
    pubWin[PUBLISHER_RUNTIME_PROP] &&
    !Array.isArray(pubWin[PUBLISHER_RUNTIME_PROP])
  ) {
    return;
  }

  const runtime = new PublisherRuntime(win);
  const publicRuntime = createPublicPublisherRuntime(runtime);

  const waitingCallbacks = ([] as ((api: PreferredSourceApi) => void)[]).concat(
    (pubWin[PUBLISHER_RUNTIME_PROP] as ((api: PreferredSourceApi) => void)[]) ||
      []
  );
  for (const callback of waitingCallbacks) {
    if (typeof callback === 'function') {
      callback(publicRuntime);
    }
  }

  pubWin[PUBLISHER_RUNTIME_PROP] = {
    push: (callback: (api: PreferredSourceApi) => void) => {
      if (typeof callback === 'function') {
        callback(publicRuntime);
      }
    },
  };

  const script =
    win.document.currentScript ||
    win.document.querySelector('script[src*="publisher.js"]');
  const control = script?.getAttribute('preferred-sources-control');
  if (control !== 'manual') {
    publicRuntime.init();
  }
}

class ConfiguredPublisherRuntime implements Deps {
  private readonly win_: Window;
  private readonly activityPorts_: ActivityPorts;
  private readonly dialogManager_: DialogManager;
  private readonly clientConfigManager_: ClientConfigManager;

  constructor(
    private readonly doc_: Doc,
    private readonly pageConfig_: PageConfig
  ) {
    this.win_ = doc_.getWin();
    this.activityPorts_ = new ActivityPorts(this);

    // Mock the narrow slice of ClientConfigManager used by DialogManager/Toast
    this.clientConfigManager_ = {
      getLanguage: () => doc_.getRootElement().lang || 'en',
      getTheme: () => ClientTheme.LIGHT,
    } as unknown as ClientConfigManager;

    this.dialogManager_ = new DialogManager(doc_, this.clientConfigManager_);
  }

  doc() {
    return this.doc_;
  }
  win() {
    return this.win_;
  }
  pageConfig() {
    return this.pageConfig_;
  }
  activities() {
    return this.activityPorts_;
  }
  dialogManager() {
    return this.dialogManager_;
  }
  clientConfigManager() {
    return this.clientConfigManager_;
  }

  analytics() {
    return {
      getContext: () => ({
        toArray: () => [],
      }),
    } as unknown as AnalyticsService;
  }

  config() {
    return {} as Config;
  }
  payClient(): PayClient {
    throw new Error('Unused');
  }
  entitlementsManager(): EntitlementsManager {
    throw new Error('Unused');
  }
  callbacks(): Callbacks {
    throw new Error('Unused');
  }
  storage(): Storage {
    throw new Error('Unused');
  }
  jserror(): JsError {
    throw new Error('Unused');
  }
  eventManager(): ClientEventManager {
    throw new Error('Unused');
  }
  creationTimestamp(): number {
    return Date.now();
  }
  gisInteropManager(): GisInteropManager | undefined {
    return undefined;
  }
}

export class PublisherRuntime implements PreferredSourceApi {
  private readonly doc_;

  constructor(win: Window) {
    this.doc_ = resolveDoc(win);
  }

  private depsPromise_: Promise<Deps> | null = null;

  private getDeps_(): Promise<Deps> {
    if (this.depsPromise_) {
      return this.depsPromise_;
    }
    const pageConfigResolver = new PageConfigResolver(this.doc_);
    this.depsPromise_ = pageConfigResolver
      .resolveConfig()
      .then(
        (pageConfig) => new ConfiguredPublisherRuntime(this.doc_, pageConfig)
      );
    return this.depsPromise_;
  }

  init(options?: PreferredSourceButtonOptions): void {
    this.initAsync_(options).catch(() => {});
  }

  private async initAsync_(
    options?: PreferredSourceButtonOptions
  ): Promise<void> {
    const lang = options?.lang || this.doc_.getRootElement().lang || 'en';
    const theme = options?.theme || 'light';

    const buttons = this.doc_
      .getRootNode()
      .querySelectorAll('[google-add-preferred-source-btn]');

    const deps = await this.getDeps_();
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (!button.hasAttribute('data-initialized')) {
        button.setAttribute('data-initialized', 'true');
        const iframe = new AddPreferredSourceButtonIframe(deps, button, {
          lang,
          theme,
        });
        iframe
          .attach(() => {
            this.startFlow_(deps);
          })
          .catch(() => {});
      }
    }
  }

  addPreferredSource(): void {
    this.getDeps_()
      .then((deps) => {
        this.startFlow_(deps);
      })
      .catch(() => {});
  }

  private startFlow_(deps: Deps) {
    new AddPreferredSourceFlow(deps)
      .start()
      .then((response) => {
        this.showToast_(response).catch(() => {});
      })
      .catch(() => {});
  }

  private async showToast_(
    response: AddPreferredSourceResponse
  ): Promise<void> {
    const deps = await this.getDeps_();

    const flavor = getToastFlavor(response.getStatus());
    if (!flavor) {
      return;
    }

    new Toast(
      deps,
      feUrl('/toastiframe', {
        flavor,
        source: this.doc_.getWin().location.href,
      })
    )
      .open()
      .catch(() => {});
  }
}

function getToastFlavor(
  status: AddPreferredSourceStatus | null
): string | null {
  switch (status) {
    case AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS:
      return 'add_preferred_source';
    case AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED:
      return 'already_added_preferred_source';
    default:
      return null;
  }
}

function createPublicPublisherRuntime(
  runtime: PublisherRuntime
): PreferredSourceApi {
  return {
    init: runtime.init.bind(runtime),
    addPreferredSource: runtime.addPreferredSource.bind(runtime),
  };
}
