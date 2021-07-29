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

# Include SwG client on a site

## Including SwG client script

The SwG client is available as a JavaScript library distributed at this URL:

```
https://news.google.com/swg/js/v1/swg.js
```

To include the SwG client on a page, include a `<script>` tag as
follows (notice the `async` attribute):

```html
<script async src="https://news.google.com/swg/js/v1/swg.js"></script>
```

## Client ready callback

To get a callback when SwG client is ready, use the following code:

```js
(self.SWG = self.SWG || []).push(function(subscriptions) {
  // SwG is ready to be called via subscriptions interface.
});
```

This callback provides a `subscriptions` object. See [Subscriptions API](./core-apis.md#subscriptions-api) for more details.

## Client initialization

Before SwG client can be used it must be initialized. There are two ways to
initialize the client: auto and manual.

### Auto-initialization

SwG client can initialize itself automatically when
[Subscriptions markup](./page-markup.md) is present on the page. By default
the SwG client will attempt to auto-initialize. This is the recommended method
for content pages (articles).

### Manual initialization

To initialize the client manually, first set the `subscriptions-control="manual"` flag on the script:

```html
<script async subscriptions-control="manual" src="https://news.google.com/swg/js/v1/swg.js"></script>
```

Then initialize using the API:

```js
(self.SWG = self.SWG || []).push(function(subscriptions) {
  // Either use a publication ID (example.com) or
  // a full product ID (example.com:premium).
  // Note: a wildcard product ID (example.com:*) will match any
  // entitlement for the publication
  subscriptions.init(publicationOrProductId);
});
```
