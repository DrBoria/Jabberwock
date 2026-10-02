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
import { debtFor } from "./debt/generated.js"

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
			"local/no-passthrough": ["error", { debt: debtFor("local/no-passthrough") }],
			"local/no-reexport": "error",
			"local/no-logic-in-index": "error",
			"local/no-store-outside-store": "error",
			"local/no-dynamic-imports": "error",
			"local/no-empty-files": [
				"error",
				{
					// PATTERNS, never individual file names: a rule may encode a naming CONVENTION
					// ("ambient declaration files are types-only by construction"), not a single file.
					allow: ["*.d.ts"],
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
			"local/no-impure-utils": ["error", { debt: debtFor("local/no-impure-utils") }],
			// Empty catch blocks and no-op exported functions are dead code /
			// swallowed errors. Either handle the failure or don't catch.
			// Fully generic; `debt` grandfatheres pre-existing violations
			// (see debt/empty-handlers-debt.js). The ledger must shrink to [].
			"local/no-empty-handlers": ["error", { debt: debtFor("local/no-empty-handlers") }],
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
					// A ROLE namespace, not a file: the intent bus is the fiber communication core
					// (v4 ch.5), a cross-cutting seam — never a feature's internal.
					allowedPaths: ["@features/intents/"],
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
						// non-shipping code + the composition root: role patterns, universally true
						".test.",
						".spec.",
						"__mocks__",
						"dist/",
						"connectors/",
						// role - DI capability slot (v4 §4.3): the host transport seam itself
						"capabilities/",
						// role - host-integration adapters (v4 §2.3 L9): per-instance state is
						// bound to a live OS process / editor handle, not to feature state
						"integrations/",
						// role - the host-neutral EventEmitter primitive itself
						"event-emitter.ts",
						// role - checkpoint services wrap a live git repo per task
						"services/checkpoints/",
					],
					exemptions: [
						// role - the MST root holder: the root of the tree cannot live inside the tree
						"singleton.ts",
						// role - the sanctioned connector-bus holder (v4 §4.5)
						"connector-bus.ts",
					],
					// ROLE: the transport seam itself is named by convention (any bus/emitter identifier
					// reads as one) — there is no list of current spellings to keep in sync.
					sanctionedBusPattern: "^(get)?[A-Za-z_$]*([Bb]us|[Ee]mit|[Ee]mitters?)$",
					// Grandfathered pre-existing shadow stores — machine-generated ledger
					// (reports/lint-debt.json), keyed by (file, messageId). Only shrinks.
					debt: debtFor("local/no-shadow-store"),
				},
			],
			// Doctrine (user mandate): no classes — a class is a shadow store wearing
			// a costume. Instance fields are module state that belong in the feature's
			// single MST store; the class is the hidden accessor surface. Flatten to
			// plain module functions + an MST model, or fold into the feature store.
			// Framework-mandated shapes are recognised SEMANTICALLY inside the rule
			// (`extends Error`, a React error boundary) — never by naming classes.
			"local/no-classes": [
				"error",
				{
					includes: ["backend/", "frontend/src/", "apps/cli/"],
					// ROLE patterns only — never individual files. An entry here says "this KIND of
					// file cannot carry feature state by construction"; anything instance-specific
					// belongs in the auto-generated debt ledger, not in a rule option.
					exemptPaths: [
						// non-shipping code by universal convention
						".test.",
						".spec.",
						"__mocks__",
						"dist/",
						// the composition root: host adapters are exempt by definition (v4 §3.1)
						"connectors/",
						// host-integration adapters: per-instance state is bound to a live OS
						// process / editor handle, not to feature state (v4 §2.3 L9)
						"integrations/",
						// role - the host-neutral EventEmitter primitive itself
						"event-emitter.ts",
						// role - checkpoint services wrap a live git repo per task
						"services/checkpoints/",
					],
					// the auto-generated debt filter is applied inside the rule, so the rule
					// itself stays total and the ledger only names (file, messageId) pairs.
					debt: debtFor("local/no-classes"),
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
					// Whether a folder is a "feature" is DERIVED inside the rule from its own contents
					// (does it carry an MST model / module-level state anywhere?) — there is no list of
					// stateless feature names to keep in sync with reality.
					debt: debtFor("local/no-feature-store"),
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
			// ── Escape-hatch ban (doctrine: no suppression; fix the code, don't silence it) ──
			// A bare `/* eslint-disable */` turns off EVERYTHING for the file — including
			// all local architecture rules. That made the whole rule set optional.
			"eslint-comments/no-unlimited-disable": "error",
			// A disable comment that no longer suppresses anything is dead weight that
			// hides whether the underlying violation was fixed.
			"eslint-comments/no-unused-disable": "error",
			// `/* eslint-enable */` re-enabling everything after a rule-scoped disable
			// silently switches rules back on — reject the aggregate form.
			"eslint-comments/no-aggregating-enable": "error",
			"eslint-comments/no-restricted-disable": [
				"error",
				// generic gates
				"max-lines",
				"@typescript-eslint/no-explicit-any",
				"@typescript-eslint/ban-ts-comment",
				// NOTE: `complexity` / `max-len` are deliberately NOT restricted yet —
				// backend/features/api/handlers/request/recover/contextWindow.ts:74 carries
				// one documented `eslint-disable-next-line complexity`. Add them here once
				// that function is split.
				// local architecture gates — every rule registered above MUST be listed
				// here, otherwise it is silently disable-able per file.
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
				"local/no-direct-store-import",
				"local/no-impure-utils",
				"local/no-empty-handlers",
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
