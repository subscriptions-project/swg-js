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

This flow would notify the publication site when SwG believes that the reader is entitled to read the content, e.g. due to previously purchased subscription. See [Subscriptions APIs](./core-apis.md).

It's recommended that the site install entitlements listener as early as practical using `setOnEntitlementsResponse` method.

For instance:
```js
subscriptions.setOnEntitlementsResponse(function(entitlementsPromise) {
  entitlementsPromise.then(function(entitlements) {
    // Handle the entitlements.
  });
})
```

This callback will be called whenever the new entitlements have been updated.

In the [auto mode](./embed-client.md#auto-initialization), the entitlements are fetched automatically. In the [manual mode](./embed-client.md#manual-initialization) the site can call `start` method:

```js
subscriptions.start();
```

Likewise, at any point, the site can call `getEntitlements` method to access the entitlements, whether they were previously fetched or not:

```js
subscriptions.getEntitlements().then(function(entitlements) {
  // Handle the entitlements.
});
```

You can pass additional parameters to `getEntitlements` to fetch Google metering entitlements, if your publication is part of the Google licensing program.

```js
subscriptions
  .getEntitlements({
    metering: {
      state: {
        // Hashed identifier for a specific user. Hash this value yourself
        // to avoid sending PII.
        id:
          'user5901e3f7a7fc5767b6acbbbaa927d36f5901e3f7a7fc5767b6acbbbaa927',
        // Standard attributes which affect your meters.
        // Each attribute has a corresponding timestamp, which
        // allows meters to do things like granting access
        // for up to 30 days after a certain action.
        //
        // TODO: Describe standard attributes, once they're defined.
        standardAttributes: {
          registered_user: {
            timestamp,
          },
        },
        // Custom attributes which affect your meters.
        // Each attribute has a corresponding timestamp, which
        // allows meters to do things like granting access
        // for up to 30 days after a certain action.
        customAttributes: {
          newsletter_subscriber: {
            timestamp,
          },
        },
      },
    },
  })
  .then((entitlements) => {
    // Check if the article was unlocked with a Google metering entitlement. 
    if (entitlements.enablesThisWithGoogleMetering()) {
      // Consume the entitlement. This lets Google know a specific free 
      // read was "used up", which allows Google to calculate how many
      // free reads are left for a given user.
      //
      // Consuming an entitlement will also trigger a dialog that lets the user
      // know Google provided them with a free read.
      entitlements.consume(() => {
        // Unlock the article AFTER the user consumes a free read.
        // Note: If you unlock the article outside of this callback,
        // users might be able to scroll down and read the article
        // without closing the dialog, and closing the dialog is
        // what actually consumes a free read.
        unlockArticle(); // Your custom article unlocking code goes here.
      });
    }
  });
```

## Entitlement response
| Name | Type | Description |
| ---- | ---- | ----------- |
| source | String | <ul><li>When provided by Google subscriptions: `"google"`</li><li>When provided by Google metering: `"google:metering"`</li><li>When provided by the publisher: the `publicationID` </li></ul> |
products | Array of strings | Subscribe with Google Product IDs the user can access. |
subscriptionToken | String  | <ul><li> When provided by Google subscriptions this is a quoted string that represents an [IN_APP_PURCHASE_DATA](https://developer.android.com/google/play/billing/billing_reference#purchase-data-table) JSON object </li><li> When provided by Google metering this is a JWT containing metering details. </li><li> When provided by the publisher: this is an opaque string the publisher provided to Google during the account linking process.The publisher should use this string to lookup the subscription on their backend </li><li> If you're going to provide JSON in your subscriptionToken, be sure to escape it properly (example below) </li></ul> |

An example response:
```js
{
  service: "subscribe.google.com",
  entitlements: [
    {
      source: "google",
      products: ["example.com:entitlement_label1"],
      subscriptionToken: "{purchaseData - see above}",
      detail: "sku_description"
    },
    {
      source: "example.com",
      products: ["example.com:entitlement_label2"],
      subscriptionToken: "subscription token from example.com",
      detail: "sku_description"
    }
  ],
  isReadyToPay: false
}
```
See the [Entitlements](../src/api/entitlements.js) object for more detail.

## Entitlement acknowledgement

The successful entitlements object should be acknowledged by the publication site to stop it from showing the notification. This is done by calling the `entitlements.ack()` method.

For instance:
```js
subscriptions.setOnEntitlementsResponse(function(entitlementsPromise) {
  entitlementsPromise.then(function(entitlements) {
    // Handle the entitlements.
    entitlements.ack();
  });
})
```

## Validate entitlements
To verify the entitlements from Google are valid and authorised, check the validity of the JWT representation of the entitlements.

The following registered claims are used:

| Claim | Value | Description |
| ----- | ----- | ----------- |
| [`exp`](https://tools.ietf.org/html/rfc7519#section-4.1.4) | [NumericDate](https://tools.ietf.org/html/rfc7519#page-6) (e.g. `1543596936` ) | When the token expires |
| [`iat`](https://tools.ietf.org/html/rfc7519#section-4.1.6) | [NumericDate](https://tools.ietf.org/html/rfc7519#page-6) (e.g. `1543595136` ) | When the token was issued |
| [`iss`](https://tools.ietf.org/html/rfc7519#section-4.1.1) | `subscribewithgoogle@system.gserviceaccount.com` | Issuer of the token |
| [`aud`](https://tools.ietf.org/html/rfc7519#section-4.1.3) | URL (e.g. `https://example.com` ) | Audience of the token which will be the publisher's origin |

To validate the signature, use these [X.509 certificates](https://www.googleapis.com/robot/v1/metadata/x509/subscribewithgoogle@system.gserviceaccount.com) or these [JWKs](https://www.googleapis.com/robot/v1/metadata/jwk/subscribewithgoogle@system.gserviceaccount.com).

> __Note:__ The keys rotate, so make sure to check against each one

## Sample code
This example is a skeleton for the following:
1) Checking if the user has entitlements to the product linked to the content,
2) Checking if the user's subscription is recognized by the publisher,
3) Using the login flow functions if so,
4) Initiating the Deferred Account Creation Flow if not,
5) Remove the "Subscribed with ... [publication] [Manage Link]" bottom toast.
```js
subscriptions.setOnEntitlementsResponse(entitlementsPromise => {
  entitlementsPromise.then(entitlements => {
    // Handle the entitlements.
    if (entitlements.enablesThis()) {
      // Entitlements grant access to the product linked to this content.
       // Look up the user. Resolve the promise with an account (if it was found).
      const accountPromise = new Promise(...);
       // Notify the user that their account is being looked up. It will resolve
      // when accountPromise resolves.
      subscriptions.waitForSubscriptionLookup(accountPromise).then(account => {
        if (account) {
          // Account was found.
          // Option 1 - notify the user that they're being automatically signed-in.
          subscriptions.showLoginNotification().then(() => {
            // Publisher shows content.
          });
           // Option 2 - prompt the user to sign in.
          subscriptions.showLoginPrompt().then(() => {
            // User clicked 'Yes'.
            // Notify the user that they're being logged in with Google.
            subscriptions.showLoginNotification().then(() => {
              // Publisher shows content.
            });
          }, reason => {
            // User clicked 'No'. Publisher can decide how to handle this
            // situation.
            handleCancellation();
          });
        } else {
          // Account was not found, or existing account has no subscription.
          // Let's create a new one or link to the existing publisher account.
          subscriptions.completeDeferredAccountCreation({
            entitlements: entitlements,
            consent: true
          }).then(response => {
            // 1. The user has consented to account creation. Create account
            // based on the response.
             // 2. Signal that the account creation is complete.
            response.complete().then(() => {
              // 3. The flow is complete.
            });
          });
        }
      });
       // Remove the "Subscribed with... Manage" bottom toast.
      entitlements.ack();
    } else {
      // No access; Your logic here: i.e. meter, show a paywall, etc.
    }
  });
});
```
