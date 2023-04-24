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

import {GrantReasonType, PaywallType} from './constants';

/**
 * User object that Publisher JS receives after users sign in.
 */
export interface GaaUserDef {
  idToken: string;
  name: string;
  givenName: string;
  familyName: string;
  imageUrl: string;
  email: string;
  authorizationData: {
    /* eslint-disable google-camelcase/google-camelcase */
    access_token: string;
    id_token: string;
    scope: string;
    expires_in: number;
    first_issued_at: number;
    expires_at: number;
    /* eslint-enable google-camelcase/google-camelcase */
  };
}

/**
 * Google Identity (V1) that Google Identity Services returns after someone signs in.
 * https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse
 */
export interface GoogleIdentityV1Def {
  /* eslint-disable google-camelcase/google-camelcase */
  iss: string;
  nbf: number;
  aud: string;
  sub: string;
  hd: string;
  email: string;
  email_verified: boolean;
  azp: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
  jti: string;
  /* eslint-enable google-camelcase/google-camelcase */
}

/**
 * GoogleUser object that Google Sign-In returns after users sign in.
 * https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile
 */
export interface GoogleUserDef {
  getAuthResponse: (something: boolean) => {
    /* eslint-disable google-camelcase/google-camelcase */
    access_token: string;
    id_token: string;
    scope: string;
    expires_in: number;
    first_issued_at: number;
    expires_at: number;
    /* eslint-enable google-camelcase/google-camelcase */
  };
  getBasicProfile: () => {
    getName: () => string;
    getGivenName: () => string;
    getFamilyName: () => string;
    getImageUrl: () => string;
    getEmail: () => string;
  };
}

/**
 * InitParams object that GaaMetering.init accepts
 * https://developers.google.com/news/subscribe/extended-access/overview
 */
export interface InitParamsDef {
  paywallType: PaywallType;
  allowedReferrers: string[] | null;
  googleApiClientId?: string;
  authorizationUrl?: string;
  handleLoginPromise: Promise<UserState> | null;
  caslUrl: string;
  handleSwGEntitlement: () => void;
  publisherEntitlementPromise: Promise<UserState> | null;
  registerUserPromise: Promise<UserState> | null;
  showPaywall: () => void;
  showcaseEntitlement: string;
  unlockArticle: () => void;
  rawJwt: boolean | null;
  userState: UserState;
  shouldInitializeSwG?: boolean;
}

/** User's current metering state. */
export interface UserState {
  paywallReason: string;
  grantReason: GrantReasonType;
  granted: boolean;
  id: string;
  registrationTimestamp: number;
  subscriptionTimestamp: number;
}
