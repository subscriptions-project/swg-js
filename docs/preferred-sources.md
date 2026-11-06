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

# Preferred Sources (`publisher.js`)

The Preferred Sources runtime (`publisher.js` / `publisher.mjs`) lets readers add your publication as a preferred source in Google Search using either an official Google-rendered button or your own custom call-to-action (CTA) backed by the `PreferredSourceApi`.

## Including the script

### Classic `<script>` tag (recommended)

Include `publisher.js` with `async` and `crossorigin="anonymous"`:

```html
<script
  async
  crossorigin="anonymous"
  src="https://news.google.com/swg/js/v1/publisher.js"
></script>
```

#### Why `crossorigin="anonymous"`?

`https://news.google.com/swg/js/*` is served with `Access-Control-Allow-Origin: *`. Adding `crossorigin="anonymous"` switches the browser from `no-cors` mode (`credentials: 'include'`) to CORS `'same-origin'` credentials mode:

- Cross-site `.google.com` cookies are **never** sent on the script download.
- Any `Set-Cookie` response headers are ignored by the browser.
- Uncaught runtime errors report full stack traces instead of generic `"Script error."` messages.

### ES module (`publisher.mjs`)

You can also import the ES module build directly:

```html
<script type="module">
  import {preferredSource} from 'https://news.google.com/swg/js/v1/publisher.mjs';

  // ES modules use CORS credentials mode automatically and do not auto-start:
  preferredSource.init();
</script>
```

Unlike the classic `publisher.js` bundle, `publisher.mjs` sets `autoStart: false` by default, so no DOM buttons inflate and no iframes or analytics requests are created until you call `preferredSource.init()` or `preferredSource.addPreferredSource()`.

---

## Declarative Google button

Place one or more `[google-add-preferred-source-btn]` containers where you want the button to appear:

```html
<div
  google-add-preferred-source-btn
  data-lang="en"
  data-theme="light"
></div>
```

### Supported attributes

| Attribute | Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `google-add-preferred-source-btn` | *(boolean presence)* | — | Marks the element for button rendering. |
| `data-lang` | BCP-47 language tag (e.g. `en`, `de`, `es`, `fr`, `ja`, `zh-cn`) | `init({lang})` → `navigator.language` → `<html lang>` → `'en'` | Localizes the button label, consent dialog, and confirmation toast. |
| `data-theme` | `'light'` \| `'dark'` \| `'auto'` | `init({theme})` → `'light'` | Selects light, dark, or `prefers-color-scheme` OS-adaptive styling. |

### Rendering and zero-button page behavior

- **Self-contained Shadow DOM & inline SVG:** Each button renders inside an open Shadow root with an inlined `data:image/svg+xml` Google logo, making **zero** external image or font requests.
- **Intrinsic sizing:** Buttons size intrinsically to their localized label and support explicit CSS widths down to a `140px` minimum floor.
- **Silent on zero-button pages:** If `publisher.js` is included in a shared site header and the current page contains **zero** `[google-add-preferred-source-btn]` elements, initialization returns immediately without injecting any `<iframe>` or sending any analytics requests.

---

## Programmatic `PreferredSourceApi`

Queue callbacks on `self.PREFERRED_SOURCE` before or after `publisher.js` loads:

```js
(self.PREFERRED_SOURCE = self.PREFERRED_SOURCE || []).push(
  function (preferredSource) {
    // preferredSource implements PreferredSourceApi
  }
);
```

### Methods (`src/api/preferred-source.ts`)

- **`preferredSource.init(options?: {lang?: string; theme?: 'light' | 'dark' | 'auto'}): void`**
  Merges default `{lang, theme}` options and initializes any uninitialized `[google-add-preferred-source-btn]` elements currently in the DOM. Safe to call multiple times (for example, after client-side SPA navigation renders new buttons); elements already marked `data-initialized="true"` are skipped, and calls when zero uninitialized buttons exist emit zero network requests.
- **`preferredSource.addPreferredSource(): void`**
  Launches the Google Preferred Sources consent flow directly. Call this synchronously inside a trusted user `click` handler so browsers permit opening the consent popup window. By design, `addPreferredSource()` returns `void` and exposes no status or completion callback so websites cannot infer a reader's Google Search preferences.

---

## Manual & consent-managed integrations (`preferred-sources-control="manual"`)

Adding `preferred-sources-control="manual"` to the `<script>` tag disables automatic initialization on page load. The script creates no `<iframe>` elements and sends zero analytics requests until your code calls `init()` (with at least one button in the DOM) or `addPreferredSource()`:

```html
<script
  async
  crossorigin="anonymous"
  preferred-sources-control="manual"
  src="https://news.google.com/swg/js/v1/publisher.js"
></script>
```

### Pattern 1: Custom publisher CTA (zero pre-click telemetry)

Render your own first-party HTML button and invoke `preferredSource.addPreferredSource()` when the reader clicks:

```html
<button id="custom-ps-btn" type="button">
  Follow Example News on Google
</button>

<script>
  let psApi = null;
  (self.PREFERRED_SOURCE = self.PREFERRED_SOURCE || []).push(function (api) {
    psApi = api;
    // Optional: configure default popup/toast locale & theme.
    // On a page with 0 [google-add-preferred-source-btn] elements,
    // init() creates 0 iframes and sends 0 network requests.
    api.init({lang: 'de', theme: 'auto'});
  });

  document
    .getElementById('custom-ps-btn')
    .addEventListener('click', function () {
      if (psApi) {
        psApi.addPreferredSource();
      }
    });
</script>
```

> **Note on deferred script injection:** Including `<script async crossorigin="anonymous" ...>` downloads the static `publisher.js` bundle from `news.google.com` so `psApi.addPreferredSource()` is ready synchronously on user click (preserving popup user activation). If you want to avoid network requests entirely prior to a user gesture or publisher-managed initialization, dynamically insert the `<script>` tag inside your initialization callback, or link directly to `https://www.google.com/preferences/source?q=example.com`.

### Pattern 2: CMP / consent-gated Google button

Keep `[google-add-preferred-source-btn]` in your article template with `preferred-sources-control="manual"`, and call `preferredSource.init()` once your CMP grants consent:

```html
<div google-add-preferred-source-btn data-lang="de" data-theme="auto"></div>

<script>
  function onCmpConsentGranted() {
    (self.PREFERRED_SOURCE = self.PREFERRED_SOURCE || []).push(function (api) {
      api.init();
    });
  }
</script>
```

If you also want to defer fetching `publisher.js` itself until consent is granted, inject the `<script async crossorigin="anonymous" src="https://news.google.com/swg/js/v1/publisher.js">` element inside `onCmpConsentGranted()`.

---

## Popup vs. redirect fallback & `Cross-Origin-Opener-Policy`

1. **Popup mode (default):** Clicking opens `https://news.google.com/swg/ui/v1/addpreferredsource` in a popup window and displays an on-page confirmation toast if the reader completes the flow.
2. **Redirect fallback (`#__WA_RES__`):** When popups are blocked (such as in mobile WebViews) or `window.opener` is cleared by `Cross-Origin-Opener-Policy: same-origin`, the consent flow automatically completes via top-level navigation and processes the `#__WA_RES__` result hash upon returning to your page.
   - To preserve popup mode on sites serving COOP headers, prefer `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
   - On redirect returns, confirmation toast localization reads `data-lang` and `data-theme` from `[google-add-preferred-source-btn]` (falling back to `navigator.language` / `<html lang>`).

---

## Network & lifecycle behavior summary

| Scenario | Injected `<iframe>` | Initial Analytics Requests | External Image Requests |
| :--- | :---: | :---: | :---: |
| **Page with 0 `[google-add-preferred-source-btn]` elements** | `0` | `0` | `0` |
| **`preferred-sources-control="manual"` before `init()` or click** | `0` | `0` | `0` |
| **Page after `init()` with ≥ 1 `[google-add-preferred-source-btn]`** | `1` (`serviceiframe`) | `1` per attached button | `0` (inlined SVG) |
| **Reader clicks Google button or calls `addPreferredSource()`** | `1` (`serviceiframe`, plus confirmation `/toastiframe` after consent) | Click & dialog events | `0` |

- **Origin-only analytics URLs:** Analytics events sent by `publisher.js` include only the normalized HTTP(S) origin (for example, `https://example.com`)—never article paths, query parameters, `<link rel="canonical">` paths, or campaign tags. (When a reader actively clicks to open the dialog, the page URL is passed to the dialog flow solely to resolve the publication in Google Search.)

## Interactive examples

- [Declarative Preferred Sources button gallery (`examples/publisher-button.html`)](../examples/publisher-button.html)
- [Manual mode, custom CTA & CMP consent gate (`examples/publisher-manual-consent.html`)](../examples/publisher-manual-consent.html)
