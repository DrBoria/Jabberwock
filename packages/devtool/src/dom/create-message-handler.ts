import type { DomHandlerContext } from "./types.js"
import { createIframeContext, handleDomResponse } from "./iframe.js"
import { handleGetActivePage } from "./handlers/getActivePage.js"
import { actionHandlers } from "./action-handlers.js"
import { createStoreQueryHandlers, type StoreQueryOptions } from "./store-query-handlers.js"

function isValidActionMessage(message: Record<string, unknown>): boolean {
	return message.type === "action" && !!message.requestId
}

function executeHandler(
	ctx: DomHandlerContext,
	handlerMap: Record<string, (ctx: DomHandlerContext, req: Record<string, unknown>) => void | Promise<void>>,
	action: string,
	message: Record<string, unknown>,
	requestId: string,
	count: number,
): void {
	const handler = handlerMap[action]
	if (!handler) {
		console.warn(`[devtool] [DEBUG:DOMHANDLER] #${count} NO HANDLER for action=${action} req=${requestId}`)
		return
	}
	console.log(`[DEBUG:DOMHANDLER] #${count} ROUTING: action=${action} req=${requestId}`)
	try {
		const result = handler(ctx, message)
		if (result instanceof Promise) {
			result.catch((err: unknown) => {
				console.error(`[devtool] [DEBUG:DOMHANDLER] #${count} async handler error for action=${action}:`, err)
				ctx.postMessage({
					type: "domResponse",
					requestId,
					text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
				})
			})
		}
	} catch (err) {
		console.error(`[devtool] [DEBUG:DOMHANDLER] #${count} handler error for action=${action}:`, err)
		ctx.postMessage({
			type: "domResponse",
			requestId,
			text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
		})
	}
}

export function createDomMessageHandler(
	postMessage: (msg: unknown) => void,
	rootStore?: unknown,
	options?: StoreQueryOptions,
): (e: MessageEvent) => void {
	const ctx = createIframeContext(postMessage)

	const handlers = { ...actionHandlers }
	if (rootStore) {
		const storeHandlers = createStoreQueryHandlers(rootStore, options)
		Object.assign(handlers, storeHandlers)
	}

	console.log(
		`[devtool] [DEBUG:DOMHANDLER] createDomMessageHandler: rootStore=${typeof rootStore} keys=${Object.keys(handlers).join(",")}`,
	)

	let msgCount = 0
	return (e: MessageEvent) => {
		const message = e.data as Record<string, unknown>
		msgCount++
		const msgType = message.type as string
		const msgAction = message.action as string
		const msgReqId = message.requestId as string

		if (message.type === "dom-response") {
			console.log(`[DEBUG:DOMHANDLER] #${msgCount} dom-response: req=${msgReqId}`)
			handleDomResponse(ctx, message)
			return
		}

		if (message.type === "action" && message.action === "getActivePage") {
			console.log(`[DEBUG:DOMHANDLER] #${msgCount} getActivePage: req=${msgReqId}`)
			handleGetActivePage(ctx, message)
			return
		}

		if (!isValidActionMessage(message)) {
			if (message.type !== "state" && message.type !== "theme") {
				console.log(
					`[DEBUG:DOMHANDLER] #${msgCount} SKIP (not action or no requestId): type=${msgType} action=${msgAction} req=${msgReqId}`,
				)
			}
			return
		}

		const action = message.action as string
		executeHandler(ctx, handlers, action, message, msgReqId, msgCount)
	}
}
