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

This flow is normally originated from another surface and allows the reader to link this publication's subscription to that surface. See [Subscriptions APIs](./core-apis.md).

The link flow would normally be executed by a 3p surface to let a user to claim an existing subscription. However, SwG client provides `linkAccount` and `setOnLinkComplete` APIs for testing purposes.

SwG supports two flavors of OAuth account linking:
 - [OAuth implicit flow](https://developers.google.com/actions/identity/oauth2-implicit-flow)
 - [OAuth authorization code flow](https://developers.google.com/actions/identity/oauth2-code-flow)

# SwG Link Save flow (Not launched)

This flow is normally originated from the publisher and allows the reader to link publication's subscription to the reader's account.

To start saving subscription link, provide a callback synchronously returning a token or authCode corresponding to the reader's
subscription, or a Promise to return it asynchronously Eg:

```
subscriptions.saveSubscription(() => {token: 'THE TOKEN'});
```
OR

```
const requestPromise = new Promise(resolve => {
    // whenever available
    resolve({authCode: 'THE CODE'});
});
subscriptions.saveSubscription(() => requestPromise));
```

A list of user's accounts will be surfaced in an iframe and the user can select the account to be linked and saved. At this point, the publisher will receive a message to retrieve the token or authCode using the callback. Once its available,  the iframe recieves it and saves it. Upon saving this link, a non-blocking confirmation will be shown to the user.


