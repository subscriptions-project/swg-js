# Subscribe with Google Basic Client Library (swg-basic.js) Specification

Specifications for `Subscribe with Google` (Basic tier) client-side library.

## Overview

`swg-basic.js` is the client-side JavaScript runtime for the basic Subscriptions with Google experience. It provides high-level APIs for publishers to manage subscriptions and contributions with less deep integrations.

---

## Initialization

The runtime is initialized by loading the script and queuing callbacks. It binds to the global `SWG_BASIC` variable.

### Loading

```javascript
// Example usage:
(self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
  basicSubscriptions.init({
    type: 'Product',
    isAccessibleForFree: false,
    isPartOfType: 'Publication',
    isPartOfProductId: 'publication_id:product_id',
    clientOptions: { lang: 'en', theme: 'light' }
  });
});
```

---

## Public Interface (`BasicSubscriptions`)

The main service interface provided by `swg-basic.js`.

### Lifecycle and State

#### `init(params: { type: string | string[]; isAccessibleForFree: boolean; isPartOfType: string | string[]; isPartOfProductId: string; ... }): void`
Initializes the basic subscriptions runtime. It sets specified values in the page's JSON-LD markup and sets up buttons and prompts automatically.

#### `dismissSwgUI(): void`
Dismisses any SwG UI currently displayed.

#### `getDiagnostics(): {isGisReady: boolean}`
Returns diagnostic information about the setup (e.g. if GIS is ready).

### Entitlements

#### `setOnEntitlementsResponse(callback: (entitlementsPromise: Promise<Entitlements>) => void): void`
Sets the callback that receives entitlements responses. This is the primary way publishers receive entitlements data in basic mode.

### Offers and Purchases

#### `setOnPaymentResponse(callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void): void`
Sets the callback for payment completion.

#### `setupAndShowAutoPrompt(options: { autoPromptType?: AutoPromptType; alwaysShow?: boolean; isAccessibleForFree?: boolean; }): Promise<void>`
Creates and displays a SwG subscription or contribution prompt.

#### `setOnLoginRequest(callback: (loginRequest: LoginRequest) => void): void`
Sets the callback for the native login request (e.g. "Already a subscriber?").

---

## Configuration (`ClientOptions`)

Interface describing runtime configuration overrides.

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `disableButton` | `boolean` | `false` | Whether to disable buttons. |
| `lang` | `string` | `"en"` | Sets the button and prompt language. |
| `forceLangInIframes`| `boolean`| `false` | Whether to force the specified lang in iframes. |
| `theme` | `ClientTheme` | `"light"` | "Light" or "dark". |
| `allowScroll` | `boolean` | `false` | Whether to allow scrolling. |
| `skipAccountCreationScreen`| `boolean`| `false` | Skip account creation screen if requested. |

---

## State Transitions

- **Uninitialized** $\to$ **Configuring** (via `init()`).
- **Configuring** $\to$ **Page Config Resolved** (when page config is read).
- **Page Config Resolved** $\to$ **Ready** $\to$ **Prompting** (AutoPrompts).

---

## Input/Output Contracts

Most methods return generic `Promise<void>` or handle callbacks.

- **`getDiagnostics()`**: Returns `{ isGisReady: boolean }`.
- **`setupAndShowAutoPrompt()`**: Returns `Promise<void>`.

---

## Verification

Verified against `src/api/basic-subscriptions.ts` and `src/runtime/basic-runtime.ts`.
