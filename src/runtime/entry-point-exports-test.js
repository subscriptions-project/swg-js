/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
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

import * as main from '../main';
import * as basicMain from '../basic-main';
import * as gaaMain from '../gaa-main';

describes.realWin('Entry Point Exports', () => {
  it('main.ts should export subscriptions', () => {
    expect(main.subscriptions).to.be.an('object');
    expect(main.subscriptions.init).to.be.a('function');
    expect(main.subscriptions.ready).to.be.a('function');
  });

  it('basic-main.ts should export subscriptions', () => {
    expect(basicMain.subscriptions).to.be.an('object');
    expect(basicMain.subscriptions.init).to.be.a('function');
    expect(basicMain.subscriptions.ready).to.be.a('function');
  });

  it('gaa-main.ts should export GAA components', () => {
    expect(gaaMain.GaaGoogleSignInButton).to.be.a('function');
    expect(gaaMain.GaaGoogle3pSignInButton).to.be.a('function');
    expect(gaaMain.GaaSignInWithGoogleButton).to.be.a('function');
    expect(gaaMain.GaaMeteringRegwall).to.be.a('function');
    expect(gaaMain.GaaMetering).to.be.a('function');
    expect(gaaMain.GaaMetering.ready).to.be.a('function');
  });
});
