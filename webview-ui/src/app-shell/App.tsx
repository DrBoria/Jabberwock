import { useCallback, useEffect, useMemo } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vscode, createDomMessageHandler } from "@jabberwock/devtool/webview"
import type { WebviewMessage } from "@jabberwock/types"
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
	const postMessage = useCallback((msg: unknown) => vscode.postMessage(msg as WebviewMessage), [])
	const store = useMemo(() => createRootStore(), [])
	useEffect(() => {
		store.initMessageListener()
		return () => {
			window.removeEventListener("message", store.handleExtensionMessage)
		}
	}, [store])
	useEffect(() => {
		const h = createDomMessageHandler(postMessage, store, { getActionBuffer: getFrontendActionBuffer })
		window.addEventListener("message", h)
		return () => window.removeEventListener("message", h)
	}, [postMessage, store])
	useEffect(() => {
		const t = setTimeout(() => {
			if (!store.didHydrateState) {
				console.warn("[jabberwock] State not received within 500ms — requesting state from extension host")
				vscode.postMessage({ type: "requestState" })
			}
		}, 500)
		return () => clearTimeout(t)
	}, [store])
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
