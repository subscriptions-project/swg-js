/* eslint-disable swg-internal/no-export-side-effect */
/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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

import {ButtonApi} from '../runtime/button-api';

const buttonApi = new ButtonApi(null, new Promise(() => {}));

export default {
  title: 'Contribute button',
};

const Template = (args) => {
  // Add button CSS.
  const cssHtml = `<link rel="stylesheet" type="text/css" href="/swg-button.css"></link>`;
  self.document.body.insertAdjacentHTML('beforeend', cssHtml);

  // Render button.
  const buttonEl = self.document.createElement('div');
  buttonApi.attachContributeButton(buttonEl, {
    enable: args.enable,
    lang: args.language,
  });
  return buttonEl;
};

export const Enabled = Template.bind({});
Enabled.args = {enable: true, language: 'en'};

export const Disabled = Template.bind({});
Disabled.args = {...Enabled.args, enable: false};
