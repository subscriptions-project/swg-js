<!---
Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS-IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# SwG Link Flow

This flow is normally originated from another surface and allows the user to link the publication's subscription to the surface. See [Subscriptions APIs](./core-apis.md).

The link flow would normally be executed by a 3p surface to let a user to claim an existing subscription. However, SwG client provides `linkAccount` and `setOnLinkComplete` APIs for testing purposes.

SwG supports two flavors of OAuth account linking:
 - [OAuth implicit flow](https://developers.google.com/actions/identity/oauth2)
 - [OAuth authorization code flow](https://developers.google.com/actions/identity/oauth2?oauth=code)

# SwG Link Save flow

This flow is normally originated from the publisher and allows the user to link the publication's subscription to the user's account.

As a part of the flow, a dialog will prompt the user to opt-in to saving the subscription link.  If the user agrees, the publisher generates a corresponding access token.  Once the subscription link is saved, the user will see a progress indicator, then a confirmation dialog.  Completion of the link save flow or the user declining to opt-in can be detected as shown in the examples below.

To start the link save flow, provide an access token.  For OAuth implicit flow, generate a `token` value.  For OAuth authorization code flow, generate an `authCode` value.  The `token` or `authCode` may be generated after user confirmation, or in advance.


## Generating the token after user confirmation

```
const requestPromise = new Promise(resolve => {
    // when using the implicit flow, generate a token
    resolve({token: 'entitlements_access_token'});

    // or when using the auth code flow, generate an auth code
    resolve({authCode: 'auth_code'});
});

subscriptions.saveSubscription(() => requestPromise)).then(
    result => {
        if (result) {
            // link save flow completed successfully
        } else {
            // user declined or link save flow failed
        }
    }
);
```

## Generating the token in advance


```
// when using the implicit flow, generate a token
subscriptions.saveSubscription(() => {return {token: 'access_token'}}).then(
  // handle flow completion or user declining as shown in above example
);

// or when using the auth code flow, generate an auth code
subscriptions.saveSubscription(() => {return {authCode: 'auth_code'}}).then(
  // handle flow completion or user declining
);
```
