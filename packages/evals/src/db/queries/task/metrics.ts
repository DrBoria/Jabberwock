import { createCrudStore } from "../crud"
import { taskMetrics } from "../../schema"

export const taskMetricsStore = createCrudStore(taskMetrics)
