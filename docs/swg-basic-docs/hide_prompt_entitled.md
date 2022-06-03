---
description: In this example, you can dismiss the Subscribe with Google prompt for an entitled user.
---

# Hide Subscribe with Google prompt for entitled users

The following code snippet enhancement leverages the setOnEntitlementsResponse listener to dismiss the Subscribe with Google prompt once the user's entitlement has been validated.

```javascript
(self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
    basicSubscriptions.setOnEntitlementsResponse(entitlementsPromise => {
      entitlementsPromise.then(entitlements => {
        // Indicates that the user has either a subscription or has previously contributed
        if (entitlements.enablesThisWithCacheableEntitlements()) {
          // hide the SwG prompt
          basicSubscriptions.dismissSwgUI();
        }
      });
    });
    basicSubscriptions.init({
      type: "NewsArticle",
      isAccessibleForFree: false,
      isPartOfType: ["Product"],
      isPartOfProductId: "<your product id>",
      autoPromptType: "<contribution | subscription>",
      clientOptions: { lang: "en" },
    });
  });
