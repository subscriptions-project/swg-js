/**
 * User object that Publisher JS receives after users sign in.
 * @typedef {{
 *   idToken: string,
 *   name: string,
 *   givenName: string,
 *   familyName: string,
 *   imageUrl: string,
 *   email: string,
 *   authorizationData: {
 *     access_token: string,
 *     id_token: string,
 *     scope: string,
 *     expires_in: number,
 *     first_issued_at: number,
 *     expires_at: number,
 *   },
 * }} GaaUserDef
 */
export let GaaUserDef;

/**
 * Google Identity (V1) that Google Identity Services returns after someone signs in.
 * https://developers.google.com/identity/gsi/web/reference/js-reference#CredentialResponse
 * @typedef {{
 *   iss: string,
 *   nbf: number,
 *   aud: string,
 *   sub: string,
 *   hd: string,
 *   email: string,
 *   email_verified: boolean,
 *   azp: string,
 *   name: string,
 *   picture: string,
 *   given_name: string,
 *   family_name: string,
 *   iat: number,
 *   exp: number,
 *   jti: string,
 * }} GoogleIdentityV1Def
 */
export let GoogleIdentityV1Def;

/**
 * GoogleUser object that Google Sign-In returns after users sign in.
 * https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile
 * @typedef {{
 *  getAuthResponse: function(boolean): {
 *     access_token: string,
 *     id_token: string,
 *     scope: string,
 *     expires_in: number,
 *     first_issued_at: number,
 *     expires_at: number,
 *   },
 *   getBasicProfile: function(): {
 *     getName: function(): string,
 *     getGivenName: function(): string,
 *     getFamilyName: function(): string,
 *     getImageUrl: function(): string,
 *     getEmail: function(): string,
 *   },
 * }} GoogleUserDef
 */
export let GoogleUserDef;

/**
 * InitParams object that GaaMetering.init accepts
 * https://developers.google.com/news/subscribe/extended-access/overview
 * @typedef {{
 * allowedReferrers: (Array<string>|null),
 * googleApiClientId: string,
 * authorizationUrl: string,
 * handleLoginPromise: (Promise|null),
 * caslUrl: string,
 * handleSwGEntitlement: function(): ?,
 * publisherEntitlementPromise: (Promise|null),
 * registerUserPromise: (Promise|null),
 * showPaywall: function(): ?,
 * showcaseEntitlement: string,
 * unlockArticle: function(): ?,
 * rawJwt: (boolean|null),
 * userState: {
 *   paywallReason: string,
 *   grantReason: string,
 *   granted: boolean,
 *   id: string,
 *   registrationTimestamp: number,
 *   subscriptionTimestamp: number
 * }
 * }} InitParamsDef
 */
export let InitParamsDef;
