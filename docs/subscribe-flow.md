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

# SwG Subscribe Flow

This flow shows the payment form, accepts payment, records subscription and updates the reader's entitlements. See [Subscriptions APIs](./core-apis.md).

*Important!* Please ensure you set up the `setOnSubscribeResponse` on any page where you accept purchases, not just before you call `subscribe` or `showOffers`. SwG client ensures it can recover subscriptions even when browsers unload pages.

First, please setup the subscription response callback via `setOnSubscribeResponse`:

```
subscriptions.setOnSubscribeResponse(function(subscriptionPromise) {
  subscriptionPromise.then(function(response) {
    // 1. Handle subscription response.
    // 2. Once subscription is processed (account created):
    response.complete().then(function() {
      // 3. The subscription is fully processed.
    });
  });
});
```

Once you receive subscription response:
 1. You can process the subscription. For instance you can create a new account based on the `userData` info and save subscrpition for this account.
 2. Once subscription is processed, call `response.complete()`. This method will signal to SwG that your site has accepted the subscription. It will return a promise that will be resolved once the user has acknowledged subscription.
 3. Once the `response.complete()` promise is resolved, you can unblock content, show additional UI to the user or perform any actions you see fit.


To activate subscription flow itself, call the `subscribe` method with the desired SKU:

```
subscriptions.subscribe(sku);
```

Another way to trigger the subscribe flow is by starting [Offers flow](./offers-flow.md).

The `setOnSubscribeResponse` callback will be called once the subscription is complete, or when the previously executed subscription is recovered.

The response returned by the `setOnSubscribeResponse` callback is the [`SubscribeResponse`](./core-apis.md) object. It includes purchase details, as well as user data.
