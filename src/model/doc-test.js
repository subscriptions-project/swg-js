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

import {GlobalDoc, resolveDoc} from './doc';

describes.realWin('Doc', {}, env => {
  let win, doc;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
  });

  describe('constructor', () => {
    it('should create based on a window', async () => {
      const gd = new GlobalDoc(win);
      expect(gd.getWin()).to.equal(win);
      expect(gd.getRootNode()).to.equal(doc);
      expect(gd.getRootElement()).to.equal(doc.documentElement);
      expect(gd.getHead()).to.equal(doc.head);
      expect(gd.getBody()).to.equal(doc.body);
      expect(gd.isReady()).to.be.true;
      await gd.whenReady();
    });

    it('should create based on a document', async () => {
      const gd = new GlobalDoc(doc);
      expect(gd.getWin()).to.equal(win);
      expect(gd.getRootNode()).to.equal(doc);
      expect(gd.getRootElement()).to.equal(doc.documentElement);
      expect(gd.getHead()).to.equal(doc.head);
      expect(gd.getBody()).to.equal(doc.body);
      expect(gd.isReady()).to.be.true;
      await gd.whenReady();
    });

    it('should create non-ready doc', async () => {
      doc = {readyState: 'loading', head: null, body: null};
      const eventHandlers = {};
      doc.addEventListener = (type, callback) => {
        eventHandlers[type] = callback;
      };
      doc.removeEventListener = (type, callback) => {
        if (eventHandlers[type] == callback) {
          delete eventHandlers[type];
        }
      };
      const gd = new GlobalDoc(doc);
      expect(gd.getRootNode()).to.equal(doc);
      expect(gd.getHead()).to.be.null;
      expect(gd.getBody()).to.be.null;
      expect(gd.isReady()).to.be.false;

      const readyPromise = gd.whenReady();
      expect(eventHandlers['readystatechange']).to.exist;

      doc.readyState = 'interactive';
      eventHandlers['readystatechange']();
      await readyPromise;
      expect(gd.isReady()).to.be.true;
      expect(eventHandlers['readystatechange']).to.not.exist;
    });
  });

  describe('resolveDoc', () => {
    it('should resolve doc from a window', () => {
      const gd = resolveDoc(win);
      expect(gd.getWin()).to.equal(win);
      expect(gd.getRootNode()).to.equal(doc);
    });

    it('should resolve doc from a document', () => {
      const gd = resolveDoc(doc);
      expect(gd.getWin()).to.equal(win);
      expect(gd.getRootNode()).to.equal(doc);
    });

    it('should resolve doc from a doc', () => {
      const base = new GlobalDoc(doc);
      expect(resolveDoc(base)).to.equal(base);
    });
  });
});
