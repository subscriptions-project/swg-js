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

# SwG Subscribe Flow

This flow shows the payment form, accepts payment, records subscription and updates the reader's entitlements. See [Subscriptions APIs](./core-apis.md).

_Important!_ Please ensure you set up the `setOnPaymentResponse` on any page where you accept purchases, not just before you call `subscribe` or `showOffers`. SwG client ensures it can recover subscriptions even when browsers unload pages.

First, please setup the subscription response callback via `setOnPaymentResponse`:

```js
subscriptions.setOnPaymentResponse(function (paymentResponse) {
  paymentResponse.then(function (response) {
    // Handle the payment response.
    // Some websites would create or update a user at this point.
    response.complete().then(function () {
      // The payment is fully processed.
      // Some websites would update their UI at this point,
      // if the purchase unlocked content.
    });
  });
});
```

Once you receive subscription response:

1.  You can process the subscription. For instance you can create a new account based on the `userData` info and save subscrpition for this account.
2.  Once subscription is processed, call `response.complete()`. This method will signal to SwG that your site has accepted the subscription. It will return a promise that will be resolved once the user has acknowledged subscription.
3.  Once the `response.complete()` promise is resolved, you can unblock content, show additional UI to the user or perform any actions you see fit.

To activate subscription flow itself, call the `subscribe` method with the desired SKU:

```js
subscriptions.subscribe(sku);
```

Another way to trigger the subscribe flow is by starting [Offers flow](./offers-flow.md).

The `setOnPaymentResponse` callback will be called once the subscription is complete, or when the previously executed subscription is recovered.

## Subscribe response

The response returned by the `setOnPaymentResponse` callback is the [`SubscribeResponse`](../src/api/subscribe-response.js) object. It includes purchase details, as well as user data and the purchased entitlement.

### Structure

The SubscriptionResponse object has the following structure:

```json
{
  "raw": "",
  "purchaseData": {
    "raw": "",
    "signature": ""
  },
  "productType": "SUBSCRIPTION",
  "userData": {
    "idToken": "...",
    "data": {},
    "id": "",
    "email": "",
    "emailVerified": true,
    "name": "",
    "givenName": "",
    "familyName": "",
    "pictureUrl": ""
  },
  "entitlements": {
    "service": "subscribe.google.com",
    "entitlements": [
      {
        "source": "google",
        "products": [""],
        "subscriptionToken": ""
      }
    ],
    "isReadyToPay": false
  }
}
```

### `purchaseData` properties

| Name      | Data type | Related In-app Billing purchase request field                                                                                      | Description                                                                                                                                                       |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| raw       | String    | [IN_APP_PURCHASE_DATA](https://developer.android.com/google/play/billing/billing_reference#purchase-data-table)                    | A string in JSON format that contains details about the purchase order.                                                                                           |
| signature | String    | [IN_APP_DATA_SIGNATURE](https://developer.android.com/google/play/billing/billing_reference#purchase-pendingintent-response-table) | String containing the signature of the purchase data that was signed with the private key of the developer. The data signature uses the RSASSA-PKCS1-v1_5 scheme. |

The `purchaseData.raw` fields are identical to the fields from an Android In-App Billing [IN_APP_PURCHASE_DATA](https://developer.android.com/google/play/billing/billing_reference#purchase-data-table) object.

### `userData` properties

| Name          | Data type | Description                                                                                                                                                                                                                                                                                             |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idToken       | String    | The Google Sign-in ID Token. For more information, see [Google Sign-in for Websites - Authenticate with a Backend Server](https://developers.google.com/identity/sign-in/web/backend-auth#calling-the-tokeninfo-endpoint).                                                                              |
| data          | Object    | The information contained within the ID Token.                                                                                                                                                                                                                                                          |
| id            | String    | The user’s Google Sign-in ID. This corresponds to the sub field of the idToken.                                                                                                                                                                                                                         |
| email         | String    | The user’s email address. <blockquote><b>Note:</b> A Google account's email address can change, so don't use it to identify a user. Instead, use the account's ID, which you can get on the client with getBasicProfile().getId() , and on the backend from the sub claim of the ID token.</blockquote> |
| emailVerified | Boolean   | Returns true if the email address is verified by Google.                                                                                                                                                                                                                                                |
| name          | String    | Full name, including given and family name.                                                                                                                                                                                                                                                             |
| givenName     | String    | The user's first name.                                                                                                                                                                                                                                                                                  |
| familyName    | String    | The user's last name.                                                                                                                                                                                                                                                                                   |
| pictureUrl    | String    | The user's profile picture.                                                                                                                                                                                                                                                                             |

### `entitlements`

The entitlement object will contain the entitlement for the successful purchase. It won't have all the user entitlements. It has the same structure of the [Entitlements Flow response](./entitlements-flow.md#entitlement-response).

### Example response

```json
{
  "raw": "... raw delimited JSON String ...",
  "purchaseData": {
    "raw": "{\"orderId\":\"GNS.XXXX-XXXX-XXXX-XXXXX\",\"packageName\":\"com.norcal-tribune.android\",\"productId\":\"basic_monthly\",\"purchaseTime\":1535389694143,\"purchaseState\":0,\"purchaseToken\":\"...\",\"autoRenewing\":true}",
    "signature": "..."
  },
  "userData": {
    "idToken": "...",
    "data": {
      "iss": "https://accounts.google.com",
      "sub": "000000000000000000000",
      "azp": "xxx.apps.googleusercontent.com",
      "aud": "xxx.apps.googleusercontent.com",
      "iat": 0000000000,
      "exp": 0000000000,
      "nbf": 0000000000,
      "hd": "google.com",
      "jti": "...",
      "email": "...@gmail.com",
      "email_verified": true,
      "name": "GivenName FamilyName",
      "given_name": "GivenName",
      "family_name": "FamilyName",
      "picture": "https://...jpg"
    },
    "id": "000000000000000000000",
    "email": "...@gmail.com",
    "emailVerified": true,
    "name": "GivenName FamilyName",
    "givenName": "GivenName",
    "familyName": "FamilyName",
    "pictureUrl": "https://...jpg"
  },
  "entitlements": {
    "service": "subscribe.google.com",
    "entitlements": [
      {
        "source": "google",
        "products": ["example.com:entitlement_label1"],
        "subscriptionToken": "..."
      }
    ],
    "isReadyToPay": false
  }
}
```
