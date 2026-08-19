import type { DomHandlerContext } from "./types.js"
import { handleFindElement } from "./handlers/finding/findElement.js"
import { handleRunCommand } from "./handlers/runCommand.js"
import { handleClickElement } from "./handlers/interaction/clickElement.js"
import { handleTypeText } from "./handlers/interaction/typeText.js"
import { handleScrollElement } from "./handlers/interaction/scrollElement.js"
import { handleSelectOption } from "./handlers/interaction/selectOption.js"
import { handleGetScreenshot } from "./handlers/getScreenshot.js"
import { handleDragElement, handleDragFromTo } from "./handlers/interaction/drag.js"

/**
 * Map of action names to handler functions.
 *
 * Each handler receives a DomHandlerContext and the raw message payload,
 * and is responsible for calling ctx.postMessage with the result.
 */
export const actionHandlers: Record<
	string,
	(ctx: DomHandlerContext, req: Record<string, unknown>) => void | Promise<void>
> = {
	findElement: handleFindElement,
	runCommand: handleRunCommand,
	clickElement: handleClickElement,
	typeText: handleTypeText,
	scrollElement: handleScrollElement,
	selectOption: handleSelectOption,
	getScreenshot: handleGetScreenshot,
	dragElement: handleDragElement,
	dragFromTo: handleDragFromTo,
}
