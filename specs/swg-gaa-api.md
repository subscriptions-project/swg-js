# Subscribe with Google Showcase Client Library (swg-gaa.js) Specification

Specifications for `Subscribe with Google` (Showcase/Extended Access) client-side library.

## Overview

`swg-gaa.js` is the client-side JavaScript runtime for the Showcase/Extended Access experience. It provides high-level APIs for publishers to manage metering and regwalls.

---

## Initialization

The runtime is initialized by loading the script and queuing callbacks. It binds to global variables like `GaaMetering` and `GaaGoogleSignInButton`.

### Loading

```javascript
// Example usage:
(self.GaaMetering = self.GaaMetering || []).push(gaaMetering => {
  gaaMetering.init({
    paywallType: 'PAYWALL_REASON_NONE',
    allowedReferrers: null,
    caslUrl: 'casl_url',
    userState: { ... }
  });
});
```

---

## Public Interface (`GaaMetering`)

The main service interface provided by `swg-gaa.js`.

### Lifecycle and State

#### `init(params: InitParamsDef): void`
Initializes the Showcase/Extended Access runtime with specified parameters.

### Components

#### `GaaGoogleSignInButton`
Component for rendering Google Sign-In button.

#### `GaaGoogle3pSignInButton`
Component for rendering third-party Google Sign-In button.

#### `GaaSignInWithGoogleButton`
Component for rendering Sign-In with Google button.

#### `GaaMeteringRegwall`
Component for rendering metering regwalls.

---

## Configuration (`InitParamsDef`)

Interface describing runtime configuration.

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `paywallType` | `PaywallType` | Required | Type of paywall. |
| `allowedReferrers` | `string[]` | `null` | Allowed referrers list. |
| `googleApiClientId` | `string` | `""` | Optional Google API Client ID. |
| `authorizationUrl` | `string` | `""` | Optional authorization URL. |
| `handleLoginPromise`| `Promise<UserState>`| `null` | Promise handling login response. |
| `caslUrl` | `string` | Required | URL for CASL. |
| `handleSwGEntitlement`| `() => void` | Required | Callback for SwG entitlement. |
| `publisherEntitlementPromise`| `Promise<UserState>`| `null` | Promise handling publisher entitlements. |
| `registerUserPromise`| `Promise<UserState>`| `null` | Promise handling user registration. |
| `showPaywall` | `() => void` | Required | Callback for showing paywall. |
| `showcaseEntitlement`| `string` | Required | Showcase entitlement string. |
| `unlockArticle` | `() => void` | Required | Callback for unlocking article. |
| `rawJwt` | `boolean` | `null` | Raw JWT flag. |
| `userState` | `UserState` | Required | User state object. |
| `shouldInitializeSwG`| `boolean` | `false` | Should initialize SwG on page. |
| `swgInitConfig` | `Config` | `null` | Optional configuration for SwG runtime. |

---

## State Transitions

- **Uninitialized** $\to$ **Configuring** (via `init()`).
- **Configuring** $\to$ **Page Config Resolved** (when page config is read).
- **Page Config Resolved** $\to$ **Ready** $\to$ **Prompting** (AutoPrompts).

---

## Input/Output Contracts

Most methods return generic `Promise<void>` or handle callbacks.

- **`GaaMetering.init()`**: Returns `void`.

---

## Verification

Verified against `src/runtime/extended-access/interfaces.ts` and `src/gaa-main.ts`.
