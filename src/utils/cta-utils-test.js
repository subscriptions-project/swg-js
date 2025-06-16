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

import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from '../runtime/client-config-manager';
import {GlobalDoc} from '../model/doc';
import {MockDeps} from '../../test/mock-deps';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from '../runtime/pay-flow';
import {SkuSelectedResponse} from '../proto/api_messages';
import {Toast} from '../ui/toast';
import {XhrFetcher} from '../runtime/fetcher';
import {
  getContributionsUrl,
  showAlreadyOptedInToast,
  startPayFlow,
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
        /* isInlineCta */ true
      );

      expect(result).to.equal(
        'https://news.google.com/swg/ui/v1/contributionoffersiframe?_=_&publicationId=pub1&hl=fr-CA&ctaMode=CTA_MODE_INLINE'
      );
    });
  });

  describe('startPayFlow', () => {
    it('calls PayStartFlow with right params', async () => {
      const payStub = sandbox.stub(PayStartFlow.prototype, 'start');
      const skuSelected = new SkuSelectedResponse();
      skuSelected.setSku('sku1');
      skuSelected.setOneTime(true);

      startPayFlow(deps, skuSelected);

      expect(payStub).to.be.calledOnce;
      expect(
        payStub.getCalls()[0].thisValue.subscriptionRequest_.skuId
      ).to.equal('sku1');
      expect(payStub.getCalls()[0].thisValue.subscriptionRequest_.oneTime).to.be
        .true;
    });
  });
});
