/**
 * Rule: no-shadow-store
 *
 * v2 plan (architectural-restructure-v2.md) rule #4: "ALL state in MST — zero
 * module-level mutable state. No `let`/`const` mutable variables outside MST
 * stores. State lives in MST models, mutations happen through MST actions."
 *
 * A "shadow store" is any hidden state container that bypasses the single
 * feature `store.ts`: a module-level `let`, a singleton instance held in a
 * module binding with a `getX()`/`setX()` accessor closure, or an EventEmitter
 * / pub-sub that broadcasts state changes around the MST store. The classic
 * chain (the one that produced 1399 "deep import" reports that pointed the
 * wrong way):
 *
 *     getBackendLogger()                    <- exported accessor (closure)
 *       -> getBackendCapabilities()         <- exported accessor (closure)
 *            -> let _capabilities = ...     <- the shadow store (module `let`)
 *
 * The fix is NOT to re-point the import at a barrel and NOT to keep the module
 * `let` with a nicer accessor. The value moves into the feature's single MST
 * `store.ts` (a model on the root store), mutations go through an MST action,
 * and readers read the store. The module binding and its accessor comments
 * are deleted. See plans/refactor.md "Shadow stores (P4)".
 *
 * What this rule reports (each finding is debt — migrate to MST, do NOT
 * `eslint-disable`):
 *   - moduleMutableState   : top-level `let`/`var` (hidden state)
 *   - moduleSingletonRegistry: top-level `const X = new T()` referenced by an
 *                              exported function (registry/singleton shape)
 *   - shadowStoreAccessor  : an exported function that closes over a module
 *                              binding (the `getX()`/`setX()` surface)
 *   - eventEmitterState    : `new EventEmitter(...)` (hidden event state)
 *   - pubsubBypass         : `x.publish(...)` / `x.emit(...)` where `x` is a
 *                              pub-sub / capability bus, NOT the sanctioned
 *                              IntentBus / connector bus
 *
 * Sanctioned channels (NOT reported):
 *   - the IntentBus `bus.publish(...)` / `bus.register(...)` (v2: intents go
 *     through the bus by design)
 *   - the connector IPC seam `getConnectorBus().publish(...)` (v2/v4: the
 *     single outbound IPC channel)
 * The `sanctionedBusNames` option lists the base identifiers that count as
 * sanctioned.
 */

/**
 * Walk every node in the AST, calling `cb` on each.
 * @param {object} node
 * @param {(node: object) => void} cb
 */
function walk(node, cb) {
	if (!node || typeof node.type !== "string") return
	cb(node)
	const keys = Object.keys(node)
	for (let i = 0; i < keys.length; i++) {
		const key = keys[i]
		if (key === "parent") continue
		const child = node[key]
		if (Array.isArray(child)) {
			for (let j = 0; j < child.length; j++) {
				if (child[j] && typeof child[j].type === "string") walk(child[j], cb)
			}
		} else if (child && typeof child.type === "string") {
			walk(child, cb)
		}
	}
}

/**
 * Collect the exported function nodes of a program (direct `export function`
 * and `export const f = function/arrow`). Re-exports (`export { f }`) are not
 * resolved — the definition is caught at its own declaration if exported.
 * @param {object} program
 * @returns {object[]}
 */
function collectExportedFunctions(program) {
	const fns = []
	for (const b of program.body) {
		if (b.type !== "ExportNamedDeclaration" || !b.declaration) continue
		const d = b.declaration
		if (d.type === "FunctionDeclaration") {
			fns.push({ node: d, name: (d.id && d.id.name) || "(anonymous)" })
		} else if (d.type === "VariableDeclaration") {
			for (const dec of d.declarations) {
				const init = dec.init
				if (init && (init.type === "FunctionExpression" || init.type === "ArrowFunctionExpression")) {
					fns.push({
						node: init,
						name: (dec.id && dec.id.type === "Identifier" && dec.id.name) || "(anonymous)",
					})
				}
			}
		}
	}
	return fns
}

/**
 * Collect every Identifier name referenced anywhere inside a function body.
 * @param {object} fnNode
 * @returns {Set<string>}
 */
function referencedIdentifiers(fnNode) {
	const names = new Set()
	walk(fnNode, (n) => {
		if (n.type === "Identifier") names.add(n.name)
	})
	return names
}

/**
 * Does the function body MUTATE the module binding named `name` — either
 * directly (`name = …`) or through a property (`name.prop = …`)?
 *
 * A `const` object literal with no mutation is a plain config constant, not a
 * store. The moment an exported accessor writes through it
 * (`_providerState.provider = provider`) it is mutable state hidden behind a
 * const — the exact shape of the providerRegistry shadow store that
 * `kind !== "const"` used to miss.
 * @param {object} fnNode
 * @param {string} name
 * @returns {boolean}
 */
function mutatesBinding(fnNode, name) {
	let found = false
	walk(fnNode, (n) => {
		if (found || n.type !== "AssignmentExpression") return
		const left = n.left
		if (left.type === "Identifier" && left.name === name) {
			found = true
			return
		}
		if (
			left.type === "MemberExpression" &&
			!left.computed &&
			left.object.type === "Identifier" &&
			left.object.name === name
		) {
			found = true
		}
	})
	return found
}

/**
 * Does the file path match an exemption pattern? A pattern without `*`/`?`
 * is a substring match; otherwise it is a glob (`*` → any run, `?` → one char).
 * @param {string} pattern
 * @param {string} filename
 * @returns {boolean}
 */
function matchesExemption(pattern, filename) {
	if (!pattern.includes("*") && !pattern.includes("?")) return filename.includes(pattern)
	const re =
		"^" +
		pattern
			.split("")
			.map((c) => (c === "*" ? ".*" : c === "?" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
			.join("") +
		"$"
	try {
		return new RegExp(re).test(filename)
	} catch {
		return false
	}
}

import { applyDebt } from "../debt/debt.js"

/** @type {import("eslint").Rule.RuleModule} */
const noShadowStoreRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"BAN shadow stores: module-level mutable state, singleton registries with " +
				"getX()/setX() accessor closures, EventEmitter, and pub-sub .publish/.emit that " +
				"bypass the single feature MST store.ts (v2 rule #4: ALL state in MST).",
		},
		schema: [
			{
				type: "object",
				properties: {
					includes: {
						type: "array",
						items: { type: "string" },
						description: "Path prefixes to check. Default: ['backend/', 'frontend/src/', 'apps/cli/'].",
					},
					excludePaths: {
						type: "array",
						items: { type: "string" },
						description:
							"Substrings of file paths excluded from the check (tests, mocks, dist, connectors = composition root).",
					},
					exemptions: {
						type: "array",
						items: { type: "string" },
						description:
							"EXPLICIT allowlist of sanctioned root-store holders (substring/glob of the file path). " +
							"Doctrine: the root of the MST tree cannot live inside the tree — the only legitimate " +
							"module-level store at runtime is the root holder. Everything else is debt.",
					},
					sanctionedBusPattern: {
						type: "string",
						description:
							"Regex matching identifiers that ARE the transport seam (a bus / emitter / event channel) " +
							"rather than a shadow store. A PATTERN, not a list: a new bus must not require a config " +
							"edit to be recognised.",
					},
					debt: {
						type: "object",
						additionalProperties: { type: "number" },
						description:
							"MACHINE-GENERATED ledger (reports/lint-debt.json): '<file>::<messageId>' → allowed " +
							"count. Never hand-edited, never disables the rule for a whole file, only shrinks.",
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			moduleMutableState:
				"Shadow store: module-level mutable state '{{names}}'. v2 rule #4 — ALL state in MST, zero module-level `let`/`var`. " +
				"Move this into the feature's single store.ts (an MST model on the root store), mutate it through an MST action, and read it from the store. " +
				"Then delete this binding and any accessor that closes over it. A one-shot bootstrap resource (worker pool, DI handle) is still owned by the store or a documented capability slot — never a bare module `let`.",
			moduleSingletonRegistry:
				"Shadow store: singleton '{{name}}' (module-level `const = new …`) with an exported accessor. v2 rule #4 — this is a store in a variable, not in MST. " +
				"Move the instance/state into the feature's single store.ts (MST model) and have readers access it through the store; delete the module binding and the getX()/getInstance() closure.",
			moduleObjectRegistry:
				"Shadow store: object-literal registry '{{name}}' (module-level `const = { … }`) mutated through an exported accessor. v2 rule #4 — a const object with getX()/setX() closures is a store in a variable, not in MST. " +
				"Move the state into the feature's single store.ts (MST model), mutate it through an MST action, and have readers access it through the store; delete the module binding and the accessor closures.",
			shadowStoreAccessor:
				"Shadow store accessor: exported '{{fn}}' closes over hidden module state '{{binding}}' instead of reading the MST store. v2 rule #4 — the accessor is a closure over a shadow store. " +
				"Migrate '{{binding}}' into the feature's store.ts (MST model) and have '{{fn}}' read the store (or fold it into an MST action/view). Delete the module-level holder once migrated.",
			eventEmitterState:
				"Shadow store: `new EventEmitter(...)` is hidden event state that bypasses the MST store. v2 rule #4 — state changes are observed through the store. " +
				"Route this through the MST store (a model + an MST action that updates it) or the sanctioned IntentBus/connector bus. Do not keep a raw EventEmitter as the source of truth.",
			pubsubBypass:
				"Shadow store bypass: '{{target}}.{{method}}(...)' publishes state through a pub-sub / capability bus, bypassing the MST store. v2 rule #4 — state changes flow through the store; the sanctioned channels are the IntentBus and the connector bus only. " +
				"Replace this with an MST action that updates the store (the store reaction fans out to the sanctioned bus), or, if it truly is the transport seam, give it a name that reads as one (bus/emit) — matching `sanctionedBusPattern`.",
			classInstanceState:
				"Shadow store: class '{{name}}' carries instance state (fields {{fields}}). v2 rule #4 — a class with instance fields is a store in a costume: the fields are module state that belong in the feature's single MST store, and the class is the hidden accessor surface around them. " +
				"Replace it: move the state into an MST model on the feature's store.ts (mutate through an MST action, read from the store) and flatten the class to plain module functions or delete it. A class that holds state is a shadow store by definition.",
		},
	},

	create(context) {
		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		const options = context.options[0] ?? {}
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const includes = options.includes ?? ["backend/", "frontend/src/", "apps/cli/"]
		const excludePaths = options.excludePaths ?? [".test.", ".spec.", "__mocks__", "dist/", "connectors/"]
		const exemptions = options.exemptions ?? []
		// Generic debt filter: the rule itself stays total (it evaluates every file and every
		// violation kind); the machine-generated ledger only silences the exact
		// (file, messageId) findings that predate the rule.
		context = applyDebt(context, options.debt)
		// A sanctioned "bus" is recognised by what its NAME MEANS, never by a frozen list of spellings:
		// any identifier that reads as a bus / emitter / event channel is the transport seam (v4 §4.5),
		// not a shadow store. There is deliberately NO list of current names — a new bus must not need
		// a config edit to become legitimate.
		const sanctionedBusPattern = new RegExp(
			options.sanctionedBusPattern ?? "^(get)?[A-Za-z_$]*([Bb]us|[Ee]mit|[Ee]mitters?)$",
		)

		if (!includes.some((p) => filename.includes(p))) return {}
		if (excludePaths.some((ex) => filename.includes(ex))) return {}

		// Sanctioned root-store holders: the root of the MST tree cannot live
		// inside the tree — the ONLY legitimate module-level store at runtime is
		// the root holder itself. This is an explicit allowlist, not a shape match.
		if (exemptions.some((ex) => matchesExemption(ex, filename))) return {}

		return {
			Program(program) {
				// ── Collect module-scope variable bindings (let/var/const) ──
				/** @type {Map<string, { kind: string, isExported: boolean, isNew: boolean, isObjectLiteral: boolean, node: object, id: object }>} */
				const moduleBindings = new Map()
				for (const b of program.body) {
					const vd = b.type === "ExportNamedDeclaration" ? b.declaration : b
					if (!vd || vd.type !== "VariableDeclaration") continue
					const isExported = b.type === "ExportNamedDeclaration"
					for (const dec of vd.declarations) {
						if (!dec.id || dec.id.type !== "Identifier") continue
						const isNew = dec.init && dec.init.type === "NewExpression"
						const isObjectLiteral = dec.init && dec.init.type === "ObjectExpression"
						moduleBindings.set(dec.id.name, {
							kind: vd.kind,
							isExported,
							isNew,
							isObjectLiteral,
							node: vd,
							id: dec.id,
						})
					}
				}

				// ── Collect exported functions + the module bindings they close over ──
				const exportedFns = collectExportedFunctions(program)
				/** @type {Map<object, string>} fnNode -> first referenced module binding name */
				const fnClosures = new Map()
				for (const ef of exportedFns) {
					const refs = referencedIdentifiers(ef.node)
					let hit = null
					for (const [name, binding] of moduleBindings) {
						if (!refs.has(name)) continue
						// Only state-like bindings count: let/var, a singleton
						// const, or a const object literal that an exported
						// function MUTATES (the providerRegistry shape:
						// `const _providerState = { provider, connector }` +
						// `setProvider` writing `_providerState.provider = …`).
						const isMutableObject =
							binding.kind === "const" && binding.isObjectLiteral && mutatesBinding(ef.node, name)
						const isState = binding.kind !== "const" || binding.isNew || isMutableObject
						if (isState) {
							hit = name
							break
						}
					}
					if (hit) fnClosures.set(ef.node, hit)
				}

				// ── Check 1: moduleMutableState (top-level let/var) ─────────
				for (const [name, binding] of moduleBindings) {
					if (binding.kind === "let" || binding.kind === "var") {
						context.report({
							node: binding.id,
							messageId: "moduleMutableState",
							data: { names: name },
						})
					}
				}

				// ── Check 2: moduleSingletonRegistry (const = new …, has exported accessor) ──
				for (const [name, binding] of moduleBindings) {
					if (binding.kind === "const" && binding.isNew) {
						const hasAccessor = [...fnClosures.values()].includes(name)
						if (hasAccessor) {
							context.report({
								node: binding.id,
								messageId: "moduleSingletonRegistry",
								data: { name },
							})
						}
					}
				}

				// ── Check 2b: moduleObjectRegistry (const = { … } mutated by an exported accessor) ──
				// The providerRegistry shape: a const object literal is not state by
				// itself (a config constant is fine), but once an exported accessor
				// writes through it (`_providerState.provider = …`) it is a hidden
				// mutable store — the same debt as `const = new …`, just wearing a
				// const costume.
				for (const [name, binding] of moduleBindings) {
					if (binding.kind !== "const" || !binding.isObjectLiteral) continue
					const accessor = exportedFns.find((ef) => mutatesBinding(ef.node, name))
					if (accessor) {
						context.report({
							node: binding.id,
							messageId: "moduleObjectRegistry",
							data: { name },
						})
					}
				}

				// ── Check 3: shadowStoreAccessor (exported fn closes over module state) ──
				for (const ef of exportedFns) {
					const bindingName = fnClosures.get(ef.node)
					if (bindingName) {
						context.report({
							node: ef.node,
							messageId: "shadowStoreAccessor",
							data: { fn: ef.name, binding: bindingName },
						})
					}
				}

				// ── Check 4: eventEmitterState (new EventEmitter) ────────────
				/**
				 * Check 4 + 5 on every node: `new EventEmitter(...)` and
				 * non-sanctioned `x.publish(...)` / `x.emit(...)` (pub-sub bypass).
				 * @param {object} n
				 */
				function checkEventState(n) {
					if (n.type === "NewExpression") {
						const callee = n.callee
						if (callee && callee.type === "Identifier" && callee.name === "EventEmitter") {
							context.report({ node: n, messageId: "eventEmitterState" })
						}
						return
					}
					if (n.type !== "CallExpression") return
					const callee = n.callee
					// Only non-computed member calls: obj.publish(...) / obj.emit(...).
					if (!callee || callee.type !== "MemberExpression" || callee.computed) return
					const methodNode = callee.property
					if (!methodNode || methodNode.type !== "Identifier") return
					const method = methodNode.name
					if (method !== "publish" && method !== "emit") return
					const recv = callee.object
					if (!recv) return

					// Explicit `.pubsub.` capability access is ALWAYS a bypass,
					// whatever the outer receiver is.
					const isPubsubMember =
						recv.type === "MemberExpression" &&
						!recv.computed &&
						recv.property &&
						recv.property.type === "Identifier" &&
						recv.property.name === "pubsub"
					if (isPubsubMember) {
						context.report({
							node: n,
							messageId: "pubsubBypass",
							data: { target: "capabilities().pubsub", method },
						})
						return
					}

					// Otherwise resolve the receiver's root identifier (or the callee
					// name of a call receiver) and compare against sanctioned buses.
					let root = recv
					while (root.type === "MemberExpression") root = root.object
					let rootName = null
					if (root.type === "Identifier") {
						rootName = root.name
					} else if (root.type === "CallExpression") {
						const rc = root.callee
						if (rc && rc.type === "Identifier") rootName = rc.name
						else if (
							rc &&
							rc.type === "MemberExpression" &&
							rc.property &&
							rc.property.type === "Identifier"
						) {
							rootName = rc.property.name
						}
					}
					if (rootName && !sanctionedBusPattern.test(rootName)) {
						context.report({
							node: n,
							messageId: "pubsubBypass",
							data: { target: rootName, method },
						})
					}
				}
				walk(program, checkEventState)

				// ── Check 6: classInstanceState (a class carrying instance state) ──
				// A class with instance fields is a shadow store wearing a costume:
				// the fields are module state that belong in the feature's MST store,
				// and the class is the hidden accessor surface around them.
				walk(program, (n) => {
					if (n.type !== "ClassDeclaration" && n.type !== "ClassExpression") return
					const name = (n.id && n.id.name) || "(anonymous)"
					const body = n.body
					if (!body || !Array.isArray(body.body)) return
					// Instance state = a field (PropertyDefinition) with an initializer,
					// or a non-constructor method that reads/writes a this.<field> whose
					// field is declared. We flag on any initialized field — an empty
					// `private x` with no initializer and no use is not state.
					const stateFields = []
					for (const member of body.body) {
						if (member.type === "PropertyDefinition") {
							const hasInit = member.value != null
							const isStatic = member.static === true
							const fieldName = member.key && member.key.type === "Identifier" ? member.key.name : null
							if (hasInit && !isStatic && fieldName) stateFields.push(fieldName)
						}
					}
					if (stateFields.length === 0) return
					context.report({
						node: n,
						messageId: "classInstanceState",
						data: { name, fields: stateFields.join(", ") },
					})
				})
			},
		}
	},
}

export default noShadowStoreRule
