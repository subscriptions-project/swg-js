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

This flow will allow publication sites to display interventions. Interventions are alternatives to displaying a paywall, and include surveys and newsletters.

After entitlements have been fetched in the [entitlements flow](entitlements-flow.md) the publication site will have access to the `Article` object from the `getArticle` method on the Subscriptions API.
```javascript
/**
 * Partial Article response object.
 *
 * @typedef {{
 *  audienceActions: ({
 *    actions: Array<{
 *      type: InterventionType
 *    }>,
 *  }),
 * }}
 */
 ```
 This object contains a list of available actions in descending order of precedence, which can be invoked with the `showIntervention` method in the Subscriptions API. When the publication site wishes to know the outcome of the intervention, they can call the `setOnInterventionComplete` method on the Subscriptions API to set a callback for completion of an intervention.

 ## Sample code
```javascript
// Set up a callback to know the result of an intervention.
subscriptions.setOnInterventionComplete({
	// Provide the intervention type, in this case a survey.
	interventionType: InterventionType.SURVEY,
	// Provide callback to receive the status.
	callback: (status) => {
		if (status == InterventionCompleteStatus.COMPLETE) {
			// Successfully completed
		} else { // InterventionCompleteStatus.FAILED
			// Failed to complete
		}
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
			interventionType: InterventionType.SURVEY,
			// Determine if the intervention is dismissible.
			isClosable: false,
		});
	}
});
```
## InterventionType
Currently only the `SURVEY` type is supported for interventions.

## InterventionCompleteStatus
This has the values `COMPLETE` and `FAILED`, indicating the status of the intervention completion.
