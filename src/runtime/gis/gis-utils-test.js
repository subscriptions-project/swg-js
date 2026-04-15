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
import {GisInteropManagerStates} from './gis-interop-manager';
import {GisMode, getGisMode} from './gis-utils';
import {InterventionType} from '../../api/intervention-type';

describes.realWin('gis-utils', (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  describe('getGisMode', () => {
    let gisInteropManagerReady;
    let gisInteropManagerNotReady;

    beforeEach(() => {
      gisInteropManagerReady = {
        getState: () =>
          GisInteropManagerStates.COMMUNICATION_IFRAME_ESTABLISHED,
        isConnectionExpected: () => true,
      };
      gisInteropManagerNotReady = {
        getState: () => GisInteropManagerStates.WAITING_FOR_PING,
        isConnectionExpected: () => false,
      };
    });

    it('returns GisModeDisabled when gisInteropManager is not ready', () => {
      expect(
        getGisMode(
          win,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerNotReady
        )
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeDisabled when action is not TYPE_REGISTRATION_WALL', () => {
      expect(
        getGisMode(
          win,
          InterventionType.TYPE_NEWSLETTER_SIGNUP,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeOverlay for Safari browser', () => {
      const fakeWin = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        },
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeOverlay);
    });

    it('returns GisModeNormal for non-Safari browser (Chrome)', () => {
      const fakeWin = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        },
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerReady
        )
      ).to.equal(GisMode.GisModeNormal);
    });

    it('returns GisModeNormal when gisInterop parameter is true, even if gisInteropManager is not ready', () => {
      const fakeWin = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        },
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          gisInteropManagerNotReady,
          true
        )
      ).to.equal(GisMode.GisModeNormal);
    });

    it('returns GisModeNormal when gisInteropManager.isConnectionExpected() is true', () => {
      const fakeWin = {
        navigator: {
          userAgent: 'Chrome',
        },
      };
      const managerWithExpectedConnection = {
        getState: () => GisInteropManagerStates.WAITING_FOR_PING,
        isConnectionExpected: () => true,
      };
      expect(
        getGisMode(
          fakeWin,
          InterventionType.TYPE_REGISTRATION_WALL,
          managerWithExpectedConnection
        )
      ).to.equal(GisMode.GisModeNormal);
    });
  });
});
