/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

import {createElement} from './dom';
import {msg} from './i18n';

const LANG_MAP = {
  'en': 'English',
  'es': 'Spanish',
  'es-latn': 'Spanish Latin',
  'es-latn-other': 'Spanish Latin Other',
};

describes.realWin('FriendlyIframe', {}, (env) => {
  let doc;
  let elementNoLang;
  let elementEs;
  let elementEsLatn;

  beforeEach(() => {
    doc = env.win.document;
    elementNoLang = createElement(doc, 'button', {});
    elementEs = createElement(doc, 'button', {lang: 'es'});
    elementEsLatn = createElement(doc, 'button', {lang: 'es-latn'});
  });

  it('should to default to en', () => {
    expect(msg(LANG_MAP, null)).to.equal('English');
    expect(msg(LANG_MAP, '')).to.equal('English');
    expect(msg(LANG_MAP, 'pirate')).to.equal('English');
    expect(msg(LANG_MAP, elementNoLang)).to.equal('English');
    expect(msg(LANG_MAP, {})).to.equal('English');
    expect(msg(LANG_MAP, 'en')).to.equal('English');
    expect(msg(LANG_MAP, 'en-GB')).to.equal('English');
  });

  it('should resolve top-level language', () => {
    expect(msg(LANG_MAP, 'es')).to.equal('Spanish');
    expect(msg(LANG_MAP, elementEs)).to.equal('Spanish');
    expect(msg(LANG_MAP, 'es-unknown')).to.equal('Spanish');
  });

  it('should resolve second-level spec', () => {
    expect(msg(LANG_MAP, 'es-latn')).to.equal('Spanish Latin');
    expect(msg(LANG_MAP, elementEsLatn)).to.equal('Spanish Latin');
  });

  it('should resolve third-level spec', () => {
    expect(msg(LANG_MAP, 'es-latn-other')).to.equal('Spanish Latin Other');
    expect(msg(LANG_MAP, 'es-latn-unknown')).to.equal('Spanish Latin');
  });

  it('should default to document', () => {
    expect(msg(LANG_MAP, elementNoLang)).to.equal('English');
    doc.documentElement.setAttribute('lang', 'es-latn');
    expect(msg(LANG_MAP, elementNoLang)).to.equal('Spanish Latin');
  });

  it('should support uncommon forms', () => {
    expect(msg(LANG_MAP, 'es-Latn')).to.equal('Spanish Latin');
    expect(msg(LANG_MAP, 'es-LATN')).to.equal('Spanish Latin');
    expect(msg(LANG_MAP, 'ES-LATN')).to.equal('Spanish Latin');
    expect(msg(LANG_MAP, 'es_latn')).to.equal('Spanish Latin');
    expect(msg(LANG_MAP, 'es-Latn_other')).to.equal('Spanish Latin Other');
    expect(msg(LANG_MAP, 'es-Latn_oThEr')).to.equal('Spanish Latin Other');
  });
});
