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
import {GisMode, getGisMode} from './gis-utils';
import {InterventionType} from '../../api/intervention-type';

describes.realWin('gis-utils', (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  describe('getGisMode', () => {
    it('returns GisModeDisabled whenclientId is not provided', () => {
      expect(
        getGisMode(
          win,
          undefined,
          InterventionType.TYPE_REGISTRATION_WALL,
          () => true
        )
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeDisabled when onResult is not provided', () => {
      expect(
        getGisMode(win, 'client-id', InterventionType.TYPE_REGISTRATION_WALL)
      ).to.equal(GisMode.GisModeDisabled);
    });

    it('returns GisModeDisabled when action is not TYPE_REGISTRATION_WALL', () => {
      expect(
        getGisMode(
          win,
          'client-id',
          InterventionType.TYPE_NEWSLETTER_SIGNUP,
          () => true
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
          'client-id',
          InterventionType.TYPE_REGISTRATION_WALL,
          () => true
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
          'client-id',
          InterventionType.TYPE_REGISTRATION_WALL,
          () => true
        )
      ).to.equal(GisMode.GisModeNormal);
    });
  });
});
