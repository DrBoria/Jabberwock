import { types, Instance } from "mobx-state-tree"

/**
 * Tool configuration to enable/disable specific tools globally or per-agent.
 */
export const ToolConfig = types
	.model("ToolConfig", {
		id: types.identifier,
		name: types.string,
		isEnabled: types.optional(types.boolean, true),
	})
	.actions((self) => ({
		toggle() {
			self.isEnabled = !self.isEnabled
		},
		setEnabled(enabled: boolean) {
			self.isEnabled = enabled
		},
	}))

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
						'Your role is to coordinate complex workflows by delegating tasks to specialized agents. You are a COORDINATOR, not an EXECUTOR. You MUST follow these CRITICAL instructions:\n\n[CRITICAL DELEGATION RULES]\n1) BEFORE DOING ANYTHING ELSE, you MUST call the `manage_todo_plan` tool on the `md-todo-mcp` server.\n2) DO NOT use any other tools (especially terminal commands) until you have an approved TODO plan.\n3) You MUST NEVER assign tasks to yourself ("orchestrator"). Every task in the plan MUST be assigned to an existing specialized agent (coder, designer).\n4) You MUST NEVER execute terminal commands yourself. Your only tools for action are delegation tools.\n\nOnce the plan is created and approved:\n1. Use the `delegate_task` tool for each subtask in the approved order.\n2. Provide all necessary context and clear scope for each subtask.\n3. Analyze results and synthesized the final overview for the user.',
					allowedTools: [
						"delegate_task",
						"manage_todo_plan",
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
