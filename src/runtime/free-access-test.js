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

import {FreeAccess} from './free-access';
import {LocationProvider} from './location-provider';

describes.realWin('FreeAccess', () => {
  describe('shouldAllowFreeAccess', () => {
    let originalReferrerDescriptor;

    beforeEach(() => {
      // Save the original property descriptor.
      originalReferrerDescriptor = Object.getOwnPropertyDescriptor(
        self.document,
        'referrer'
      );
    });

    afterEach(() => {
      // Restore the original property descriptor to avoid side effects between tests.
      if (originalReferrerDescriptor) {
        Object.defineProperty(
          self.document,
          'referrer',
          originalReferrerDescriptor
        );
      }
    });

    it('dont allow for non-Google referer', () => {
      const fakeReferrer = 'https://www.googlee.com/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });

      const freeAccess = new FreeAccess();
      expect(freeAccess.shouldAllowFreeAccess()).to.be.false;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    it('allow for Google referer', () => {
      const fakeReferrer = 'https://www.google.com/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });

      const freeAccess = new FreeAccess();
      expect(freeAccess.shouldAllowFreeAccess()).to.be.true;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    it('dont allow for Google referer with explicit holdback', () => {
      const fakeReferrer = 'https://www.google.com/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?foo=bar&eafs_enabled=false');

      const freeAccess = new FreeAccess(mockLocation);

      expect(freeAccess.shouldAllowFreeAccess()).to.be.false;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    it('allow for Google referer with explicit no holdback', () => {
      const fakeReferrer = 'https://www.google.com/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?foo=bar&eafs_enabled=true');

      const freeAccess = new FreeAccess(mockLocation);

      expect(freeAccess.shouldAllowFreeAccess()).to.be.true;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
  });
});
