import React, { createContext, useContext, useEffect } from "react"
import { chatTreeStore, ChatStore } from "../state/ChatTreeStore"
import { Instance } from "mobx-state-tree"

type ChatTreeStoreType = Instance<typeof ChatStore>

export const ChatTreeContext = createContext<ChatTreeStoreType | undefined>(undefined)

export const ChatTreeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const store = chatTreeStore

	// In the future we will hook `window.addEventListener("message")` here
	// specifically for `chatTreeSnapshot` events to apply the snapshot to the store.
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "chatTreeSnapshot" && message.snapshot) {
				store.applyTreeSnapshot(message.snapshot)
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [store])

	return <ChatTreeContext.Provider value={store}>{children}</ChatTreeContext.Provider>
}

export const useChatTree = () => {
	const context = useContext(ChatTreeContext)
	if (context === undefined) {
		throw new Error("useChatTree must be used within a ChatTreeProvider")
	}
	return context
}
