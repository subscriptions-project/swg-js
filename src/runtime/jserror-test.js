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

import {JsError} from './jserror';
import {parseQueryString, parseUrl} from '../utils/url';
import {resolveDoc} from '../model/doc';

describes.realWin('JsError', {}, env => {
  let doc;
  let jsError;
  let elements;

  beforeEach(() => {
    doc = env.win.document;
    jsError = new JsError(resolveDoc(doc));
    elements = [];
    sandbox.stub(doc, 'createElement').callsFake(name => {
      const element = {name};
      elements.push(element);
      return element;
    });
  });

  it('should report an error', () => {
    const error = new Error('broken');
    return jsError.error(error).then(() => {
      expect(elements).to.have.length(1);
      expect(elements[0].name).to.equal('img');
      const src = parseUrl(elements[0].src);
      const params = parseQueryString(src.search);
      expect(src.pathname).to.equal(
        '/$frontend$/_/SubscribewithgoogleClientUi/jserror'
      );
      expect(params['script']).to.equal('$frontend$/swg/js/v1/swg.js');
      expect(params['line']).to.equal('1');
      expect(params['error']).to.equal('Error: broken');
      expect(params['trace']).to.match(/Error: broken/);
      expect(error.reported).to.be.true;
    });
  });

  it('should ignore an already reported error', () => {
    const error = new Error('broken');
    error.reported = true;
    return jsError.error(error).then(() => {
      expect(elements).to.have.length(0);
    });
  });

  it('should concatenate all args', () => {
    const error = new Error('broken');
    return jsError.error('A', error, 'B').then(() => {
      expect(elements).to.have.length(1);
      expect(elements[0].name).to.equal('img');
      const src = parseUrl(elements[0].src);
      const params = parseQueryString(src.search);
      expect(src.pathname).to.equal(
        '/$frontend$/_/SubscribewithgoogleClientUi/jserror'
      );
      expect(params['script']).to.equal('$frontend$/swg/js/v1/swg.js');
      expect(params['line']).to.equal('1');
      expect(params['error']).to.equal('Error: A B: broken');
      expect(params['trace']).to.match(/Error: A B: broken/);
    });
  });

  it('should create an error if one not provided', () => {
    return jsError.error('A', 'B').then(() => {
      expect(elements).to.have.length(1);
      expect(elements[0].name).to.equal('img');
      const src = parseUrl(elements[0].src);
      const params = parseQueryString(src.search);
      expect(src.pathname).to.equal(
        '/$frontend$/_/SubscribewithgoogleClientUi/jserror'
      );
      expect(params['script']).to.equal('$frontend$/swg/js/v1/swg.js');
      expect(params['line']).to.equal('1');
      expect(params['error']).to.equal('Error: A B');
      expect(params['trace']).to.match(/Error: A B/);
    });
  });
});
