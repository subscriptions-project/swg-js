# Subscribe with Google Client-Side Architecture

High-level overview of the architectural layers and concepts within the `swg-js` repository.

## Overview

The `swg-js` repository is the client-side gateway between publisher sites and Subscriptions with Google services. It manages entitlements checks, interactive flows, metering, and telemetry without requiring publishers to write complex logic.

---

## Layered Architecture

The repository is structured into several modular layers, each with specific roles and responsibilities.

### 1. **Public API Layer (`src/api/`)**
Defines static interfaces and contracts that publishers interact with directly. It acts as the public SDK boundary.
- **Key entities**: `Subscriptions`, `BasicSubscriptions`, `Entitlements`, `Offer`, `ClientEventManagerApi`.

### 2. **Internal Runtime Layer (`src/runtime/`)**
Implements business logic, orchestrates user operations, and manages publisher page lifecycles. It resolves configuration and instantiates functional modules.
- **Key entities**: `Runtime`, `ConfiguredRuntime`, `AutoPromptManager`, `EntitlementsManager`, `ClientConfigManager`.

### 3. **UI and Communication Components Layer (`src/components/`)**
Handles visual presentations (dialogs, gray panes) and communication across standard system boundaries (e.g. between publisher window and Google iframes).
- **Key entities**: `DialogManager`, `ActivityPorts`.

### 4. **Domain Models Layer (`src/model/`)**
Contains pure data structures that capture page-level states and publisher configurations abstracted from markup.
- **Key entities**: `PageConfig`, `Doc`.

### 5. **Utilities Layer (`src/utils/`)**
Generic, stateless helpers (dates, strings, logs, DOM manipulation).

---

## Key Concepts

### Secure Iframe Communication (`ActivityPorts`)

Because `swg-js` communicates with secure Google domains (e.g. payments or offers flows hosted on `news.google.com`), it relies on standard `postMessage` messaging.
- `ActivityPorts` abstracts low-level message-driven transport into standard Javascript `Promises` or async queues. It ensures secure origins when passing messages.

### Dependency Separation (`Deps` interface)

Modules within the runtime do not retrieve data from ambient global variables. Instead, they share a common `Deps` context (or `ConfiguredRuntime`), ensuring modularity and testability.
- `ConfiguredRuntime` passes parameters down to child managers (`EntitlementsManager`, `AnalyticsService`) to prevent circular or ad-hoc dependencies.

---

## Verification

The correctness of this architectural overview is verified against the folder structures and module boundaries defined under `/src`.
