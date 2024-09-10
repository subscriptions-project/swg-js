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

import * as audienceActionFlow from '../runtime/audience-action-flow';
import * as audienceActionLocalFlow from '../runtime/audience-action-local-flow';
import {AvailableIntervention} from './available-intervention';
import {InterventionType} from './intervention-type';
import {MockDeps} from '../../test/mock-deps';

describes.realWin('AvailableIntervention', (env) => {
  let deps;

  beforeEach(() => {
    deps = new MockDeps()
  });

  it('calls audience action flow', async () => {
    const startStub = sandbox.stub();
    const actionFlowStub = sandbox
      .stub(audienceActionFlow, 'AudienceActionIframeFlow')
      .returns({start: startStub});

    const availableIntervention = new AvailableIntervention({
        type: InterventionType.TYPE_NEWSLETTER_SIGNUP,
        configurationId: 'TEST_CONFIGURATION_ID',
      },
      deps
    );

    await availableIntervention.show({
      isClosable: true,
      suppressToast: true,
    });

    expect(actionFlowStub).to.have.been.calledWith(deps, {
      isClosable: true,
      action: InterventionType.TYPE_NEWSLETTER_SIGNUP,
      configurationId: 'TEST_CONFIGURATION_ID',
      onResult: undefined,
      calledManually: true,
      suppressToast: true,
    });
    expect(startStub).to.have.been.calledOnce;
  });

  it('calls audience action local flow', async () => {
    const onResultHanlder = () => {};
    const alternateActionHandler = () => {};
    const signInHandler = () => {};
    const startStub = sandbox.stub();
    const actionFlowStub = sandbox
      .stub(audienceActionLocalFlow, 'AudienceActionLocalFlow')
      .returns({start: startStub});

    const availableIntervention = new AvailableIntervention({
        type: InterventionType.TYPE_REWARDED_AD,
        configurationId: 'TEST_CONFIGURATION_ID',
      },
      deps
    );

    await availableIntervention.show({
      isClosable: true,
      onResult: onResultHanlder,
      onAlternateAction: alternateActionHandler,
      onSignIn: signInHandler,
    });

    expect(actionFlowStub).to.have.been.calledWith(deps, {
      isClosable: true,
      action: InterventionType.TYPE_REWARDED_AD,
      configurationId: 'TEST_CONFIGURATION_ID',
      onResult: onResultHanlder,
      calledManually: true,
      onAlternateAction: alternateActionHandler,
      onSignIn: signInHandler,
    });
    expect(startStub).to.have.been.calledOnce;
  });

  it('throws for unsupported action', async () => {
    const availableIntervention = new AvailableIntervention({
        type: 'UNSUPPORTED_ACTION',
        configurationId: 'TEST_CONFIGURATION_ID',
      },
      deps
    );

    expect(availableIntervention.show({}))
      .to.eventually.be.rejectedWith("Can't show UNSUPPORTED_ACTION");
  });
});
