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


# SwG Login Prompt flow (NOT YET LAUNCHED)

This is the flow in which Google will ask the user for permission to log them in to the publisher's site. It is initiated by the publisher when the publisher doesn't find a user's subscription but Google does find the subscription.

Here is an example of what this flow can look like:

```
// Publisher is looking up the user.
const  accountPromise = new Promise( … ); 

// Notify the user that their account is being looked up.
subscriptions.waitForSubscriptionLookup(accountPromise).then(account => {
    
    // Account was found.
    if(account) {

        // Option 1 - let the user read. 
        // Publisher does their thing to show content.
        

        // Option 2 - notify the user that they're being logged in with Google.
        subscriptions.loginNotification().then(response => {
            // Publisher shows content.
        }

        // Option 3 - get user permission to login with Google.
        subscriptions.showLoginPrompt().then(response => {

            // User clicked 'Yes' and we logged them in.
            // Publisher shows content so they can read.

        }, reason => {

            // Publisher can decide how to handle the following situations:

            // User clicked 'No' so we didn't log them in.
            if(response == 'no') someHandlerForThisSituation();

            // Error.
            if(response == 'error') someHandlerForThisOtherSituation();

        });

  } else {

    // Account was not found. Let's create a new one.
    // Go to docs/deferred-account-flow.md for full documentation.
    subscriptions.completeDeferredAccountCreation({entitlements});

  }
});
```