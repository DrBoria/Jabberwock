/**
 * Webview event key constants.
 *
 * These keys map 1:1 to the event types sent via EventBridge IPC.
 */
export const WebviewEventKeys = {
	WEBVIEW_IMAGE_OPEN_REQUESTED: "webview.image.open.requested",
	WEBVIEW_IMAGE_SAVE_REQUESTED: "webview.image.save.requested",
	WEBVIEW_FILE_OPEN_REQUESTED: "webview.file.open.requested",
	WEBVIEW_FILE_READ_REQUESTED: "webview.file.read.requested",
	WEBVIEW_MENTION_OPEN_REQUESTED: "webview.mention.open.requested",
	WEBVIEW_EXTERNAL_OPEN_REQUESTED: "webview.external.open.requested",
	WEBVIEW_KEYBOARD_SHORTCUTS_OPEN_REQUESTED: "webview.keyboard.shortcuts.open.requested",
	WEBVIEW_MARKDOWN_PREVIEW_OPEN_REQUESTED: "webview.markdown.preview.open.requested",
	WEBVIEW_ERROR_REPORTED: "webview.error.reported",
	WEBVIEW_LOG_WRITTEN: "webview.log.written",
	WEBVIEW_DEVTOOL_STATUS_CHANGED: "webview.devtool.status.changed",
	WEBVIEW_LOCATOR_TARGET_SET: "webview.locator.target.set",
	WEBVIEW_DOM_RESPONSE_SENT: "webview.dom.response.sent",
} as const

export type WebviewEventKeys = (typeof WebviewEventKeys)[keyof typeof WebviewEventKeys]
