import { Instance } from "mobx-state-tree"
import { ToolConfig, AgentProfile, AgentStore } from "@features/settings/agents/store"

export { ToolConfig, AgentProfile, AgentStore }
export type IAgentStore = Instance<typeof AgentStore>
export type IAgentProfile = Instance<typeof AgentProfile>
export type IToolConfig = Instance<typeof ToolConfig>

export const agentStore = AgentStore.create({
	tools: {},
	agents: {},
	toolModelRouting: {},
})
