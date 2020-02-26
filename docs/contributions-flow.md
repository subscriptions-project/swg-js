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

# SwG Contributions Flow (Experiments ONLY)

This flow allows the publication site to display a flow where users can contribute money to the publisher. See [Contributions APIs](./core-apis.md).

First, please setup the contribution response callback via `setOnPaymentResponse`:

```js
subscriptions.setOnPaymentResponse(function(paymentResponse) {
  paymentResponse.then(function(response) {
    // Handle the payment response.
    // Some websites would create or update a user
    // at this point.
    response.complete().then(function() {
      // The payment is fully processed.
      // Some websites would update their UI
      // if content had been unlocked at this point.
    });
  });
});
```

Once you receive the contribution response:
 1. You can process the contribution. For instance you can create a new account based on the `userData` info and save contribution for this account.
 2. Once contribution is processed, call `response.complete()`. This method will signal to SwG that your site has accepted the contribution. It will return a promise that will be resolved once the user has acknowledged contribution.
 3. Once the `response.complete()` promise is resolved, you can unblock your content, show additional UI to the user or perform any actions you see fit.

To activate contribution flow itself, call the `contribute` method with the desired SKU:

```js
subscriptions.contribute(sku);
```

The `setOnPaymentResponse` callback will be called once the contribution is complete, or when the previously executed contribution is recovered.

Another way to trigger the contributions flow is by first presenting a dialog with a set of amounts user can contribute to.
A user will get a choice to either select one of the amounts to contribute to, or try request login to claim an existing contribution. This feature may not be available initially.

To handle the login request:

```js
subscriptions.setOnLoginRequest(function() {
  // Handle login request.
});
```

To display contributions:

```js
subscriptions.showContributionOptions();
```

The above mentioned API `showContributionsOptions` accepts a list of SKUs to be displayed. The list of SKUs should be of type type `UI_CONTRIBUTIONS` (publisher configuration).

```js
subscriptions.showContributions({skus: ['sku1', 'sku2']});
```

The `setOnPaymentResponse` callback will be called once the contribution is complete, or when the previously executed contribution is recovered.

## Contribution response
The response returned by the `setOnPaymentResponse` callback is the [`SubscribeResponse`](../src/api/subscribe-response.js) object. It includes purchase details, as well as user data.

### Structure
The SubscriptionResponse object has the following structure:
```json
{
  "raw": "",
  "purchaseData" : {
    "raw": "",
    "signature": "",
  },
  "productType": "UI_CONTRIBUTION",
  "userData": {
    "idToken" : "...",
    "data": { ... },
    "id": "",
    "email": "",
    "emailVerified": true,
    "name": "",
    "givenName": "",
    "familyName": "",
    "pictureUrl": ""
}
```
For details, please refer to [Subscription flow](./subscribe-flow.md)


*Important!* Please ensure you set up the `setOnPaymentResponse` on any page where you accept purchases, not just before you call `contribute` or `showContributions`. The SwG client ensures it can recover contributions even when browsers unload pages.
