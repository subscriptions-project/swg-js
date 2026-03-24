# Subscribe with Google Client Library (swg.js) Specification

Specifications for `Subscribe with Google` (SwG) client-side library.

## Overview

`swg.js` is the client-side JavaScript runtime for Subscriptions with Google. It provides APIs for publishers to manage subscriptions, offers, contributions, and entitlements on their sites.

## Initialization

The runtime is initialized by loading the script and queuing callbacks. By default, the runtime binds to the global `SWG` (and legacy `SUBSCRIPTIONS`) array/variable.

### Loading

Publishers include the script in their HTML. The runtime initializes as follows:

```javascript
// Example usage:
(self.SWG = self.SWG || []).push(subscriptions => {
  subscriptions.init('publication_id');
});
```

### Self-Configuration

The runtime attempts to automatically resolve configuration properties from the page's markup unless the publisher explicitly calls `subscriptions.init()`.

---

## Public Interface (`Subscriptions`)

The main service interface provided by `swg.js`.

### Lifecycle and State

#### `init(productOrPublicationId: string): void`
Optionally initializes the subscriptions runtime with a publication or product ID. If not called, the runtime will look for initialization parameters in the page's markup.

#### `configure(config: Config): Promise<void> | void`
Optionally configures the runtime with non-default properties.

#### `start(): Promise<void> | void`
Starts the entitlement flow. By default, it runs automatically if the page configuration is findable.

#### `reset(): Promise<void> | void`
Resets the entitlements that can be fetched again.

#### `clear(): Promise<void> | void`
Resets the entitlements and clears all of the caches.

### Entitlements

#### `getEntitlements(params?: GetEntitlementsParamsExternalDef): Promise<Entitlements>`
Fetches entitlements for the current user.

#### `setOnEntitlementsResponse(callback: (entitlements: Promise<Entitlements>) => void): Promise<void> | void`
Sets the callback that receives entitlements responses. This is the primary way publishers receive entitlements data.

### Offers and Purchases

#### `getOffers(options?: {productId?: string}): Promise<Offer[]>`
Returns a list of offers for the publisher.

#### `showOffers(options?: OffersRequest): Promise<void>`
Starts the offers flow (displays UI to the user to subscribe or update).

#### `subscribe(sku: string): Promise<void>`
Starts the subscription purchase flow for a specific SKU.

#### `contribute(skuOrSubscriptionRequest: string | SubscriptionRequest): Promise<void>`
Starts a contribution flow.

### Callbacks and Events

#### `setOnSubscribeResponse(callback: (subscribeResponse: Promise<SubscribeResponse>) => void): Promise<void> | void`
Sets the callback for subscription completion.

#### `setOnPaymentResponse(callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void): Promise<void> | void`
Sets the callback for payment completion.

#### `setOnFlowStarted(callback: (params: {flow: string; data: object}) => void): Promise<void> | void`
Notifies the client when a flow starts.

#### `setOnFlowCanceled(callback: (params: {flow: string; data: object}) => void): Promise<void> | void`
Notifies the client when a flow is canceled by the user.

---

## Configuration (`Config`)

Interface describing runtime configuration overrides.

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `experiments` | `string[]` | `[]` | List of experiments to enable. |
| `windowOpenMode` | `WindowOpenMode` | `"auto"` | Use redirect or popup flow (`auto` or `redirect`). |
| `analyticsMode` | `AnalyticsMode` | `DEFAULT` | Impression logging (`DEFAULT` or `IMPRESSIONS`). |
| `enableSwgAnalytics` | `boolean` | `false` | Whether to send events to Google SwG analytics. |
| `enablePropensity` | `boolean` | `false` | Enable propensity logging. |
| `publisherProvidedId`| `string` | `""` | Optional ID managed by publisher. |
| `gisInterop` | `boolean` | `false` | Enable Google Identity Services (GIS) interop. |

---

## State Transition and Caching

The runtime maintains client-side state for:
- Entitlements cache (cleared via `subscriptions.clear()`).
- Flow state (e.g. whether a dialog is open).

### State Transitions

- **Uninitialized** $\to$ **Configuring** (via `init()` or automatic markup resolution).
- **Configuring** $\to$ **Ready** (when `PageConfig` and dependencies are resolved).
- **Ready** $\to$ **Fetching Entitlements** $\to$ **Entitlements Received**.
- **Ready** $\to$ **Interactive Flows** (Offers, Contributions, Account Linking).

---

## Input/Output Contracts

Most methods return generic `Promise<void>` or handle callbacks.

- **`getEntitlements()`**: Returns a `Promise<Entitlements>`.
- **`saveSubscription()`**: Expects a `SaveSubscriptionRequestCallback` and returns a `Promise<boolean>` indicating success.

---

## Verification

The correctness of this specification is verified against the `src/api/subscriptions.ts` and `src/runtime/runtime.ts` source definitions.
