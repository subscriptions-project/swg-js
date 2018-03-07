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

# SwG Offers Flow

This flow allows the publication site to display numerous flow to purchase the subscription. See [Subscriptions APIs](./core-apis.md).

*Important!* Please ensure you set up the `setOnSubscribeResponse` on any page where you accept purchases, not just before you call `subscribe` or `showOffers`. SwG client ensures it can recover subscriptions even when browsers unload pages. See [Subscribe flow](./subscribe-flow.md) for more details.

The offers flow will first present a set of offers know to SwG. A user will get a choice to either select one of the offers, or try request login to claim an existing subscription.

To display offers:

```
subscriptions.showOffers();
```

To handle the login request:

```
subscriptions.setOnLoginRequest(function() {
  // Handle login request.
});
```

If a user elects for a presented offer, SwG will run the [Subscribe flow](./subscribe-flow.md).


## SwG Subscribe Option

A small variation of `subscriptions.showOffers` is the `subscriptions.showSubscribeOption` API. This presents a non-blocking abbreviated option to user to use SwG.

To activate:

```
subscriptions.showSubscribeOption();
```
