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

import {callSwg, queryStringHasFreshGaaParams} from './utils';

describes.realWin('queryStringHasFreshGaaParams', () => {
  let clock;

  beforeEach(() => {
    clock = sandbox.useFakeTimers();
  });

  it('succeeeds for valid params', () => {
    const queryString = '?gaa_at=at&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.true;
  });

  it('fails without gaa_at', () => {
    const queryString = '?gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails without gaa_n', () => {
    const queryString = '?gaa_at=gaa&gaa_sig=s1gn4tur3&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails without gaa_sig', () => {
    const queryString = '?gaa_at=gaa&gaa_n=n0nc3&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails without gaa_ts', () => {
    const queryString = '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails if GAA URL params are expired', () => {
    // Add GAA URL params with expiration of 7 seconds.
    const queryString = '?gaa_at=gaa&gaa_n=n0nc3&gaa_sig=s1gn4tur3&gaa_ts=7';
    clock.tick(7001);
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('fails if gaa_at param specifies "no access"', () => {
    const queryString = '?gaa_at=na&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString)).to.be.false;
  });

  it('succeeds if gaa_at param specifies "no access" but allowAllAccessTypes is true', () => {
    const queryString = '?gaa_at=na&gaa_n=n&gaa_sig=sig&gaa_ts=99999';
    expect(queryStringHasFreshGaaParams(queryString, true)).to.be.true;
  });
});

describes.realWin('callSwg', () => {
  beforeEach(() => {
    delete self.SWG;
  });

  it('creates SWG array if necessary', () => {
    expect(self.SWG).to.be.undefined;
    callSwg(() => {});
    expect(self.SWG.length).to.equal(1);
  });

  it('pushes to existing SWG array if available', () => {
    self.SWG = [() => {}];
    callSwg(() => {});
    expect(self.SWG.length).to.equal(2);
  });
});
