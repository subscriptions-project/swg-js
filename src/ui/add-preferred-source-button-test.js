/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

import {AddPreferredSourceButton} from './add-preferred-source-button';
import {AddPreferredSourceStatus, AnalyticsEvent} from '../proto/api_messages';
import {ClientEventManager} from '../runtime/client-event-manager';
import {resolveDoc} from '../model/doc';

describes.realWin('AddPreferredSourceButton', (env) => {
  let win;
  let doc;
  let deps;
  let container;
  let eventManagerMock;

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;

    const eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);

    deps = {
      win: () => win,
      doc: () => resolveDoc(win),
      eventManager: () => eventManager,
    };

    container = doc.createElement('div');
    doc.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should attach shadow DOM, configure aria-live, and render light theme button with auto dark mode by default', () => {
    const button = new AddPreferredSourceButton(deps, container);
    const clickHandler = sandbox.spy();

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON,
        false,
        sandbox.match.any
      );

    button.attach(clickHandler);

    expect(container.getAttribute('aria-live')).to.equal('polite');

    const shadow = button.getShadowRoot();
    const buttonEl = shadow.querySelector('publisher-md-outlined-button');
    expect(buttonEl).to.not.be.null;
    expect(buttonEl.textContent).to.include('Add to Preferred Sources');
    expect(buttonEl.getAttribute('title')).to.equal('Add to Preferred Sources');
    expect(buttonEl.getAttribute('aria-label')).to.equal(
      'Add to Preferred Sources'
    );

    const logoEl = shadow.querySelector('.publisher-logo');
    expect(logoEl).to.not.be.null;
    expect(logoEl.getAttribute('alt')).to.equal('');
    expect(logoEl.getAttribute('aria-hidden')).to.equal('true');

    const styleEl = shadow.querySelector('style');
    expect(styleEl.textContent).to.include(
      '@media (prefers-color-scheme: dark)'
    );
  });

  it('should return null for getShadowRoot before attach, and ShadowRoot after attach', () => {
    const button = new AddPreferredSourceButton(deps, container);
    expect(button.getShadowRoot()).to.be.null;

    button.attach(sandbox.spy());
    expect(button.getShadowRoot()).to.not.be.null;
  });

  it('should fallback to global document if container has no ownerDocument', () => {
    const fakeContainer = {
      attachShadow: sandbox.stub().returns(doc.createElement('div')),
      setAttribute: sandbox.spy(),
      ownerDocument: null,
    };
    const button = new AddPreferredSourceButton(deps, fakeContainer);
    button.attach(sandbox.spy());
    expect(fakeContainer.attachShadow).to.have.been.calledOnce;
    expect(fakeContainer.setAttribute).to.have.been.calledWith(
      'aria-live',
      'polite'
    );
  });

  it('should render dark theme styles without media query when theme is dark', () => {
    const button = new AddPreferredSourceButton(deps, container, {
      theme: 'dark',
    });
    button.attach(sandbox.spy());

    const shadow = button.getShadowRoot();
    const styleEl = shadow.querySelector('style');
    expect(styleEl.textContent).to.include('#202124');
    expect(styleEl.textContent).to.include('#5f6368');
    expect(styleEl.textContent).to.not.include(
      '@media (prefers-color-scheme: dark)'
    );
  });

  it('should render explicit light theme styles without media query when theme is light', () => {
    const button = new AddPreferredSourceButton(deps, container, {
      theme: 'light',
    });
    button.attach(sandbox.spy());

    const shadow = button.getShadowRoot();
    const styleEl = shadow.querySelector('style');
    expect(styleEl.textContent).to.include('#ffffff');
    expect(styleEl.textContent).to.include('#c4c7c5');
    expect(styleEl.textContent).to.not.include(
      '@media (prefers-color-scheme: dark)'
    );
  });

  it('should render auto theme styles with media query when theme is auto', () => {
    const button = new AddPreferredSourceButton(deps, container, {
      theme: 'auto',
    });
    button.attach(sandbox.spy());

    const shadow = button.getShadowRoot();
    const styleEl = shadow.querySelector('style');
    expect(styleEl.textContent).to.include(
      '@media (prefers-color-scheme: dark)'
    );
  });

  it('should render localized text for specified language', () => {
    const button = new AddPreferredSourceButton(deps, container, {
      lang: 'es',
    });
    button.attach(sandbox.spy());

    const shadow = button.getShadowRoot();
    const textEl = shadow.querySelector('.publisher-btn-text');
    expect(textEl.textContent).to.equal('Añadir a fuentes preferidas');
  });

  it('should ignore untrusted synthetic click events', async () => {
    const button = new AddPreferredSourceButton(deps, container);
    const clickHandler = sandbox.spy();

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON,
        false,
        sandbox.match.any
      )
      .once();

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCES_BUTTON_CLICK,
        true,
        sandbox.match.any
      )
      .never();

    button.attach(clickHandler);

    const shadow = button.getShadowRoot();
    const buttonEl = shadow.querySelector('publisher-md-outlined-button');

    // 1. Synthetic DOM event (has isTrusted === false by default in JS)
    buttonEl.dispatchEvent(new win.CustomEvent('click'));
    expect(clickHandler).to.not.have.been.called;

    // 2. Direct untrusted invocation
    await button.handleClick({isTrusted: false});
    expect(clickHandler).to.not.have.been.called;

    eventManagerMock.verify();
  });

  it('should handle click event, log analytics, and execute callback', async () => {
    const button = new AddPreferredSourceButton(deps, container);
    const clickHandler = sandbox.spy();

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON,
        false,
        sandbox.match.any
      )
      .once();

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCES_BUTTON_CLICK,
        true,
        sandbox.match.any
      )
      .once();

    button.attach(clickHandler);

    await button.handleClick({isTrusted: true});

    expect(clickHandler).to.have.been.calledOnce;
    eventManagerMock.verify();
  });

  it('should embed canonical url from link rel=canonical tag in analytics events', () => {
    const canonicalLink = doc.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    canonicalLink.setAttribute('href', 'https://publisher.com/canonical-story');
    doc.head.appendChild(canonicalLink);

    const button = new AddPreferredSourceButton(deps, container);

    eventManagerMock.expects('logSwgEvent').withExactArgs(
      AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON,
      false,
      sandbox.match((params) => {
        return (
          params.getCanonicalUrl() === 'https://publisher.com/canonical-story'
        );
      })
    );

    button.attach(sandbox.spy());
    eventManagerMock.verify();

    doc.head.removeChild(canonicalLink);
  });

  it('should update to soft-disabled state with aria-disabled on SUCCESS and suppress clicks', async () => {
    const button = new AddPreferredSourceButton(deps, container, {
      lang: 'en',
    });
    const clickHandler = sandbox.spy();
    button.attach(clickHandler);

    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
    );

    const shadow = button.getShadowRoot();
    const textEl = shadow.querySelector('.publisher-btn-text');
    const buttonEl = shadow.querySelector('publisher-md-outlined-button');

    expect(textEl.textContent).to.equal('Added to Preferred Sources');
    expect(buttonEl.getAttribute('title')).to.equal(
      'Added to Preferred Sources'
    );
    expect(buttonEl.getAttribute('aria-label')).to.equal(
      'Added to Preferred Sources'
    );
    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(buttonEl.hasAttribute('soft-disabled')).to.be.true;

    // Verify clicks are suppressed when soft-disabled
    await button.handleClick({isTrusted: true});
    expect(clickHandler).to.not.have.been.called;
  });

  it('should update to soft-disabled state with aria-disabled on ALREADY_ADDED and suppress clicks', async () => {
    const button = new AddPreferredSourceButton(deps, container, {
      lang: 'en',
    });
    const clickHandler = sandbox.spy();
    button.attach(clickHandler);

    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
    );

    const shadow = button.getShadowRoot();
    const textEl = shadow.querySelector('.publisher-btn-text');
    const buttonEl = shadow.querySelector('publisher-md-outlined-button');

    expect(textEl.textContent).to.equal('Added to Preferred Sources');
    expect(buttonEl.getAttribute('title')).to.equal(
      'Added to Preferred Sources'
    );
    expect(buttonEl.getAttribute('aria-label')).to.equal(
      'Added to Preferred Sources'
    );
    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(buttonEl.hasAttribute('soft-disabled')).to.be.true;

    // Verify clicks are suppressed
    await button.handleClick({isTrusted: true});
    expect(clickHandler).to.not.have.been.called;
  });

  it('should update to soft-disabled state with aria-disabled on INELIGIBLE and suppress clicks', async () => {
    const button = new AddPreferredSourceButton(deps, container, {
      lang: 'en',
    });
    const clickHandler = sandbox.spy();
    button.attach(clickHandler);

    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
    );

    const shadow = button.getShadowRoot();
    const buttonEl = shadow.querySelector('publisher-md-outlined-button');
    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(buttonEl.hasAttribute('soft-disabled')).to.be.true;

    // Verify clicks are suppressed
    await button.handleClick({isTrusted: true});
    expect(clickHandler).to.not.have.been.called;
  });

  it('should apply initial status and fallback to default English if updateStatus is called before attach without options', () => {
    const button = new AddPreferredSourceButton(deps, container);
    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
    );
    button.attach(sandbox.spy());

    const shadow = button.getShadowRoot();
    const textEl = shadow.querySelector('.publisher-btn-text');
    const buttonEl = shadow.querySelector('publisher-md-outlined-button');

    expect(textEl.textContent).to.equal('Added to Preferred Sources');
    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(buttonEl.hasAttribute('soft-disabled')).to.be.true;
  });

  it('should return early when updateStatus is called with undefined', () => {
    const button = new AddPreferredSourceButton(deps, container, {
      lang: 'en',
    });
    button.attach(sandbox.spy());

    button.updateStatus(undefined);

    const shadow = button.getShadowRoot();
    const textEl = shadow.querySelector('.publisher-btn-text');
    const buttonEl = shadow.querySelector('publisher-md-outlined-button');

    expect(textEl.textContent).to.equal('Add to Preferred Sources');
    expect(buttonEl.hasAttribute('aria-disabled')).to.be.false;
    expect(buttonEl.hasAttribute('soft-disabled')).to.be.false;
  });

  it('should suppress errors when eventManager throws during analytics logging', () => {
    sandbox
      .stub(deps.eventManager(), 'logSwgEvent')
      .throws(new Error('Analytics failure'));
    const button = new AddPreferredSourceButton(deps, container);
    expect(() => {
      button.attach(sandbox.spy());
    }).to.not.throw();
  });
});
