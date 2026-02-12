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

# SwG Core APIs

## Subscriptions API

[Subscriptions service](../src/api/subscriptions.ts) is the main service that provides
access to all SwG APIs.

See [Include SwG client on a site](./embed-client.md) on how to load and get access
to this service.

For key uses of these APIs see [Subscriptions flows](./flows.md).

For SwG buttons see [SwG buttons](./buttons.md).


## Contributions API
For Contribution APIs see [Contributions flow](./contributions-flow.md)


## Types used within the Subscriptions API

Some of the main types are:
- [Entitlements](../src/api/entitlements.ts) 
- [SubscribeResponse](../src/api/subscribe-response.ts)
- [UserData](../src/api/user-data.ts)

For details on how these types and related APIs are used, see see [Subscriptions flows](./flows.md).


## Clear and reset

If the parent application believes that entitlements have changed `subscriptions.reset()` can be called to refetch entitlements.

Calling `subscriptions.clear()` will clear the SwG state, including caches.
