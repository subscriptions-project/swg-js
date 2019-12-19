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

# SwG Subscriptions Flows

The [Subscriptions APIs](./core-apis.md) use cases be summarized in a few flows:

1. [Entitlements flow](./entitlements-flow.md). This flow would notify the publication site when SwG believes that the reader is entitled to read the content, e.g. due to a previously purchased subscription.
2. [Subscribe flow](./subscribe-flow.md). This flow shows the payment form, accepts payment, records subscription and updates the reader's entitlements.
3. [Deferred account creation flow](./deferred-account-flow.md). This flow allows the publisher site to continue account creation process for deferred subscriptions - subscriptions that the publisher doesn't have related account information/consent on their side. These kind of subscriptions could be created on other partner platforms.
4. [Offers flow](./offers-flow.md). This flow allows the publication site to display numerous flow to purchase the subscription.
5. [Link flow](./link-flow.md). This flow is normally originated from another surface and allows the reader to link this publication's subscription to that surface.

Besides the actual flow APIs SwG also provides general flow callbacks, which could be used for analytics. These callbacks include `setOnFlowStarted` and `setOnFlowCanceled`.
