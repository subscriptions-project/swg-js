import {ActivityPort} from '../components/activities';
import {AudienceActionFlow} from './audience-action-flow';
import {ConfiguredRuntime} from './runtime';
import {Constants} from '../utils/constants';
import {EntitlementsResponse} from '../proto/api_messages';
import {PageConfig} from '../model/page-config';

const WINDOW_LOCATION_DOMAIN = 'https://www.test.com';

describes.realWin('ContributionsFlow', {}, (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let entitlementsManagerMock;
  let storageMock;
  let pageConfig;
  let port;
  let messageMap;
  let fallbackSpy;

  beforeEach(() => {
    win = env.win;
    messageMap = {};
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    storageMock = sandbox.mock(runtime.storage());
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    sandbox.stub(port, 'on').callsFake(function (ctor, cb) {
      const messageType = new ctor();
      const messageLabel = messageType.label();
      messageMap[messageLabel] = cb;
    });
    sandbox.stub(runtime, 'win').returns({
      location: {href: WINDOW_LOCATION_DOMAIN + '/page/1'},
      document: win.document,
    });
    fallbackSpy = sandbox.spy();
  });

  [
    {action: 'TYPE_REGISTRATION_WALL', path: 'regwalliframe'},
    {action: 'TYPE_NEWSLETTER_SIGNUP', path: 'newsletteriframe'},
  ].forEach(({action, path}) => {
    it(`opens a correct AudienceActionFlow constructed with params for ${action}`, async () => {
      const audienceActionFlow = new AudienceActionFlow(runtime, {
        action,
        fallback: fallbackSpy,
      });
      activitiesMock
        .expects('openIframe')
        .withExactArgs(
          sandbox.match((arg) => arg.tagName == 'IFRAME'),
          `$frontend$/swg/_/ui/v1/${path}?_=_&publicationId=pub1&origin=${encodeURIComponent(
            WINDOW_LOCATION_DOMAIN
          )}`,
          {
            _client: 'SwG $internalRuntimeVersion$',
            isClosable: true,
            supportsEventManager: true,
          }
        )
        .resolves(port);

      await audienceActionFlow.start();

      activitiesMock.verify();
      expect(fallbackSpy).to.not.be.called;
    });
  });

  it('calls the fallback when an AudienceActionFlow is cancelled and one it provided', async () => {
    const audienceActionFlow = new AudienceActionFlow(runtime, {
      action: 'TYPE_REGISTRATION_WALL',
      fallback: fallbackSpy,
    });
    activitiesMock.expects('openIframe').resolves(port);
    sandbox
      .stub(port, 'acceptResult')
      .callsFake(() =>
        Promise.reject(new DOMException('cancel', 'AbortError'))
      );

    await audienceActionFlow.start();

    activitiesMock.verify();
    expect(fallbackSpy).to.be.calledOnce;
  });

  [
    {userToken: 'testUserToken', timesStoreSetCalled: 1},
    {userToken: undefined, timesStoreSetCalled: 0},
  ].forEach(({userToken, timesStoreSetCalled}) => {
    it('correctly handles an EntitlementsResponse when returned from the flow', async () => {
      const audienceActionFlow = new AudienceActionFlow(runtime, {
        action: 'TYPE_REGISTRATION_WALL',
        fallback: fallbackSpy,
      });
      activitiesMock.expects('openIframe').resolves(port);
      entitlementsManagerMock.expects('clear').once();
      entitlementsManagerMock.expects('getEntitlements').once();
      storageMock
        .expects('set')
        .withExactArgs(Constants.USER_TOKEN, userToken, true)
        .exactly(timesStoreSetCalled);

      await audienceActionFlow.start();
      const entitlementsResponse = new EntitlementsResponse();
      entitlementsResponse.setSwgUserToken('testUserToken');
      const messageCallback = messageMap[entitlementsResponse.label()];
      messageCallback(entitlementsResponse);

      entitlementsManagerMock.verify();
      storageMock.verify();
    });
  });
});
