/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {ActivityPorts} from 'web-activities/activity-ports';
import {LinkAccountsFlow} from './link-accounts-flow';
import {PageConfig} from '../model/page-config';


describes.realWin('Link accounts flow', {}, env => {
  let win;
  let linkAccountsFlow;
  let activityPorts;
  let pageConfig;

  beforeEach(() => {
    win = env.win;
    activityPorts = new ActivityPorts(win);
    pageConfig = new PageConfig({publicationId: 'pub1', label: null});
    linkAccountsFlow = new LinkAccountsFlow(win, pageConfig, activityPorts);
  });

  it('should have valid LinkAccountsFlow constructed', () => {
    const linkAccountsPromise = linkAccountsFlow.start();
    expect(linkAccountsPromise).to.eventually.not.be.null;
  });
});
