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
    // Google News web (https://news.google.*) requires an affirmative
    // eafs_enabled=true.
    it('do not allow for Google News web referrer without eafs_enabled', () => {
      const fakeReferrer = 'https://news.google.com/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?foo=bar');
      const freeAccess = new FreeAccess(mockLocation);
      expect(freeAccess.shouldAllowFreeAccess()).to.be.false;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    it('allow for Google News web referer with eafs_enabled=true', () => {
      const fakeReferrer = 'https://news.google.com/';
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
    it('dont allow for Google News web referer with eafs_enabled=false', () => {
      const fakeReferrer = 'https://news.google.com/';
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
    it('allow for non-.com Google News web referer with eafs_enabled=true', () => {
      const fakeReferrer = 'https://news.google.co.uk/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?eafs_enabled=true');
      const freeAccess = new FreeAccess(mockLocation);
      expect(freeAccess.shouldAllowFreeAccess()).to.be.true;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    it('dont allow for lookalike Google News web referer with eafs_enabled=true', () => {
      const fakeReferrer = 'https://news.googlee.com/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?eafs_enabled=true');
      const freeAccess = new FreeAccess(mockLocation);
      expect(freeAccess.shouldAllowFreeAccess()).to.be.false;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    // Google News Android app (android-app://com.google.android.apps.magazines)
    // requires an affirmative eafs_enabled=true.
    it('dont allow for Google News Android referer without eafs_enabled', () => {
      const fakeReferrer = 'android-app://com.google.android.apps.magazines';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?foo=bar');
      const freeAccess = new FreeAccess(mockLocation);
      expect(freeAccess.shouldAllowFreeAccess()).to.be.false;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    it('allow for Google News Android referer with eafs_enabled=true', () => {
      const fakeReferrer = 'android-app://com.google.android.apps.magazines';
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
    it('dont allow for Google News Android referer with eafs_enabled=false', () => {
      const fakeReferrer = 'android-app://com.google.android.apps.magazines';
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
    // eafs_enabled=true alone must not grant access for other referrers.
    it('dont allow for non-Google referer with eafs_enabled=true', () => {
      const fakeReferrer = 'https://www.example.com/';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?foo=bar&eafs_enabled=true');
      const freeAccess = new FreeAccess(mockLocation);
      expect(freeAccess.shouldAllowFreeAccess()).to.be.false;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
    it('dont allow for empty referer with eafs_enabled=true', () => {
      const fakeReferrer = '';
      // Redefine the property
      Object.defineProperty(self.document, 'referrer', {
        value: fakeReferrer,
        writable: false,
        configurable: true,
      });
      const mockLocation = sandbox.createStubInstance(LocationProvider);
      mockLocation.getSearch.returns('?eafs_enabled=true');
      const freeAccess = new FreeAccess(mockLocation);
      expect(freeAccess.shouldAllowFreeAccess()).to.be.false;
      expect(self.document.referrer).to.be.equal(fakeReferrer);
    });
  });
});
