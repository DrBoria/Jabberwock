import { useCallback, useEffect, useMemo } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createDomMessageHandler } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
import { getConnectorBus } from "../connector-bus"
import { createRootStore, getFrontendActionBuffer } from "@src/features/root-store"
import { RootStoreContext } from "@src/features/useRootStore"
import { AppContent } from "./app-content"
import ErrorBoundary from "@src/features/foundation/components/ui/layout/ErrorBoundary"
import { TooltipProvider } from "@src/shared/ui/tooltips/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "@src/shared/ui/tooltips/standard-tooltip"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"

const queryClient = new QueryClient()

const AppWithProviders = () => {
	const bus = getConnectorBus()
	const postMessage = useCallback((msg: unknown) => bus.publish(msg as WebviewMessage), [bus])
	const store = useMemo(() => createRootStore(), [])
	useEffect(() => {
		// Root-store handler subscribes through the bus (plan §4.5). The single
		// window listener lives inside the active frontend connector (D1a).
		const d1 = store.initMessageListener(bus)
		return () => d1.dispose()
	}, [bus, store])
	useEffect(() => {
		// DOM-local actions (pushWindow, settingsButtonClicked, ...) and their
		// dom-response replies are dispatched to the DOM message handler. Only
		// these message types are routed here; everything else is handled by the
		// root-store subscription above.
		const h = createDomMessageHandler(postMessage, store, { getActionBuffer: getFrontendActionBuffer })
		// The bus delivers the message object (the connector already unwrapped the
		// DOM MessageEvent). createDomMessageHandler expects a MessageEvent-like
		// shape and reads `.data`, so wrap the message accordingly.
		const d2 = bus.subscribe({ types: ["action", "dom-response"] }, (msg) => h({ data: msg } as MessageEvent))
		return () => d2.dispose()
	}, [bus, postMessage, store])
	useEffect(() => {
		const t = setTimeout(() => {
			if (!store.didHydrateState) {
				console.warn("[jabberwock] State not received within 500ms — requesting state from extension host")
				bus.publish({ type: "requestState" })
			}
		}, 500)
		return () => clearTimeout(t)
	}, [bus, store])
	return (
		<RootStoreContext.Provider value={store}>
			<ErrorBoundary>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
						<DndProvider backend={HTML5Backend}>
							<AppContent />
						</DndProvider>
					</TooltipProvider>
				</QueryClientProvider>
			</ErrorBoundary>
		</RootStoreContext.Provider>
	)
}

export default AppWithProviders
