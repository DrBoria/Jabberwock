# D4g-pre Chunk Spec — Decouple the 7 Unlisted Root-Store Files

> **Status:** SPEC — gate-able dispatch spec for the D4g-pre Code-mode subtask.
> **HEAD:** `cb6fa63e5` (branch `mega-refactoring`). D4g PART 1 already shipped (`intents.ts` + `migrateSettings.ts` + `IHostContext.language`).
> **Authoritative specs:** [`plans/phase-d-implementation-plan.md`](phase-d-implementation-plan.md) §3.1/§3.6, [`plans/d4g-decision-c2-purity.md`](d4g-decision-c2-purity.md) §4.2.
> **Verified this session:** esbuild metafile probe (root-store = 7 vscode-importing files post-PART 1, server baseline = 0) + Serena LSP (provider-registry layering, PostHog vscode usage, `importVscode` dynamic import, `vscodeLmTransform` dead code).

---

## 1. Goal

Clear the **7 vscode-importing files** from the root-store import graph (entry `backend/features/backendroot/store.ts`) so that `createBackendRootStore()` is C-2 pure (zero vscode/platform imports in the server-reachable graph). This unblocks wiring `createBackendRootStore()` into `startBackend()` (D4g PART 2, half 1).

The 7 files (verified by esbuild metafile probe, post-PART 1):

| #   | File                                                                      | Decoupling approach                          |
| --- | ------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | `packages/telemetry/src/PostHogTelemetryClient.ts`                        | Host-context injection (§3)                  |
| 2   | `connectors/vscode/backend/model-providers/vscode-lm/handler.ts`          | Provider-registry seam (§2) — file NOT moved |
| 3   | `connectors/vscode/backend/model-providers/vscode-lm/vscode-lm-format.ts` | Provider-registry seam (§2) — file NOT moved |
| 4   | `connectors/vscode/backend/model-providers/vscode-lm/tools.ts`            | Provider-registry seam (§2) — file NOT moved |
| 5   | `connectors/vscode/backend/model-providers/vscode-lm/stream.ts`           | Provider-registry seam (§2) — file NOT moved |
| 6   | `connectors/vscode/backend/model-providers/vscode-lm/token-count.ts`      | Provider-registry seam (§2) — file NOT moved |
| 7   | `packages/cloud/src/importVscode.ts`                                      | Module-holder pattern (§4)                   |

**Key insight:** the 5 vscode-lm files (2–6) are ALREADY in the vscode connector (correct location). They are in the root-store graph only because SHARED backend code statically imports them. The fix is to remove the shared-backend static imports (via the provider-registry seam), NOT to move the vscode-lm files. Files 1 and 7 need direct vscode decoupling.

---

## 2. Provider-Registry Seam (the vscode-lm ×5 fix)

### 2.1 Why a registry (vs alternatives)

The shared [`backend/api/handler.ts:134`](../backend/api/handler.ts:134) has a static `providerHandlerMap: Record<string, ProviderConstructor>` that names `VsCodeLmHandler`. Because it is a static `Record`, esbuild bundles the entire vscode-lm module (and its `vscode` imports) into the server graph, regardless of any runtime gate. A runtime capability gate does NOT fix C-2 (the static import is bundled regardless).

Alternatives considered and rejected:

- **Move the map into the vscode connector:** rejected — the map is used by `buildApiHandler` (shared), which must work in both modes. Moving it would fork the composition root (violates §4.1 one-code-path).
- **DI-injected factory:** rejected — `buildApiHandler` is called at request time with a `ProviderSettings` object; there is no DI container in the shared backend. A mutable registry is simpler and matches the existing "register at activation" pattern.
- **Dynamic import:** rejected — `await import("vscode-lm")` would still create a chunk that esbuild builds (and it would fail the server build if it imports vscode). It also adds async complexity to `buildApiHandler` (currently sync).

**The registry is the right mechanism:** the shared backend owns a mutable `registerProvider(name, ctor)` + `getProvider(name)` registry. `buildApiHandler` looks up the registry first, then falls back to the static map (which no longer contains `vscode-lm`). The vscode connector registers `vscode-lm` at activation; the server registers nothing (vscode-lm is simply unavailable in server mode — correct, it is a host-specific provider).

### 2.2 Registry location + surface

New file: `backend/api/providers/registry.ts` (shared backend).

```typescript
import type { ApiHandler } from "../handler"

type ProviderConstructor = new (options: Record<string, unknown>) => ApiHandler
type ProviderFactory = (options: Record<string, unknown>) => ApiHandler
type ProviderEntry = ProviderConstructor | ProviderFactory

const providerRegistry = new Map<string, ProviderEntry>()

/** Register a host-specific provider (called by the connector at activation). */
export function registerProvider(name: string, entry: ProviderEntry): void {
	providerRegistry.set(name, entry)
}

/** Look up a registered provider (returns undefined if not registered). */
export function getProvider(name: string): ProviderEntry | undefined {
	return providerRegistry.get(name)
}

/** Check if a provider is registered. */
export function hasProvider(name: string): boolean {
	return providerRegistry.has(name)
}
```

### 2.3 `buildApiHandler` change ([`backend/api/handler.ts`](../backend/api/handler.ts))

- Remove `VsCodeLmHandler` from the import list (line 21).
- Remove `"vscode-lm": VsCodeLmHandler` from `providerHandlerMap` (line 134).
- Add `import { getProvider } from "./providers/registry"`.
- In `buildApiHandler`, look up the registry first:
    ```typescript
    const handlerFactory = getProvider(apiProvider ?? "") ?? providerHandlerMap[apiProvider ?? ""]
    ```
    (rest of the function unchanged)

**Behavior note:** in server mode, `getProvider("vscode-lm")` returns undefined and `providerHandlerMap["vscode-lm"]` is undefined (removed), so `buildApiHandler` falls back to `new AnthropicHandler(options)` (the existing unknown-provider fallback). This is acceptable: vscode-lm is a host-specific provider and should not be selectable in server mode.

### 2.4 Remove the shared-backend static imports

- [`backend/api/providers/index.ts:21`](../backend/api/providers/index.ts:21): remove `export { VsCodeLmHandler } from "@connectors/vscode/backend/model-providers/vscode-lm"`.
- [`backend/api/transform/format/index.ts:6`](../backend/api/transform/format/index.ts:6): remove `export { convertToVsCodeLmMessages as vscodeLmTransform } from "@connectors/vscode/backend/model-providers/vscode-lm/vscode-lm-format"` (**dead code** — no consumer; the actual `convertToVsCodeLmMessages` is consumed only inside the vscode connector's [`handler.ts:142`](../connectors/vscode/backend/model-providers/vscode-lm/handler.ts:142) via a relative import).
- [`backend/api/transform/index.ts:9`](../backend/api/transform/index.ts:9): remove `vscodeLmTransform,` from the re-export list.

### 2.5 vscode connector registration ([`connectors/vscode/backend/activation/extension.ts`](../connectors/vscode/backend/activation/extension.ts))

At activation (top of the `activate` function, before `startBackend()` is called):

```typescript
import { registerProvider } from "@api/providers/registry"
import { VsCodeLmHandler } from "@connectors/vscode/backend/model-providers/vscode-lm"
// ...
registerProvider("vscode-lm", VsCodeLmHandler)
```

The server ([`connectors/web/backend/main.ts`](../connectors/web/backend/main.ts)) registers nothing → `vscode-lm` is unavailable in server mode (correct).

---

## 3. PostHogTelemetryClient.ts decoupling

**Verified vscode usage** (corrects the ruling's "version/language in telemetry properties" claim):

- Line 27: `private distinctId: string = vscode.env.machineId` (field initializer, runs at construction).
- Line 157 (in `updateTelemetryState`): `vscode.workspace.getConfiguration("telemetry").get<string>("telemetryLevel", "all")`.

There is NO `vscode.version` / `vscode.env.language` read in this file (those are in `intents.ts`, cleared by PART 1).

**Fix (host-context injection):**

1. [`packages/types/src/protocol/backend-connector.ts`](../packages/types/src/protocol/backend-connector.ts): add to `IHostContext`:
    ```typescript
    /** Stable host machine identifier (vscode mode = `vscode.env.machineId`); absent in server mode. */
    machineId?: string
    /** The host's global telemetry level (vscode mode = `telemetry.telemetryLevel`); absent in server mode. */
    getTelemetryLevel?: () => string
    ```
2. [`packages/telemetry/src/PostHogTelemetryClient.ts`](../packages/telemetry/src/PostHogTelemetryClient.ts):
    - Remove `import * as vscode from "vscode"`.
    - Add `import type { IHostContext } from "@jabberwock/types"` and `import { randomUUID } from "node:crypto"`.
    - Change `private distinctId: string = vscode.env.machineId` → `private distinctId: string`.
    - Add `private readonly host?: Pick<IHostContext, "machineId" | "getTelemetryLevel">`.
    - Constructor: `constructor(debug = false, host?: Pick<IHostContext, "machineId" | "getTelemetryLevel">) { super(...); this.host = host; this.distinctId = host?.machineId ?? randomUUID(); ... }`.
    - `updateTelemetryState`: `const telemetryLevel = this.host?.getTelemetryLevel?.() ?? "all"`.
3. [`backend/extension-activation/modules/core/core.ts:35`](../backend/extension-activation/modules/core/core.ts:35) (vscode activation path, NOT in the root-store graph): pass the host context:
    ```typescript
    telemetryService.register(
    	new PostHogTelemetryClient(false, {
    		machineId: vscode.env.machineId,
    		getTelemetryLevel: () =>
    			vscode.workspace.getConfiguration("telemetry").get<string>("telemetryLevel", "all") ?? "all",
    	}),
    )
    ```

**Note:** `core.ts` is in the shared `backend/` tree but is vscode-connector-only (not in the root-store graph, not in the server graph — verified by probe). It already imports vscode, so reading `vscode.env.machineId` there is fine. The `randomUUID()` fallback is effectively dead code (PostHog is only constructed in the vscode path, which always provides `machineId`).

---

## 4. importVscode.ts decoupling

**Verified vscode usage:** `require("vscode")` + `await import("vscode")` (both esbuild-resolved at bundle time → vscode in the server graph).

**Fix (module-holder pattern):**

1. [`packages/cloud/src/importVscode.ts`](../packages/cloud/src/importVscode.ts):

    ```typescript
    let vscodeModule: typeof import("vscode") | undefined

    /** Set the vscode module (called by the vscode connector at activation). */
    export function setVscodeModule(mod: typeof import("vscode") | undefined): void {
    	vscodeModule = mod
    }

    /** Returns the vscode module if set, else undefined. */
    export async function importVscode(): Promise<typeof import("vscode") | undefined> {
    	return vscodeModule
    }
    ```

    - `typeof import("vscode")` is a TYPE-only reference (erased at compile time, not a runtime import) → C-2 safe.
    - Remove `require("vscode")` and `await import("vscode")`.
    - Ensure `setVscodeModule` is exported from the `@jabberwock/cloud` package index.

2. [`connectors/vscode/backend/activation/extension.ts`](../connectors/vscode/backend/activation/extension.ts) (vscode connector activation): `import { setVscodeModule } from "@jabberwock/cloud"`; call `setVscodeModule(vscode)` at activation.
3. The server never calls `setVscodeModule` → `importVscode()` returns undefined → cloud code handles the undefined case (it already does).

**Note:** `importVscode()` is called by `packages/cloud/src/auth/web-auth-helpers.ts` (4 sites) and `packages/cloud/src/service/CloudShareService.ts` (1 site). All handle the undefined case. No changes needed there.

---

## 5. Gates

- **G1:** `pnpm check-all` (lint + check-types + test). All pass, 0 errors.
- **G2:** `pnpm build --force` — server bundle (`backend/dist/server.js`) builds WITHOUT vscode external (C-2 automatic proof: any transitive vscode import fails the build). Extension bundle still builds with vscode external.
- **G3:** esbuild metafile probe on `backend/features/backendroot/store.ts` (vscode external, `write: false`) shows **0** vscode-importing files (root-store graph drops 7→0 post-PART 1; equivalently 8→0 from the post-D4f residual).
- **G4:** extension regression — vscode-lm provider still works in extension mode (devtool 3 layers: backend variables, store state, UI). Select a vscode-lm model, send a message, verify the response streams correctly.
- **G5:** stage by literal path (no commit — orchestrator commits at phase finalization).

---

## 6. Dependencies

- **Preceded by:** D4g PART 1 (shipped: `intents.ts` + `migrateSettings.ts` + `IHostContext.language`).
- **Unblocks:** D4g PART 2 (wire `createBackendRootStore()` into `startBackend()`, half 1). `setupIntentBus()` is still blocked (D4g-2, 83-file handler graph).
- **Followed by:** D4g-2 (83-file handler-registration graph, sub-batched by group) → D4g PART 2 (wire `setupIntentBus()`, half 2) → D4h → D3 → D5 → D6.

---

## 7. Out of scope (D4g-2)

- [`backend/features/settings/handlers/settings/on-settings-models.ts:6`](../backend/features/settings/handlers/settings/on-settings-models.ts:6) (`getVsCodeLmModels` import) — in the settings handler group (D4g-2). The provider-registry seam does NOT automatically decouple this (it is a function, not a handler ctor). D4g-2 needs a separate capability slot for model fetching (or move the vscode-lm model fetch to the connector).
- The 83-file handler-registration graph (D4g-2).
