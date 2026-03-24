# AutoPromptManager Specification

Technical specification for the internal `AutoPromptManager` class within the Subscribe with Google runtime.

## Overview

`AutoPromptManager` manages the automated display of subscription, contribution, and other intervention prompts (such as newsletter signups and regwalls) to the user. it checks preconditions such as entitlements, capped impression counts, and developer overrides before triggering a prompt.

---

## Initialization & Dependencies

The `AutoPromptManager` is constructed with dependencies derived from `Deps` and `ConfiguredRuntime`.

### Dependencies
- **`Deps`**: Provides access to document (`Doc`), configuration (`PageConfig`), storage (`Storage`), and event management (`ClientEventManager`).
- **`EntitlementsManager`**: Used to fetch current user entitlements and article configurations.
- **`ClientConfigManager`**: Used to fetch server-side client configurations.
- **`MiniPromptApi`**: Interface for rendering mini prompts.

---

## Primary Interface

### `showAutoPrompt(params: ShowAutoPromptParams): Promise<void>`

Triggers the display of the auto prompt if preconditions are met.

#### Parameters (`ShowAutoPromptParams`)

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `autoPromptType` | `AutoPromptType` | Required | Type of prompt to display. |
| `alwaysShow` | `boolean` | `false` | If true, overrides all display rules (capping, entitlements) for preview purposes. |
| `isClosable` | `boolean` | `false` | Whether the prompt can be closed by the user. |
| `contentType` | `ContentType` | Required | Content type (`OPEN` or `CLOSED`). |

---

## Flow Logic & State Transitions

The execution flow within `showAutoPrompt` transitions through several states:

1.  **Check Suppressions**: If `autoPromptType` is `AutoPromptType.NONE`, abort.
2.  **Dev Mode Check**: If `alwaysShow` is true, bypass rules and trigger visual display immediately.
3.  **Fetch System State**: Asynchronously fetch `ClientConfig`, `Entitlements`, and `Article` state.
4.  **Evaluate Preconditions**:
    -   Check if user already has active entitlements.
    -   Check if the user has reached impression caps for the specific prompt.
5.  **Trigger Visual Prompt**:
    -   If onsite preview is enabled, show preview prompt.
    -   Else, show the standard auto prompt based on server-side rules.

---

## Interventions Mapping

Client events (such as clicks and dismissals) are mapped to standard `InterventionType` identifiers to maintain consistency across telemetry.

### Dismissal Events mapping

-   `ACTION_SWG_CONTRIBUTION_MINI_PROMPT_CLOSE` $\to$ `TYPE_CONTRIBUTION`
-   `ACTION_NEWSLETTER_OPT_IN_CLOSE` $\to$ `TYPE_NEWSLETTER_SIGNUP`
-   `ACTION_REGWALL_OPT_IN_CLOSE` $\to$ `TYPE_REGISTRATION_WALL`
-   `ACTION_SURVEY_CLOSED` $\to$ `TYPE_REWARDED_SURVEY`

### Completion Events Mapping

-   `EVENT_CONTRIBUTION_PAYMENT_COMPLETE` $\to$ `TYPE_CONTRIBUTION`
-   `EVENT_SUBSCRIPTION_PAYMENT_COMPLETE` $\to$ `TYPE_SUBSCRIPTION`
-   `ACTION_REGWALL_OPT_IN_BUTTON_CLICK` $\to$ `TYPE_REGISTRATION_WALL`

---

## Verification

The specification is verified against `src/runtime/auto-prompt-manager.ts`.
