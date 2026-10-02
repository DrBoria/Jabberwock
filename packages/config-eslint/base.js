import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"
import eslintComments from "eslint-plugin-eslint-comments"
import noPassthrough from "./rules/no-passthrough.js"
import noReexport from "./rules/no-reexport.js"
import noLogicInIndex from "./rules/no-logic-in-index.js"
import noStoreOutsideStore from "./rules/no-store-outside-store.js"
import noDynamicImports from "./rules/no-dynamic-imports.js"
import noComplexFolderStructure from "./rules/no-complex-folder-structure.js"
import noMisplacedConcern from "./rules/no-misplaced-concern.js"
import noStateOutsideMobx from "./rules/no-state-outside-mobx.js"
import noEmptyFiles from "./rules/no-empty-files.js"
import featureNaming from "./rules/feature-naming.js"
import actionsPurity from "./rules/actions-purity.js"
import noDirectIpc from "./rules/no-direct-ipc.js"
import noMonolithicRegistration from "./rules/no-monolithic-registration.js"
import noDeepFeatureImport from "./rules/no-deep-feature-import.js"
import noShadowStore from "./rules/no-shadow-store.js"
import noDuplicatedLogic from "./rules/no-duplicated-logic.js"
import noClasses from "./rules/no-classes.js"
import noFeatureStore from "./rules/no-feature-store.js"
import noDirectStoreImport from "./rules/no-direct-store-import.js"
import noImpureUtils from "./rules/no-impure-utils.js"
import noEmptyHandlers from "./rules/no-empty-handlers.js"
import { impureUtilsDebt } from "./debt/impure-utils-debt.js"
import { emptyHandlersDebt } from "./debt/empty-handlers-debt.js"
import { shadowStoreDebt } from "./debt/shadow-store-debt.js"
import { passthroughDebt } from "./debt/passthrough-debt.js"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
	js.configs.recommended,
	eslintConfigPrettier,
	...tseslint.configs.recommended,
	{
		plugins: {
			turbo: turboPlugin,
			"eslint-comments": eslintComments,
			local: {
				rules: {
					"no-passthrough": noPassthrough,
					"no-reexport": noReexport,
					"no-logic-in-index": noLogicInIndex,
					"no-store-outside-store": noStoreOutsideStore,
					"no-dynamic-imports": noDynamicImports,
					"no-complex-folder-structure": noComplexFolderStructure,
					"no-misplaced-concern": noMisplacedConcern,
					"no-state-outside-mobx": noStateOutsideMobx,
					"no-empty-files": noEmptyFiles,
					"feature-naming": featureNaming,
					"actions-purity": actionsPurity,
					"no-direct-ipc": noDirectIpc,
					"no-monolithic-registration": noMonolithicRegistration,
					"no-deep-feature-import": noDeepFeatureImport,
					"no-shadow-store": noShadowStore,
					"no-duplicated-logic": noDuplicatedLogic,
					"no-classes": noClasses,
					"no-feature-store": noFeatureStore,
					"no-direct-store-import": noDirectStoreImport,
					"no-impure-utils": noImpureUtils,
					"no-empty-handlers": noEmptyHandlers,
				},
			},
		},
		rules: {
			"turbo/no-undeclared-env-vars": "off",
			// Fully generic; `debt` grandfatheres pre-existing violations
			// (see debt/passthrough-debt.js). The ledger must shrink to [].
			"local/no-passthrough": ["error", { debt: passthroughDebt }],
			"local/no-reexport": "error",
			"local/no-logic-in-index": "error",
			"local/no-store-outside-store": "error",
			"local/no-dynamic-imports": "error",
			"local/no-empty-files": [
				"error",
				{
					allow: ["vite-env.d.ts"],
				},
			],
			"local/feature-naming": "error",
			"local/actions-purity": "error",
			// P1: webview has ONE outbound channel — events/actions/send*.ts creators.
			"local/no-direct-ipc": "error", // User doctrine: ONE sanctioned way to reach a store — the global root
			// accessor / getRoot/getParent. No direct VALUE imports of store modules
			// (models, actions, events). Type-only + store-to-store composition exempt.
			"local/no-direct-store-import": [
				"error",
				{
					// Documented exceptions to the root-accessor doctrine. Each is a
					// store that legitimately has NO root-store child, so a direct
					// model import is the only access path:
					allowedPaths: [
						// Component-local transient store: SettingsSearchStoreModel is
						// created per-component via useRef (use-search.ts) — no shared
						// singleton, not bridge-hydrated, not a root child.
						"@src/features/settings/search/store",
					],
				},
			],
			// Duplicated LOGIC (not just names) between sibling files is a smell:
			// extract a shared helper (actions/events/handlers/store).
			"local/no-duplicated-logic": "error",
			// A *-utils.ts file must be a pure helper: no async exports, no
			// store/env/provider access, no handler-shaped names. If it has any
			// of those, it is NOT a util — it is a misplaced handler/action.
			// The rule is fully generic; `debt` grandfatheres pre-existing
			// violations (see debt/impure-utils-debt.js) so the build stays
			// green while they are migrated. The ledger must shrink to [].
			"local/no-impure-utils": ["error", { debt: impureUtilsDebt }],
			// Empty catch blocks and no-op exported functions are dead code /
			// swallowed errors. Either handle the failure or don't catch.
			// Fully generic; `debt` grandfatheres pre-existing violations
			// (see debt/empty-handlers-debt.js). The ledger must shrink to [].
			"local/no-empty-handlers": ["error", { debt: emptyHandlersDebt }],
			// P10: one handler file registers ONE intent — the filename IS the event.
			// Test files are exempt: `registry.register(...)` in a test body is not an
			// intent registration (it is fixture setup), so the monolith heuristic does
			// not apply to specs.
			"local/no-monolithic-registration": [
				"error",
				{
					maxRegistrations: 1,
					excludePaths: [".test.", ".spec."],
				},
			],
			// P18: the ACTION, not the length — no deep VALUE imports into a
			// feature's internals. Store targets → getRoot/getParent; shadow →
			// migrate; other → the feature's barrel. Type-only imports exempt.
			"local/no-deep-feature-import": [
				"error",
				{
					allowedPaths: ["@features/intents/bus"],
				},
			],
			// P4: ALL state in MST — no module-level shadow stores (let/var, EventEmitter, pubsub bypass).
			// `exemptions` is an EXPLICIT allowlist of sanctioned root-store holders (doctrine: the
			// root of the MST tree cannot live inside the tree — the only legitimate module-level
			// store at runtime is the root holder). Shape-matching is deliberately NOT used.
			"local/no-shadow-store": [
				"error",
				{
					includes: ["backend/", "frontend/src/", "apps/cli/"],
					// Host-neutral transport seams: Node EventEmitter / pub-sub used as a
					// transport boundary (vscode<->webview, server<->WS) rather than feature state.
					// The v2 doctrine (state in MST) does not apply to transport plumbing, so these
					// are exempted by path — they are NOT feature stores.
					excludePaths: [
						".test.",
						".spec.",
						"__mocks__",
						"dist/",
						"connectors/",
						// pub/sub capability (plan §4.3): the backend event-transport seam
						"capabilities/pubsub.ts",
						"capabilities/notifications.ts",
						// code-index host-neutral file watchers / state-manager emitters
						"services/code-index/processors/file-watcher/main.ts",
						"services/code-index/state-manager.ts",
						// terminal stream helper (vsce shell-integration emitter)
						"integrations/terminal/stream-helpers.ts",
						// Host-neutral event emitter (D4g-2): a transport primitive mirroring
						// vscode.EventEmitter (event/fire/dispose) used by code-index + file
						// watchers. Its `listeners` Set is transport state, not feature state —
						// the same category as capabilities/pubsub.ts above. (reviewed 2026)
						"features/foundation/events/event-emitter.ts",
						// Terminal integration: EventEmitter-subclassed child-process / shell
						// wrappers. Per-instance state (process handle, hot timer, output
						// buffer) is bound to a live OS process, not feature state. The
						// no-classes config comment already names "terminal process wrappers"
						// as reviewed survivors. (reviewed 2026)
						"integrations/terminal/",
						// WorkspaceTracker: per-provider integration (WeakRef<ProviderHandle>,
						// file-watch disposables, debounce timers). State is bound to a live
						// provider lifecycle, not feature state. (reviewed 2026)
						"integrations/workspace/WorkspaceTracker.ts",
						// Checkpoint services: EventEmitter-subclassed git wrappers. Per-task
						// state (checkpoints list, base hash, simple-git handle) is bound to a
						// live git repo, not feature state. (reviewed 2026)
						"services/checkpoints/",
					],
					exemptions: [
						// MST root holder — backend
						"backend/features/singleton.ts",
						// MST root holder — frontend (live root singleton)
						"frontend/src/features/root-store/bootstrap/singleton.ts",
						// MobX root holders — CLI (no MST runtime in the CLI)
						"apps/cli/src/ui/store.ts",
						"apps/cli/src/ui/hooks/ui/useToast.ts",
						// Connector bus singleton (plan §4.5): the sanctioned
						// IConnectorEventBus holder — lazy-init + singleton by design,
						// NOT feature state. The bus itself is a sanctioned channel.
						// (reviewed 2026)
						"frontend/src/connector-bus.ts",
						// Shiki highlighter instance cache: one expensive async
						// singleton (instance + loadedLanguages + pendingLoads) bound
						// to the webview lifecycle, not feature state. (reviewed 2026)
						"frontend/src/utils/text/highlighter.ts",
						// Nerd Font detection cache: memoized one-shot DOM probe for
						// icon rendering, not feature state. (reviewed 2026)
						"apps/cli/src/ui/components/display/Icon.tsx",
					],
					// "emit" is the MST task model’s own event surface (the store reaction fans out
					// to the sanctioned bus) — not a shadow store, so it is a sanctioned channel.
					sanctionedBusNames: [
						"bus",
						"getConnectorBus",
						"connectorBus",
						"ConnectorBus",
						"intentBus",
						"IntentBus",
						"emit",
						"extensionHostBus",
					],
					// Grandfathered pre-existing shadow stores (see debt/shadow-store-debt.js).
					// The rule stays 100% generic; the ledger must shrink to [].
					debt: shadowStoreDebt,
				},
			],
			// Doctrine (user mandate): no classes — a class is a shadow store wearing
			// a costume. Instance fields are module state that belong in the feature's
			// single MST store; the class is the hidden accessor surface. Flatten to
			// plain module functions + an MST model, or fold into the feature store.
			// Survivors are added to an EXPLICIT allowlist (exemptClassNames /
			// exemptPaths), never silently allowed.
			"local/no-classes": [
				"error",
				{
					includes: ["backend/", "frontend/src/", "apps/cli/"],
					// Composition root + transport seams: host APIs genuinely require
					// classes (EventEmitter subclasses, terminal process wrappers,
					// provider handler hierarchies). These are reviewed survivors —
					// each is a deliberate decision, not a shape match.
					exemptPaths: [
						".test.",
						".spec.",
						"__mocks__",
						"dist/",
						"connectors/",
						// Host-neutral event emitter (D4g-2): a transport primitive
						// mirroring vscode.EventEmitter — the `listeners` Set is
						// transport state, not feature state. (reviewed 2026)
						"features/foundation/events/event-emitter.ts",
						// Terminal integration: EventEmitter-subclassed child-process /
						// shell wrappers whose per-instance state is bound to a live OS
						// process. The config comment above already names "terminal
						// process wrappers" as reviewed survivors. (reviewed 2026)
						"integrations/terminal/",
						// WorkspaceTracker: per-provider integration (WeakRef, file-watch
						// disposables, debounce timers) bound to a live provider lifecycle.
						// (reviewed 2026)
						"integrations/workspace/WorkspaceTracker.ts",
						// Checkpoint services: EventEmitter-subclassed git wrappers whose
						// per-task state is bound to a live git repo. (reviewed 2026)
						"services/checkpoints/",
					],
					// Framework-mandated / host-API classes that cannot be flattened.
					// Keep this list SHORT and deliberate — every entry is debt that
					// someone decided to keep.
					//
					// Error subclasses — the rule's own doc names these as the canonical
					// "genuinely unavoidable" case: a `class X extends Error` is idiomatic
					// TS error typing (the `instanceof` / `name` / stack contract), not a
					// shadow store. All 10 verified `extends Error` (2026-09-15).
					exemptClassNames: [
						"AskIgnoredError",
						"ToolResultIdMismatchError",
						"MissingToolResultError",
						"ShellIntegrationError",
						"ApplyPatchError",
						"ParseError",
						"OpenFileSkipError",
						"OpenAiCodexOAuthTokenError",
						"FileRestrictionError",
						"OrganizationAllowListViolationError",
						// React error boundary: `getDerivedStateFromError` +
						// `componentDidCatch` are class-component-only lifecycle
						// hooks — React has no function-component equivalent for
						// capturing render errors. Framework-mandated. (reviewed 2026)
						"ErrorBoundary",
						// Browser stub for the Node-only `json-stream-stringify`
						// module (aliased in vite.config.ts). Must stay a
						// `new`-able constructor to mirror the real module's
						// `new JsonStreamStringify(...)` API used by safeWriteJson.
						// (reviewed 2026)
						"JsonStreamStringify",
					],
				},
			],
			// Doctrine (user mandate): a feature folder must have a store.ts. A feature
			// either carries state (→ exactly one store.ts, a single MST root store) or
			// it is not a feature (→ break into actions/events/handlers/utilities or
			// delete it, then allowlist it as stateless). An empty store.ts is never the
			// answer; a shadow store must be replaced by a real MST store.ts.
			"local/no-feature-store": [
				"error",
				{
					roots: ["backend/features/", "backend/services/", "frontend/src/features/"],
					// Genuinely stateless features (pure utilities / parsers / I/O
					// wrappers), reviewed and decided. Each entry is a deliberate
					// decision — never a shape match.
					statelessFeatures: [
						// backend/services/* — pure I/O / parser / registry utilities,
						// 0 classes, no module-level mutable state (reviewed 2026-09-14):
						"search", // file-search I/O wrapper (single file-search.ts)
						"glob", // list-files I/O + ignore filtering (const patterns only)
						"jabberwock-config", // config file read/parse (single config.ts)
						"command", // built-in command registry (no runtime state)
						// frontend/src/features/* — namespace aggregator barrels whose
						// state lives in SUB-features (each sub-feature has its own store):
						"api", // barrel only; state in features/api/streaming store
						"diagnostics", // 1-line events barrel
						"foundation", // barrel; state in window-manager store
						"settings", // aggregator; state in features/settings/settings-store/store.ts
						// backend/services/* — stateless by review (2026-09-14, no-feature-store slice):
						"tree-sitter", // pure parsers + query tables, 0 classes, no module state
						"checkpoints", // per-task service factory; live state held in features/chat/task store
						"code-index", // factory-based services; state is closure-local per instance (StateManager), no module state
						"marketplace", // factory-based (MarketplaceManager/RemoteConfigLoader); cache is per-instance, no module state
						"mcp", // config schemas + validation + file I/O; no runtime state
					],
				},
			],
			"local/no-complex-folder-structure": [
				"error",
				{
					maxFilesPerFolder: 7,
					noFolderNameInFilename: true,
					noDuplicateBasenamePrefix: true,
					includes: ["*.ts", "*.tsx"],
					// Ambient type shims (.d.ts) carry no runtime code and are
					// deliberately kept as a flat lookup table (e.g. the v4
					// connectors/web/backend/declarations/ tsc-isolation boundary).
					// Excluding them keeps the structural check focused on
					// implementation files, like the default index.ts/README.md.
					// NOTE: providing this overrides the rule default, so the
					// default entries are re-listed explicitly.
					ignoredFiles: ["index.ts", "index.tsx", "index.js", "README.md", "*.d.ts"],
				},
			],
			"local/no-misplaced-concern": [
				"error",
				{
					includes: ["backend/", "frontend/src/"],
				},
			],
			"local/no-state-outside-mobx": [
				"error",
				{
					includes: ["backend/", "frontend/src/", "apps/cli/"],
					excludedFiles: ["useRootStore\\.ts$", "TerminalSizeContext\\.tsx$", "form\\.tsx$", "context\\.ts$"],
				},
			],
			"eslint-comments/no-restricted-disable": [
				"error",
				"max-lines",
				"@typescript-eslint/no-explicit-any",
				"local/no-passthrough",
				"local/no-reexport",
				"local/no-logic-in-index",
				"local/no-store-outside-store",
				"local/no-dynamic-imports",
				"local/no-complex-folder-structure",
				"local/no-misplaced-concern",
				"local/no-state-outside-mobx",
				"local/no-empty-files",
				"local/feature-naming",
				"local/actions-purity",
				"local/no-direct-ipc",
				"local/no-monolithic-registration",
				"local/no-deep-feature-import",
				"local/no-shadow-store",
				"local/no-duplicated-logic",
				"local/no-classes",
				"local/no-feature-store",
			],
		},
	},
	{
		ignores: ["dist/**", "build/**", "out/**", ".next/**", ".turbo/**", "coverage/**", ".next-evals/**"],
	},
	{
		rules: {
			"no-undef": "off",
			complexity: ["error", 10],
			"max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
			"max-len": [
				"error",
				{
					code: 120,
					tabWidth: 4,
					ignoreUrls: true,
					ignoreStrings: true,
					ignoreTemplateLiterals: true,
					ignoreRegExpLiterals: true,
					ignoreComments: true,
				},
			],
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "error",
		},
	},
	{
		files: ["**/*.spec.ts", "**/*.spec.tsx", "**/__tests__/**"],
		rules: {
			"max-lines": "off",
			"max-len": "off",
		},
	},
	{
		// E2E / integration / acceptance TEST SCRIPTS (not production code):
		// they drive a live app end-to-end, so high complexity in event
		// handlers, long scenario files, sibling case files without an index
		// barrel, and shared fixture helpers across cases are expected.
		// These are not feature folders — the structural rules do not apply.
		files: ["**/scripts/integration/**", "**/acceptance/**"],
		rules: {
			complexity: "off",
			"max-lines": "off",
			"max-len": "off",
			"local/no-complex-folder-structure": "off",
			"local/no-duplicated-logic": "off",
		},
	},
	{
		// The webview outbound channel is a single thin creator per message type,
		// mandated by `local/no-direct-ipc` (callers must go through
		// events/actions/send*.ts creators rather than touching the provider
		// directly). Those creators are, by design, one-line passthroughs of
		// `provider.postMessageToWebview` — so `local/no-passthrough` (which
		// targets redundant wrapper indirection in feature logic) does not apply
		// to them. Exempt the sanctioned creator directories only.
		files: ["**/events/actions/**/*.ts"],
		rules: {
			"local/no-passthrough": "off",
		},
	},
]
