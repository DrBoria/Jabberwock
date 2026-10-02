/**
 * D51 finding (refactor.md): P1 direct IPC outside action creators.
 *
 * The webview has exactly ONE outbound channel: the action creators in
 * `events/actions/send<EventName>.ts` (v2 plan P1/P2 — EventBridge is the sole
 * IPC, every event goes through an action creator). Calling the raw sender
 * directly — `provider.postMessageToWebview({...})` OR the imported bare
 * `postMessageToWebview({...})` — from a handler/feature file bypasses the
 * action creator and scatters message construction across handlers.
 *
 * The rule reports any call to the raw sender, method-form
 * (`x.postMessageToWebview(...)`) or bare (`postMessageToWebview(...)`),
 * EXCEPT inside the action-creator files and the channel implementation
 * (EventBridge / window-manager store / connector), which are the only code
 * allowed to touch it. Those + tests + devtool mocks are excluded via
 * `excludePaths` (substring match on the file path).
 */

const DEFAULT_EXCLUDE_PATHS = [
	// The EventBridge / connector implementation — this IS the channel.
	"features/foundation/webview/",
	// window-manager/lib holds the postMessageToWebview implementation
	// (lib/messaging.ts) that action creators import from.
	"window-manager/lib/",
	// Action creators are the only code allowed to call the raw sender.
	"/events/actions/",
	// Devtool mock provider.
	"devtool",
	// Tests exercise the channel directly.
	".test.",
	".spec.",
]

/**
 * Whether the file path contains any of the exclude substrings.
 * @param {string} path
 * @param {string[]} excludePaths
 * @returns {boolean}
 */
function isExcluded(path, excludePaths) {
	return excludePaths.some((ex) => path.includes(ex))
}

/** @type {import("eslint").Rule.RuleModule} */
const noDirectIpcRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Ban direct IPC: <provider>.postMessageToWebview() outside action creators (v2 plan P1/P2).",
		},
		schema: [
			{
				type: "object",
				properties: {
					excludePaths: {
						type: "array",
						items: { type: "string" },
						description:
							"Substrings of file paths that are allowed to call the raw sender " +
							"(the bridge implementation, action creators, devtool mocks, tests).",
						default: DEFAULT_EXCLUDE_PATHS,
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			directPostMessage:
				"Direct IPC: '{{call}}' is called outside an action creator. " +
				"v2 plan (architectural-restructure-v2.md, P1/P2): the webview has ONE outbound channel — " +
				"events/actions/send<EventName>.ts action creators. Create (or reuse) the action creator for " +
				"this event and call send<EventName>() instead of the raw provider handle.",
		},
	},
	create(context) {
		const options = context.options[0] ?? {}
		// NOTE: ESLint does NOT apply schema `default` values — always fall back here.
		const excludePaths = options.excludePaths ?? DEFAULT_EXCLUDE_PATHS

		const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/")
		if (isExcluded(filename, excludePaths)) return {}

		/**
		 * @param {import("estree").Node} callee
		 * @returns {boolean} true if the call is to the raw sender (method or bare).
		 */
		function isRawIpcCall(callee) {
			if (callee.type === "Identifier") return callee.name === "postMessageToWebview"
			return (
				callee.type === "MemberExpression" &&
				!callee.computed &&
				callee.property.type === "Identifier" &&
				callee.property.name === "postMessageToWebview"
			)
		}

		return {
			CallExpression(node) {
				if (isRawIpcCall(node.callee)) {
					context.report({
						node,
						messageId: "directPostMessage",
						data: {
							call: context.sourceCode.getText(node.callee),
						},
					})
				}
			},
		}
	},
}

export default noDirectIpcRule
