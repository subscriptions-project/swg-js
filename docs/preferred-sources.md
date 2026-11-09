<!---
Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.

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

# Preferred Sources

The Preferred Sources client (`publisher.js`) provides a declarative button and programmatic [PreferredSourceApi](../src/api/preferred-source.ts) for adding a publication as a preferred source in Google Search.

## Including the script

The client is distributed at:

```text
https://news.google.com/swg/js/v1/publisher.js
```

Include it on a page using a `<script>` tag:

```html
<script async src="https://news.google.com/swg/js/v1/publisher.js"></script>
```

An ES module build is also available at `https://news.google.com/swg/js/v1/publisher.mjs`:

```html
<script type="module">
  import {preferredSource} from 'https://news.google.com/swg/js/v1/publisher.mjs';
</script>
```

## Client ready callback

To get a callback when the client is ready, use `self.PREFERRED_SOURCE`:

```js
(self.PREFERRED_SOURCE = self.PREFERRED_SOURCE || []).push(function(preferredSource) {
  // preferredSource implements PreferredSourceApi.
});
```

## Initialization

### Auto-initialization

By default, `publisher.js` initializes any `[google-add-preferred-source-btn]` elements present on the page once the document is ready. If no matching elements exist on the page, initialization returns without rendering buttons or initiating network requests.

### Manual initialization

To disable automatic initialization, add the `preferred-sources-control="manual"` attribute to the `<script>` tag:

```html
<script async preferred-sources-control="manual" src="https://news.google.com/swg/js/v1/publisher.js"></script>
```

The ES module build (`publisher.mjs`) does not auto-initialize. In manual mode, button rendering and network requests are deferred until `init()` or `addPreferredSource()` is called.

## Declarative button

Place a `[google-add-preferred-source-btn]` element where the button renders:

```html
<div google-add-preferred-source-btn data-lang="en" data-theme="light"></div>
```

Configurable attributes:

- `google-add-preferred-source-btn`: Marks the element for button rendering.
- `data-lang`: Sets the button and dialog language using a BCP-47 language tag (defaults to `init({lang})`, `navigator.language`, `<html lang>`, or `'en'`).
- `data-theme`: Sets the theme to `'light'` (default), `'dark'`, or `'auto'`.

## APIs

The [PreferredSourceApi](../src/api/preferred-source.ts) provides two methods:

- `init(options?)`: Merges default `lang` and `theme` options and initializes any uninitialized `[google-add-preferred-source-btn]` elements currently in the DOM.
  ```js
  preferredSource.init({lang: 'en', theme: 'light'});
  ```
- `addPreferredSource()`: Starts the Preferred Sources flow directly.
  ```js
  preferredSource.addPreferredSource();
  ```

## Examples

- [Declarative button gallery](../examples/publisher-button.html)
- [Manual initialization example](../examples/publisher-manual-consent.html)
