import { types, Instance } from "mobx-state-tree"
import type { ModeConfig } from "@jabberwock/types"
import type { EventBridge } from "../../../features/foundation/webview/EventBridge"
import { getState } from "@features/storeSingleton"
import { StoreRefType } from "../../mst-custom-types"

// ─── ModesModel (existing) ─────────────────────────────────────────────

export const ModesModel = types
	.model("Modes", {
		customModes: types.array(types.frozen<ModeConfig>()),
		isLoading: types.optional(types.boolean, false),
		cachedAt: types.optional(types.number, 0),
		filePath: types.optional(types.string, ""),
	})
	.actions((self) => ({
		setCustomModes(modes: ModeConfig[]) {
			self.customModes.replace(modes)
		},
		setLoading(loading: boolean) {
			self.isLoading = loading
		},
		setCachedAt(timestamp: number) {
			self.cachedAt = timestamp
		},
		setFilePath(path: string) {
			self.filePath = path
		},
	}))
	.views((self) => ({
		getCustomModes(): ModeConfig[] {
			return self.customModes
		},
		findMode(slug: string): ModeConfig | undefined {
			return self.customModes.find((m) => m.slug === slug)
		},
		isCacheValid(ttl: number): boolean {
			return self.customModes.length > 0 && Date.now() - self.cachedAt < ttl
		},
	}))

export type IModesModel = Instance<typeof ModesModel>

// Backward-compatible types and functions
export type ModesState = IModesModel

export function initModesState(_provider: EventBridge): void {}

import type { IBackendRootStore } from "../../store"

export function getModesState(rootStore: IBackendRootStore): ModesState {
	return rootStore.settings.modes as ModesState
}

// ─── ToolConfig (merged from chat/state/AgentStore) ────────────────────

/**
 * Tool configuration to enable/disable specific tools globally or per-agent.
 */
export const ToolConfig = types
	.model("ToolConfig", {
		id: types.identifier,
		name: types.string,
		isEnabled: types.boolean,
	})
	.actions((self) => ({
		toggle() {
			self.isEnabled = !self.isEnabled
		},
		setEnabled(enabled: boolean) {
			self.isEnabled = enabled
		},
	}))

// ─── AgentProfile (merged from chat/state/AgentStore) ──────────────────

/**
 * Agent profile definition including role, system prompt, and allowed tools.
 */
export const AgentProfile = types
	.model("AgentProfile", {
		id: types.identifier,
		name: types.string,
		role: types.string,
		systemPrompt: types.string,
		allowedTools: types.array(types.reference(ToolConfig)),
	})
	.views((self) => ({
		/**
		 * Checks if the agent is allowed to use a specific tool.
		 */
		canUseTool(toolId: string): boolean {
			const tool = self.allowedTools.find((t) => t.id === toolId)
			return tool ? tool.isEnabled : false
		},
	}))

// ─── AgentStore (merged from chat/state/AgentStore) ────────────────────

/**
 * Global store for managing all agents and their tool permissions.
 */
export const AgentStore = types
	.model("AgentStore", {
		tools: types.map(ToolConfig),
		agents: types.map(AgentProfile),
		toolModelRouting: types.map(types.string), // Maps toolId to specific modelId
	})
	.views((self) => ({
		/**
		 * Resolves which model to use for a specific tool.
		 * Supports override routing.
		 */
		resolveModelForTool(toolId: string, fallbackModelId: string): string {
			if (self.toolModelRouting.has(toolId)) {
				return self.toolModelRouting.get(toolId)!
			}
			return fallbackModelId
		},
	}))
	.actions((self) => ({
		registerTool(id: string, name: string) {
			if (!self.tools.has(id)) {
				self.tools.put({ id, name, isEnabled: true })
			}
		},
		registerAgent(profile: {
			id: string
			name: string
			role: string
			systemPrompt: string
			allowedTools: string[]
		}) {
			self.agents.put(profile)
		},
		setToolRoute(toolId: string, modelId: string) {
			self.toolModelRouting.set(toolId, modelId)
		},
	}))
	.actions((self) => ({
		afterCreate() {
			// Initialize default tools if empty
			if (self.tools.size === 0) {
				const defaultTools = [
					{ id: "write_to_file", name: "Write to File" },
					{ id: "read_file", name: "Read File" },
					{ id: "list_files", name: "List Files" },
					{ id: "execute_command", name: "Execute Command" },
					{ id: "search_files", name: "Search Files" },
					{ id: "list_code_definition_names", name: "List Code Definitions" },
					{ id: "think_tool", name: "Think (Reasoning)" },
					{ id: "analyze_image", name: "Analyze Image" },
					{ id: "delegate_task", name: "Delegate Task" },
					{ id: "manage_todo_plan", name: "Manage Todo Plan" },
					{ id: "mark_task_async", name: "Mark Task Async" },
				]
				defaultTools.forEach((t) => self.registerTool(t.id, t.name))
			}

			// Initialize default agents if empty
			if (self.agents.size === 0) {
				self.registerAgent({
					id: "orchestrator",
					name: "Orchestrator",
					role: "Coordinator",
					systemPrompt:
						'Your role is to coordinate complex workflows by delegating tasks to specialized agents. You are a COORDINATOR, not an EXECUTOR. You MUST follow these CRITICAL instructions:\n\n[CRITICAL DELEGATION RULES]\n1) BEFORE DOING ANYTHING ELSE, you MUST call the `manage_todo_plan` tool on the `md-todo-mcp` server.\n2) DO NOT use any other tools (especially terminal commands) until you have an approved TODO plan.\n3) You MUST NEVER assign tasks to yourself ("orchestrator"). Every task in the plan MUST be assigned to an existing specialized agent (coder, designer, ask, debug, architect).\n4) You MUST NEVER execute terminal commands yourself. Your only tools for action are delegation tools.\n\nOnce the plan is created and approved:\n1. Use the `delegate_task` tool for each subtask in the approved order.\n2. For tasks marked with `isAsync: true`, use `mark_task_async` first, then delegate and proceed immediately to the next task without waiting.\n3. Provide all necessary context and clear scope for each subtask.\n4. Analyze results and synthesized the final overview for the user.',
					allowedTools: [
						"delegate_task",
						"manage_todo_plan",
						"mark_task_async",
						"read_file",
						"search_files",
						"list_files",
						"think_tool",
					],
				})

				self.registerAgent({
					id: "coder",
					name: "Coder",
					role: "Software Engineer",
					systemPrompt:
						"You are a professional software engineer. You implement features, fix bugs, and refactor code according to requirements.",
					allowedTools: [
						"write_to_file",
						"read_file",
						"list_files",
						"execute_command",
						"search_files",
						"list_code_definition_names",
						"think_tool",
					],
				})

				self.registerAgent({
					id: "designer",
					name: "Designer",
					role: "UI/UX Engineer",
					systemPrompt:
						"You are a UI/UX designer. You focus on aesthetics, accessibility, and user experience.",
					allowedTools: ["analyze_image", "read_file", "list_files", "think_tool"],
				})

				self.registerAgent({
					id: "ask",
					name: "Ask",
					role: "Knowledge & Research Specialist",
					systemPrompt:
						"You are a knowledgeable technical assistant focused on answering questions and providing information. You analyze code, explain concepts, and research solutions.",
					allowedTools: ["read_file", "search_files", "list_files", "think_tool"],
				})

				self.registerAgent({
					id: "debug",
					name: "Debug",
					role: "Debugging Specialist",
					systemPrompt:
						"You are an expert software debugger specializing in systematic problem diagnosis and resolution. You analyze logs, trace issues, and identify root causes.",
					allowedTools: ["read_file", "search_files", "list_files", "execute_command", "think_tool"],
				})

				self.registerAgent({
					id: "architect",
					name: "Architect",
					role: "Technical Planner & Designer",
					systemPrompt:
						"You are an experienced technical leader who plans and designs solutions. You gather context, create detailed plans, and design system architecture.",
					allowedTools: ["read_file", "search_files", "list_files", "think_tool"],
				})
			}
		},
	}))

export type IAgentStore = Instance<typeof AgentStore>
export type IAgentProfile = Instance<typeof AgentProfile>
export type IToolConfig = Instance<typeof ToolConfig>

// Singleton instance for the extension host
export const agentStore = AgentStore.create({
	tools: {},
	agents: {},
	toolModelRouting: {},
})

// ─── AgentStateModel (merged from foundation/agent-state/store) ─────────

export const AgentStateModel = types.model("AgentState", {
	pendingEditOp: StoreRefType,
})

export type IAgentStateModel = Instance<typeof AgentStateModel>

// Backward-compatible types and functions
export interface AgentStateState {
	pendingEditOperation?: { id: string; data: unknown } | null
}

export function initAgentStateState(_provider: EventBridge): void {
	// No-op — state is initialized via MST model defaults
}

export function getAgentStateState(rootStore: IBackendRootStore): AgentStateState {
	// The as cast is required because AgentStateState is a backward-compatible interface
	// that generalizes the MST Instance type. The types are structurally incompatible
	// (ModelInstanceTypeProps wrapping), so a direct assignment fails.
	return rootStore.foundation.agentState as AgentStateState
}
