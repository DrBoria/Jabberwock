import { useEffect, useRef } from "react"
import { onSnapshot } from "mobx-state-tree"
import type { ExtensionMessage } from "@jabberwock/types"
import { RouterName } from "@shared/api"
import { routerModelsStore } from "@src/features/settings/models/store"
import type { LiteLLMRefreshStatus } from "./types"

export const useLiteLLMMessageHandler = (
	refreshStatus: LiteLLMRefreshStatus,
	setRefreshStatus: (status: LiteLLMRefreshStatus) => void,
	setRefreshError: (error: string | undefined) => void,
) => {
	const litellmErrorJustReceived = useRef(false)
	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "singleRouterModelFetchResponse" && !message.success) {
				if ((message.values?.provider as RouterName) === "litellm") {
					litellmErrorJustReceived.current = true
					setRefreshStatus("error")
					setRefreshError(message.error)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		const unsubscribe = onSnapshot(routerModelsStore, (snapshot) => {
			if (snapshot.routerModels && refreshStatus === "loading" && !litellmErrorJustReceived.current)
				setRefreshStatus("success")
		})
		return () => {
			window.removeEventListener("message", handleMessage)
			unsubscribe()
		}
	}, [refreshStatus, setRefreshStatus, setRefreshError])
}
