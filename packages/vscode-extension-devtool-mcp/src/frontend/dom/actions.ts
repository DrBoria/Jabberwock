import type { DomHandlerContext } from "./types.js"
import { handleFindElement } from "./findElement/index.js"
import { handleRunCommand } from "./runCommand.js"
import { handleClickElement } from "./events/click.js"
import { handleTypeText } from "./events/type.js"
import { handleScrollElement } from "./events/scroll.js"
import { handleSelectOption } from "./events/select.js"
import { handleGetScreenshot } from "./screenshot/index.js"
import { handleDragElement, handleDragFromTo } from "./events/drag.js"

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
