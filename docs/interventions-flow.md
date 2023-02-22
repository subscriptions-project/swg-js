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

# SwG Interventions Flow

This flow will allow publication sites to display interventions. Interventions are alternatives to displaying a paywall, and include surveys, newsletter sign ups, and registration walls.

After entitlements have been fetched in the [entitlements flow](entitlements-flow.md) the publication site will have access to the `Article` object from the `getArticle` method on the Subscriptions API. To enable this feature publications will need to call `subscriptions.configure` with `useArticleEndpoint` set to `true` in the SwG callback. See [Include SwG client on a site](embed-client.md) for setting up the SwG callback.
```javascript
// Configure getEntitlements to use the article endpoint.
(self.SWG = self.SWG || []).push(function(subscriptions) {
	subscriptions.configure({useArticleEndpoint: true});
	subscriptions.init(publicationOrProductId);
});
```
 Article contains a list of available actions in descending order of precedence, which can be invoked with the `showIntervention` method in the Subscriptions API. To handle errors or process the data on your own, you may set a callback for the response with `setOnInterventionComplete`.
 ## Sample code
```javascript
// Set up a callback to know the result of an intervention.
subscriptions.setOnInterventionComplete({
	type: InterventionType.SURVEY,
	callback: (response) => {
		// Determine action based on response.
	},
});
// Get the article from the subscriptions API.
// Note: the article promise will only resolve after `getEntitlements` has completed.
subscriptions.getArticle().then((article) => {
	// Determine if this intervention is available for use.
	if (article.audienceActions.actions.includes(InterventionType.SURVEY)) {
		// Finally, show the intervention.
		subscriptions.showIntervention({
			// You must specify the intervention you wish to show.
			type: InterventionType.SURVEY,
			// Determine if the intervention is dismissible.
			isClosable: false,
		});
	}
});

```

## Article
The article response object contains various fields, but for interventions we are particularly interested in the `audienceActions.actions` fields. The `actions` field is a string array containing the actions(interventions) that are available. These map on to the `InterventionType` enum, but could potentially contain actions defined by the publication site.
```javascript
/**
 * Partial Article response object.
 *
 * @typedef {{
 *  audienceActions: ({
 *    actions: Array<{
 *      type: string
 *    }>,
 *  }),
 * }}
 */
 ```
## InterventionType
This is an enum of interventions provided by SwG. The enum can be provided as the name of the above methods. 
| Name              | Value             |
| ----------------- | ----------------- |
| REGISTRATION_WALL | registration_wall |
| NEWSLETTER_SIGNUP | newsletter_signup |
| SURVEY            | survey            |

## setOnInterventionComplete response
This depends on the intervention and is currently undefined.