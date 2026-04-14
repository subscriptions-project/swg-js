/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
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
  AnalyticsEvent,
  CtaMode,
  EventParams,
  SkuSelectedResponse,
} from '../proto/api_messages';
import {AnalyticsService} from '../runtime/analytics-service';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from '../runtime/client-config-manager';
import {ClientEventManager} from '../runtime/client-event-manager';
import {GlobalDoc} from '../model/doc';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from '../runtime/pay-flow';
import {Toast} from '../ui/toast';
import {XhrFetcher} from '../runtime/fetcher';
import {
  getContributionsUrl,
  getSubscriptionUrl,
  getTimestamps,
  isActionEligible,
  showAlreadyOptedInToast,
  startContributionPayFlow,
  startSubscriptionPayFlow,
} from './cta-utils';

describes.realWin('CTA utils', (env) => {
  let deps;
  let win;
  let doc;
  let toast;
  let toastOpenStub;
  const productId = 'pub1:label1';
  const pubId = 'pub1';

  beforeEach(() => {
    deps = new MockDeps();
    win = Object.assign({}, env.win, {});
    sandbox.stub(deps, 'win').returns(win);
    doc = new GlobalDoc(win);
    sandbox.stub(deps, 'doc').returns(doc);
    sandbox
      .stub(deps, 'clientConfigManager')
      .returns({getLanguage: () => 'en'});
  });

  describe('showAlreadyOptedInToast', () => {
    it('shows basic toast for regwall', () => {
      toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      showAlreadyOptedInToast('TYPE_REGISTRATION_WALL', 'en', deps);

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=basic');
    });

    it('shows custom toast for newsletter', () => {
      toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      showAlreadyOptedInToast('TYPE_NEWSLETTER_SIGNUP', 'en', deps);

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=custom');
      expect(decodeURI(toast.src_)).to.contain('You have signed up before.');
    });

    it('show no toast if other types', () => {
      const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

      showAlreadyOptedInToast('TYPE_REWARDED_SURVEY', 'en', deps);

      expect(toastOpenStub).not.to.be.called;
    });
  });

  describe('getContributionsUrl', () => {
    let fetcher;
    let pageConfig;
    let clientConfigManager;
    beforeEach(() => {
      fetcher = new XhrFetcher(win);
      pageConfig = new PageConfig(productId);
      clientConfigManager = new ClientConfigManager(deps, pubId, fetcher);
    });

    it('returns old url', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: false});

      const result = getContributionsUrl(
        clientConfig,
        clientConfigManager,
        pageConfig
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionsiframe?_=_'
      );
    });

    it('returns new url', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});

      const result = getContributionsUrl(
        clientConfig,
        clientConfigManager,
        pageConfig
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionoffersiframe?_=_&publicationId=pub1'
      );
    });

    it('returns url with language setting', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});
      sandbox
        .stub(clientConfigManager, 'shouldForceLangInIframes')
        .resolves(true);
      sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-CA');

      const result = getContributionsUrl(
        clientConfig,
        clientConfigManager,
        pageConfig
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionoffersiframe?_=_&publicationId=pub1&hl=fr-CA'
      );
    });

    it('returns url with inline cta mode', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});

      const result = getContributionsUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        /* configurationId */ '',
        /* isInlineCta */ true
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionoffersiframe?_=_&publicationId=pub1&ctaMode=CTA_MODE_INLINE'
      );
    });

    it('returns url with inline cta mode and language setting', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});
      sandbox
        .stub(clientConfigManager, 'shouldForceLangInIframes')
        .resolves(true);
      sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-CA');

      const result = getContributionsUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        /* configurationId */ '',
        /* isInlineCta */ true
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionoffersiframe?_=_&publicationId=pub1&hl=fr-CA&ctaMode=CTA_MODE_INLINE'
      );
    });

    it('returns url with purchaseUnavailableRegion', () => {
      const clientConfig = new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {purchaseUnavailableRegion: true},
      });

      const result = getContributionsUrl(
        clientConfig,
        clientConfigManager,
        pageConfig
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionoffersiframe?_=_&publicationId=pub1&purchaseUnavailableRegion=true'
      );
    });

    it('returns url with configurationId', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});

      const result = getContributionsUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        'test_config_id'
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionoffersiframe?_=_&publicationId=pub1&configurationId=test_config_id'
      );
    });
  });

  describe('startContributionPayFlow', () => {
    let analyticsMock;

    beforeEach(() => {
      const eventManager = new ClientEventManager(Promise.resolve());
      sandbox.stub(deps, 'eventManager').returns(eventManager);
      const pageConfig = new PageConfig(productId, true);
      sandbox.stub(deps, 'pageConfig').returns(pageConfig);
      const analyticsService = new AnalyticsService(deps);
      analyticsMock = sandbox.mock(analyticsService);
      sandbox.stub(deps, 'analytics').returns(analyticsService);
    });

    it('calls PayStartFlow with right params', async () => {
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      skuSelected.setOneTime(true);
      analyticsMock
        .expects('removeLabels')
        .withExactArgs(['CTA_MODE_INLINE'])
        .once();

      startContributionPayFlow(deps, skuSelected, /* isInlineCta */ false);

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
      expect(payStub.getCalls()[0].thisValue.subscriptionRequest_.oneTime).to.be
        .true;
      expect(payStub.getCalls()[0].thisValue.isInlineCta_).to.be.false;
    });

    it('calls PayStartFlow with right params for inline CTA', async () => {
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      skuSelected.setOneTime(true);
      analyticsMock
        .expects('addLabels')
        .withExactArgs(['CTA_MODE_INLINE'])
        .once();

      startContributionPayFlow(deps, skuSelected, /* isInlineCta */ true);

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
      expect(payStub.getCalls()[0].thisValue.subscriptionRequest_.oneTime).to.be
        .true;
      expect(payStub.getCalls()[0].thisValue.isInlineCta_).to.be.true;
    });

    it('calls PayStartFlow with right configId params', async () => {
      const configId = 'test_config_id';
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      skuSelected.setOneTime(true);
      analyticsMock
        .expects('addLabels')
        .withExactArgs(['CTA_MODE_INLINE'])
        .once();

      startContributionPayFlow(
        deps,
        skuSelected,
        /* isInlineCta */ true,
        configId
      );

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
      expect(payStub.getCalls()[0].thisValue.subscriptionRequest_.oneTime).to.be
        .true;
      expect(payStub.getCalls()[0].thisValue.isInlineCta_).to.be.true;
      expect(payStub.getCalls()[0].thisValue.configId_).to.equal(configId);
    });
  });

  describe('startSubscriptionPayFlow', () => {
    let analyticsMock;
    let eventManagerMock;

    beforeEach(() => {
      const eventManager = new ClientEventManager(Promise.resolve());
      eventManagerMock = sandbox.mock(eventManager);
      sandbox.stub(deps, 'eventManager').returns(eventManager);
      const pageConfig = new PageConfig(productId, true);
      sandbox.stub(deps, 'pageConfig').returns(pageConfig);
      const analyticsService = new AnalyticsService(deps);
      analyticsMock = sandbox.mock(analyticsService);
      sandbox.stub(deps, 'analytics').returns(analyticsService);
    });

    it('calls PayStartFlow with right params', async () => {
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      skuSelected.setOldSku('sku2');
      analyticsMock.expects('setSku').withExactArgs('sku2').once();
      analyticsMock
        .expects('removeLabels')
        .withExactArgs(['CTA_MODE_INLINE'])
        .once();

      startSubscriptionPayFlow(deps, skuSelected);

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.oldSku
      ).to.equal('sku2');
      expect(payStub.getCalls()[0].thisValue.isInlineCta_).to.be.false;
      analyticsMock.verify();
    });

    it('logs offer selection event', async () => {
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.ACTION_OFFER_SELECTED,
          true,
          new EventParams([, , , , 'sku1', , , , , , , CtaMode.CTA_MODE_POPUP])
        )
        .once();

      startSubscriptionPayFlow(deps, skuSelected);

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
    });

    it('calls PayStartFlow with right params for inline CTA', async () => {
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      analyticsMock
        .expects('addLabels')
        .withExactArgs(['CTA_MODE_INLINE'])
        .once();

      startSubscriptionPayFlow(deps, skuSelected, /* isInlineCta */ true);

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
      expect(payStub.getCalls()[0].thisValue.isInlineCta_).to.be.true;
      analyticsMock.verify();
    });

    it('calls PayStartFlow with right configId params', async () => {
      const configId = 'test_config_id';
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      analyticsMock
        .expects('addLabels')
        .withExactArgs(['CTA_MODE_INLINE'])
        .once();

      startSubscriptionPayFlow(
        deps,
        skuSelected,
        /* isInlineCta */ true,
        configId
      );

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
      expect(payStub.getCalls()[0].thisValue.isInlineCta_).to.be.true;
      expect(payStub.getCalls()[0].thisValue.configId_).to.equal(configId);
      analyticsMock.verify();
    });
  });

  describe('getSubscriptionUrl', () => {
    let fetcher;
    let pageConfig;
    let clientConfigManager;
    const query = 'swg.newoffercard=1';
    beforeEach(() => {
      fetcher = new XhrFetcher(win);
      pageConfig = new PageConfig(productId);
      clientConfigManager = new ClientConfigManager(deps, pubId, fetcher);
    });

    it('returns old url', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: false});

      const result = getSubscriptionUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        query
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/offersiframe?_=_&useNewOfferCard=1'
      );
    });

    it('returns new url', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});

      const result = getSubscriptionUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        query
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/subscriptionoffersiframe?_=_&publicationId=pub1'
      );
    });

    it('returns url with language setting', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});
      sandbox
        .stub(clientConfigManager, 'shouldForceLangInIframes')
        .resolves(true);
      sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-CA');

      const result = getSubscriptionUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        query
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/subscriptionoffersiframe?_=_&publicationId=pub1&hl=fr-CA'
      );
    });

    it('returns url with purchaseUnavailableRegion', () => {
      const clientConfig = new ClientConfig({
        useUpdatedOfferFlows: true,
        uiPredicates: {purchaseUnavailableRegion: true},
      });

      const result = getSubscriptionUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        query
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/subscriptionoffersiframe?_=_&publicationId=pub1&purchaseUnavailableRegion=true'
      );
    });

    it('returns url with inline cta mode', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});

      const result = getSubscriptionUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        query,
        /* configurationId */ '',
        /* isInlineCta */ true
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/subscriptionoffersiframe?_=_&publicationId=pub1&ctaMode=CTA_MODE_INLINE'
      );
    });

    it('returns url with inline cta mode and language setting', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});
      sandbox
        .stub(clientConfigManager, 'shouldForceLangInIframes')
        .resolves(true);
      sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-CA');

      const result = getSubscriptionUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        query,
        /* configurationId */ '',
        /* isInlineCta */ true
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/subscriptionoffersiframe?_=_&publicationId=pub1&hl=fr-CA&ctaMode=CTA_MODE_INLINE'
      );
    });

    it('returns url with configurationId', () => {
      const clientConfig = new ClientConfig({useUpdatedOfferFlows: true});

      const result = getSubscriptionUrl(
        clientConfig,
        clientConfigManager,
        pageConfig,
        query,
        'test_config_id'
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/subscriptionoffersiframe?_=_&publicationId=pub1&configurationId=test_config_id'
      );
    });
  });

  describe('isActionEligible', () => {
    let eventManagerStub;

    beforeEach(() => {
      eventManagerStub = {
        logSwgEvent: sandbox.stub(),
      };
      sandbox.stub(deps, 'eventManager').returns(eventManagerStub);
    });

    it('Survey is eligible when gTag logging is eligible', () => {
      win.gtag = () => {};
      delete win.ga;
      delete win.dataLayer;

      const isEligible = isActionEligible(
        {type: 'TYPE_REWARDED_SURVEY'},
        deps,
        {}
      );

      expect(isEligible).to.be.true;
    });

    it('Survey is eligible when GA logging is eligible', () => {
      win.ga = () => {};
      delete win.gtag;
      delete win.dataLayer;

      const isEligible = isActionEligible(
        {type: 'TYPE_REWARDED_SURVEY'},
        deps,
        {}
      );

      expect(isEligible).to.be.true;
    });

    it('Survey is eligible when GTM logging is eligible', () => {
      win.dataLayer = [];
      delete win.ga;
      delete win.gtag;

      const isEligible = isActionEligible(
        {type: 'TYPE_REWARDED_SURVEY'},
        deps,
        {}
      );

      expect(isEligible).to.be.true;
    });

    it('Survey is not eligible when no Analytics logging is eligible', () => {
      delete win.gtag;
      delete win.ga;
      delete win.dataLayer;

      const isEligible = isActionEligible(
        {type: 'TYPE_REWARDED_SURVEY'},
        deps,
        {}
      );

      expect(isEligible).to.be.false;
    });

    it('Survey is not eligible when there are previous completions', () => {
      const isEligible = isActionEligible(
        {type: 'TYPE_REWARDED_SURVEY'},
        deps,
        {
          'TYPE_REWARDED_SURVEY': {
            'impressions': [],
            'dismissals': [],
            'completions': [123456789],
          },
        }
      );

      expect(isEligible).to.be.false;
    });

    it('Rewarded ad is not eligible when googletag is not available', () => {
      win.googletag = undefined;

      const isEligible = isActionEligible({type: 'TYPE_REWARDED_AD'}, deps, {});

      expect(isEligible).to.be.false;
      expect(eventManagerStub.logSwgEvent).to.be.calledWith(
        AnalyticsEvent.EVENT_REWARDED_AD_GPT_FILTERED
      );
    });

    it('Rewarded ad is not eligible when fake googletag api is available', () => {
      win.googletag = {
        apiReady: true,
        getVersion: () => '',
      };

      const isEligible = isActionEligible({type: 'TYPE_REWARDED_AD'}, deps, {});

      expect(isEligible).to.be.false;
      expect(eventManagerStub.logSwgEvent).to.be.calledWith(
        AnalyticsEvent.EVENT_REWARDED_AD_GPT_FILTERED
      );
    });

    it('Rewarded ad is eligible when googletag available', () => {
      win.googletag = {
        apiReady: true,
        getVersion: () => 'foo',
      };

      const isEligible = isActionEligible({type: 'TYPE_REWARDED_AD'}, deps, {});

      expect(isEligible).to.be.true;
      expect(eventManagerStub.logSwgEvent).to.not.be.called;
    });

    it('Rewarded ad with adsense is not eligible when adsbygoogle is not available', () => {
      win.adsbygoogle = undefined;

      const isEligible = isActionEligible(
        {
          type: 'TYPE_REWARDED_AD',
          preference: 'PREFERENCE_ADSENSE_REWARDED_AD',
        },
        deps,
        {}
      );

      expect(isEligible).to.be.false;
      expect(eventManagerStub.logSwgEvent).to.be.calledWith(
        AnalyticsEvent.EVENT_REWARDED_AD_ADSENSE_FILTERED
      );
    });

    it('Rewarded ad with adsense is eligible when adsbygoogle is available', () => {
      win.adsbygoogle = {loaded: true};

      const isEligible = isActionEligible(
        {
          type: 'TYPE_REWARDED_AD',
          preference: 'PREFERENCE_ADSENSE_REWARDED_AD',
        },
        deps,
        {}
      );

      expect(isEligible).to.be.true;
      expect(eventManagerStub.logSwgEvent).to.not.be.called;
    });
  });

  describe('getTimestamps', () => {
    let storageMock;
    let eventManagerStub;

    beforeEach(() => {
      storageMock = {
        get: sandbox.stub(),
      };
      sandbox.stub(deps, 'storage').returns(storageMock);

      eventManagerStub = {
        logSwgEvent: sandbox.stub(),
      };
      sandbox.stub(deps, 'eventManager').returns(eventManagerStub);
    });

    [
      '12345',
      'this is a string',
      '[]',
      JSON.stringify({
        'TYPE_CONTRIBUTION': {},
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
        },
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0, 'not a timestamps'],
          completions: [],
        },
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0],
          completions: [],
          extraField: [],
        },
      }),
      JSON.stringify({
        'TYPE_CONTRIBUTION': {
          impressions: [55555, 99999],
          dismissals: [0],
          completions: [],
        },
        'TYPE WITH EMPTY TIMESTAMPS': {},
      }),
    ].forEach((timestamps, index) => {
      it(`should return empty object for invalid timestamps - case ${index}`, async () => {
        storageMock.get.resolves(timestamps);

        const result = await getTimestamps(deps);

        expect(result).to.deep.equal({});
        expect(eventManagerStub.logSwgEvent).to.be.calledWith(
          AnalyticsEvent.EVENT_LOCAL_STORAGE_TIMESTAMPS_PARSING_ERROR
        );
      });
    });

    it('should return valid object for valid timestamps', async () => {
      const now = Date.now();
      const validTimestamps = {
        'TYPE_CONTRIBUTION': {
          impressions: [now],
          dismissals: [now],
          completions: [now],
        },
      };
      storageMock.get.resolves(JSON.stringify(validTimestamps));

      const result = await getTimestamps(deps);

      expect(result).to.deep.equal(validTimestamps);
      expect(eventManagerStub.logSwgEvent).to.not.be.called;
    });
  });
});
