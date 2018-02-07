/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {UserData} from '../api/user-data';


describe('PurchaseData', () => {
  let pd;

  beforeEach(() => {
    pd = new PurchaseData(
        'RAW',
        'SIG');
  });

  it('should correctly initialize', () => {
    expect(pd.raw).to.equal('RAW');
    expect(pd.signature).to.equal('SIG');
  });

  it('should clone correctly', () => {
    const clone = pd.clone();
    expect(clone).to.not.equal(pd);
    expect(clone).to.deep.equal(pd);
    expect(clone.raw).to.equal('RAW');
    expect(clone.signature).to.equal('SIG');
  });

  it('should export json', () => {
    expect(pd.json()).to.deep.equal({});
  });
});


describe('SubscribeResponse', () => {
  let sr, pd, ud;

  beforeEach(() => {
    pd = new PurchaseData('PD_RAW', 'PD_SIG');
    ud = new UserData('ID_TOKEN', {sub: '1234'});
    sr = new SubscribeResponse('SR_RAW', pd, ud);
  });

  it('should initialize correctly', () => {
    expect(sr.raw).to.equal('SR_RAW');
    expect(sr.purchaseData).to.equal(pd);
    expect(sr.userData).to.equal(ud);
  });

  it('should clone', () => {
    const clone = sr.clone();
    expect(clone).to.not.equal(sr);
    expect(clone).to.deep.equal(sr);
    expect(clone.raw).to.equal('SR_RAW');
    expect(clone.purchaseData).to.equal(pd);
    expect(clone.userData).to.equal(ud);
  });

  it('should export json', () => {
    expect(sr.json()).to.deep.equal({
      'purchaseData': pd.json(),
      'userData': ud.json(),
    });
  });
});


describe('UserData', () => {
  let userData;

  beforeEach(() => {
    userData = new UserData(
        'ID_TOKEN',
        {
          'sub': 'id1',
          'email': 'id1@email.org',
          'email_verified': true,
          'name': 'Id One',
          'picture': 'https://example.org/avatar/test',
          'given_name': 'Id',
          'family_name': 'One',
        });
  });

  it('should correctly initialize', () => {
    expect(userData.idToken).to.equal('ID_TOKEN');
    expect(userData.id).to.equal('id1');
    expect(userData.email).to.equal('id1@email.org');
    expect(userData.emailVerified).to.equal(true);
    expect(userData.name).to.equal('Id One');
    expect(userData.givenName).to.equal('Id');
    expect(userData.familyName).to.equal('One');
    expect(userData.pictureUrl).to.equal('https://example.org/avatar/test');
  });

  it('should clone correctly', () => {
    const clone = userData.clone();
    expect(clone).to.not.equal(userData);
    expect(clone).to.deep.equal(userData);
    expect(clone.idToken).to.equal('ID_TOKEN');
    expect(clone.id).to.equal('id1');
    expect(clone.email).to.equal('id1@email.org');
    expect(userData.emailVerified).to.equal(true);
    expect(clone.name).to.equal('Id One');
    expect(clone.givenName).to.equal('Id');
    expect(clone.familyName).to.equal('One');
    expect(clone.pictureUrl).to.equal('https://example.org/avatar/test');
  });

  it('should export json', () => {
    expect(userData.json()).to.deep.equal({
      'id': 'id1',
      'email': 'id1@email.org',
      'emailVerified': true,
      'name': 'Id One',
      'givenName': 'Id',
      'familyName': 'One',
      'pictureUrl': 'https://example.org/avatar/test',
    });
  });
});
