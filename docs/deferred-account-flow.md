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

# Deferred account creation flow

This flow allows the publisher site to continue account creation process for deferred subscriptions - subscriptions that the publisher doesn't have related account information/consent on their side. These kind of subscriptions could be created on other partner platforms.

This flow shows the user their existing subscription information, prompts for the user's consent, and returns user/subscription information back to the publisher's site. See [Subscriptions APIs](./core-apis.md).

Typically, the publisher's site can initiate deferred account creation when it receives the entitlements data, e.g. via `setOnEntitlementsResponse` callback. Thus the possible code could look like this:

```
function onEntitlement(entitlements) {
  if (!entitlements.enablesThis()) {
    return;
  }
  // The entitlement enables this product.
  // 1. Check if the publisher site has account/user info for this subscription.
  if (!hasAssociatedUserAccount(entitlements)) {
    // 2. Start deferred account creation.
    subscriptions.completeDeferredAccountCreation(
        {entitlements: entitlements, consent: true})
        .then(function(response) {
          // 3. The user has consented to account creation. Create account based
          //    on the response.
          // 4. Signal that the account creation is complete.
          response.complete().then(function() {
            // 5. The flow is complete.
          });
        });
  }
}
```

Once you receive deferred account response:
 1. You can process the subscription. For instance you can create a new account based on the `userData` and `purchaseDataList` in the response.
 2. Once subscription is processed, call `response.complete()`. This method will signal to SwG that your site has accepted the subscription. It will return a promise that will be resolved once the user has acknowledged subscription.
 3. Once the `response.complete()` promise is resolved, you can unblock content, show additional UI to the user or perform any actions you see fit.


To activate subscription flow itself, call the `completeDeferredAccountCreation` method with the known entitlements and consent request:

```
subscriptions.completeDeferredAccountCreation({
  entitlements: receivedEntitlements,
  consent: true,
});
```

Arguments:
 - `entitlements` - the entitlements received via `setOnEntitlementsResponse` or `getEntitlements` APIs. It's an optional argument, but recommended. If it's not provided, SwG will lookup existing known subscription.
 - `consent` - a boolean property. Whether or not show the user the publisher's "account creation" consent. The default value is `true`. The publisher should only set this argument to `false` if they have their own confirmation that the user has already consented to account creation.
