import { createCrudStore } from "./crud"
import { toolErrors } from "../schema"

export const toolErrorsStore = createCrudStore(toolErrors)
