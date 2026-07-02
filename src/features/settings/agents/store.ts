import { types } from "mobx-state-tree"
import { StoreRefType } from "@features/mst-custom-types"
import type { ModeConfig } from "@jabberwock/types"

// ─── AgentStateModel ────────────────────────────────────────────────────

export const AgentStateModel = types.model("AgentState", {
	pendingEditOp: StoreRefType,
})

// ─── ToolConfig ─────────────────────────────────────────────────────────

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

// ─── AgentProfile ───────────────────────────────────────────────────────

export const AgentProfile = types
	.model("AgentProfile", {
		id: types.identifier,
		name: types.string,
		role: types.string,
		systemPrompt: types.string,
		allowedTools: types.array(types.reference(ToolConfig)),
	})
	.views((self) => ({
		canUseTool(toolId: string): boolean {
			const tool = self.allowedTools.find((t) => t.id === toolId)
			return tool ? tool.isEnabled : false
		},
	}))

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

const defaultAgents: Array<{
	id: string
	name: string
	role: string
	systemPrompt: string
	allowedTools: string[]
}> = [
	{
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
	},
	{
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
	},
	{
		id: "designer",
		name: "Designer",
		role: "UI/UX Engineer",
		systemPrompt: "You are a UI/UX designer. You focus on aesthetics, accessibility, and user experience.",
		allowedTools: ["analyze_image", "read_file", "list_files", "think_tool"],
	},
	{
		id: "ask",
		name: "Ask",
		role: "Knowledge & Research Specialist",
		systemPrompt:
			"You are a knowledgeable technical assistant focused on answering questions and providing information. You analyze code, explain concepts, and research solutions.",
		allowedTools: ["read_file", "search_files", "list_files", "think_tool"],
	},
	{
		id: "debug",
		name: "Debug",
		role: "Debugging Specialist",
		systemPrompt:
			"You are an expert software debugger specializing in systematic problem diagnosis and resolution. You analyze logs, trace issues, and identify root causes.",
		allowedTools: ["read_file", "search_files", "list_files", "execute_command", "think_tool"],
	},
	{
		id: "architect",
		name: "Architect",
		role: "Technical Planner & Designer",
		systemPrompt:
			"You are an experienced technical leader who plans and designs solutions. You gather context, create detailed plans, and design system architecture.",
		allowedTools: ["read_file", "search_files", "list_files", "think_tool"],
	},
]

// ─── AgentStore ─────────────────────────────────────────────────────────

export const AgentStore = types
	.model("AgentStore", {
		tools: types.map(ToolConfig),
		agents: types.map(AgentProfile),
		toolModelRouting: types.map(types.string),
	})
	.views((self) => ({
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
			if (self.tools.size === 0) {
				defaultTools.forEach((t) => self.registerTool(t.id, t.name))
			}

			if (self.agents.size === 0) {
				defaultAgents.forEach((a) => self.registerAgent(a))
			}
		},
	}))

// ─── ModesModel ─────────────────────────────────────────────────────────

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
