import React, { createContext, useContext } from "react"
import { chatUIStore, IChatUIStore } from "../state/ChatUIStore"

export const ChatUIContext = createContext<IChatUIStore | undefined>(undefined)

export const ChatUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	return <ChatUIContext.Provider value={chatUIStore}>{children}</ChatUIContext.Provider>
}

export const useChatUI = (): IChatUIStore => {
	const context = useContext(ChatUIContext)
	if (context === undefined) {
		throw new Error("useChatUI must be used within a ChatUIProvider")
	}
	return context
}
