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

# SwG Entitlements Flow

This flow would notify the publication site when SwG believes that the reader is entitled to read the content, e.g. due to previously pruchased subscription. See [Subscriptions APIs](./core-apis.md).

It's recommended that the site install entitlements listener as early as practical using `setOnEntitlementsResponse` method.

For instance:
```
subscriptions.setOnEntitlementsResponse(function(entitlementsPromise) {
  entitlementsPromise.then(function(entitlements) {
    // Handle the entitlements.
  });
})
```

This callback will be called whenever the new entitlements have been updated.

In the [auto mode](./embed-client.md#auto-initialization), the entitlements are fetched automatically. In the [manual mode](./embed-client.md#manual-initialization) the site can call `start` method:

```
subscriptions.start();
```

Likewise, at any point, the site can call `getEntitlements` method to access the entitlements, whether they were previously fetched or not:

```
subscriptions.getEntitlements().then(function(entitlements) {
  // Handle the entitlements.
});
```

## Entitlement acknowledgement

The successful entitlements object should be acknowledge by the publication site to stop it from showing the notification. This is done by calling the `entitlements.ack()` method.

For instance:

```
subscriptions.setOnEntitlementsResponse(function(entitlementsPromise) {
  entitlementsPromise.then(function(entitlements) {
    // Handle the entitlements.
    entitlements.ack();
  });
})
```
