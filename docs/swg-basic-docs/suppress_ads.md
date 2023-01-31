---
description: In this example, suppress ads for an entitled user.
---

# Suppress Ads for an Entitled User

The following code snippet enhancement leverages the setOnEntitlementsResponse listener to suppress ads once the user's entitlement has been validated.

```javascript
(self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
    basicSubscriptions.setOnEntitlementsResponse(entitlementsPromise => {
      entitlementsPromise.then(entitlements => {
        // Indicates that the user has either a subscription or has previously contributed
        if (entitlements.enablesThisWithCacheableEntitlements()) {
          // Insert logic to disable ads, depending on your ad network provider
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
```
