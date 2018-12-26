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

# SwG Contributions Flow

This flow allows the publication site to display a flow where users can contribute money to
the publisher. See [Subscriptions APIs](./core-apis.md).


The contribution flow will first present a set of amounts user can contribute to.
A user will get a choice to either select one of the offers, or try request login to claim an existing contribution.

To display contributions:

```
subscriptions.showContributions();
```

To handle the login request:

```
subscriptions.setOnLoginRequest(function() {
  // Handle login request.
});
```

If a user elects for a presented offer, SwG will run the [Subscribe flow](./subscribe-flow.md).


## Contribution options

The contributions API (`showContributions`) accepts a list of SKUs to be displayed.

For instance:

```
subscriptions.showContributions({skus: ['sku1', 'sku2']});
```

*Important!* Please ensure you set up the `setOnSubscribeResponse` on any page where you accept purchases, not just before you call `subscribe` or `showContributions`. SwG client ensures it can recover contributions even when browsers unload pages. See [Subscribe flow](./subscribe-flow.md) for more details.
