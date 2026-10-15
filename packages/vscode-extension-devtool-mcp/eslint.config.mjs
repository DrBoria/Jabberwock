import { config } from "@jabberwock/config-eslint/base"

/**
 * Devtool package — a GENERIC, host-neutral, multi-framework npm library
 * (published as `vscode-extension-devtool-mcp`).
 *
 * The app-doctrine architecture rules in `@jabberwock/config-eslint/base`
 * encode the Jabberwock APPLICATION invariants: "ALL state in MST", "no
 * classes", "state must live in MobX". Those invariants are true for the
 * application (backend/ + frontend/src/ of the extension) but CANNOT hold in
 * this library:
 *
 *  - It supports MULTIPLE store frameworks (MobX-State-Tree, Redux, Zustand,
 *    Apollo) behind a single `IStoreAdapter` seam. "State must be MobX" is
 *    literally false by design.
 *  - It is INSTANTIATED per host app. A `Devtool` server, an MCP client, a
 *    CDP console buffer, a diagnostics manager are per-connection resources
 *    bound to a live process/socket — not feature state of the Jabberwock
 *    root store. Flattening them into the app's MST store is impossible
 *    (they do not run inside the app) and wrong (a library cannot own the
 *    host's single store).
 *  - The rules' `includes: ["backend/", "frontend/src/", ...]` path filters
 *    were written for the app layout; after this package's restructure its
 *    `src/backend/**` files happen to match `backend/` and got flagged,
 *    while `src/frontend/**` does not match `frontend/src/` — a pure path
 *    artifact, not a real doctrine violation.
 *
 * The rules disabled below are the app-doctrine set ONLY. Generic code
 * quality rules (complexity, max-lines, no-explicit-any, empty handlers,
 * impure utils, passthrough, …) stay ON and are enforced in this package's
 * own code (empty catches are logged, utils are pure).
 *
 * Three more rules target the Jabberwock APP folder doctrine and do not fit
 * a published library:
 *
 *  - `local/no-logic-in-index` — the library's public API is domain barrels
 *    (`stores/index.ts`, `mcp/interceptor/index.ts` …) that DEFINE their core
 *    types/classes right where consumers import them. Moving every definition
 *    out of its index would split each domain's contract from its home.
 *  - `local/no-complex-folder-structure` — the rule's heuristics (a folder
 *    named `stores/`, per-framework `mobx/redux/zustand/apollo` subfolders,
 *    `tools.ts`/`store.ts` role families) describe app feature folders. Here
 *    `stores/` IS the package's raison d'être: one subfolder per supported
 *    store framework, on purpose.
 *  - `local/no-reexport` — the package's entry points (`mcp/server.ts`,
 *    `stores/tools.ts`, …) re-export the public API surface so host apps get a
 *    single import path; that is how published libraries are structured.
 */
export default [
	...config,
	{
		rules: {
			// v2 rule #4 "ALL state in MST" — app invariant, not a library invariant.
			"local/no-shadow-store": "off",
			// "No classes — a class is a shadow store wearing a costume" — app
			// invariant. The library's per-connection classes (Devtool,
			// CdpConsoleBuffer, …) are framework-shaped resources, not feature state.
			"local/no-classes": "off",
			// "State must live in MobX" — false by design: the library supports
			// Redux / Zustand / Apollo adapters too.
			"local/no-state-outside-mobx": "off",
			// v2 layer model (actions/events/handlers) — an app feature layout,
			// not a library layout.
			"local/no-misplaced-concern": "off",
			// "A feature folder must have store.ts" — app feature doctrine; this
			// package has no app features.
			"local/no-feature-store": "off",
			// Root-accessor doctrine for app stores — not applicable to a library.
			"local/no-direct-store-import": "off",
			// Domain barrels that define their core contract in index.ts (see above).
			"local/no-logic-in-index": "off",
			// Per-framework store families + library folder layout (see above).
			"local/no-complex-folder-structure": "off",
			// Public API re-exports at the package's entry points (see above).
			"local/no-reexport": "off",
		},
	},
]
