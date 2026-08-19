export interface DeleteMessageDialogState {
	isOpen: boolean
	messageTs: number
	hasCheckpoint: boolean
}
export interface EditMessageDialogState {
	isOpen: boolean
	messageTs: number
	text: string
	hasCheckpoint: boolean
	images?: string[]
}

export const tabsByMessageAction: Record<string, string | undefined> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	historyButtonClicked: "history",
	marketplaceButtonClicked: "marketplace",
	cloudButtonClicked: "cloud",
}
export const storeQueryActions = [
	"getRootSnapshot",
	"getActionBuffer",
	"applySnapshot",
	"getConsoleLogs",
	"searchConsole",
]
export const domHandlerActions = [
	"getActivePage",
	"findElement",
	"clickElement",
	"typeText",
	"scrollElement",
	"selectOption",
	"getScreenshot",
	"dragElement",
	"dragFromTo",
]
