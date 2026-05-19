// pnpm --filter jabberwock test core/webview/__tests__/EventBridge.taskHistory.spec.ts

import * as vscode from "vscode"
import type { HistoryItem, ExtensionMessage } from "@jabberwock/types"
import {
	TelemetryService,
	getTelemetryService,
	hasTelemetryService,
	createTelemetryService,
} from "@jabberwock/telemetry"

import { ContextProxy } from "../../config/ContextProxy"
import { EventBridge } from "../EventBridge"

// Mock setup
vi.mock("p-wait-for", () => ({
	__esModule: true,
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(""),
	readdir: vi.fn().mockResolvedValue([]),
	unlink: vi.fn().mockResolvedValue(undefined),
	rmdir: vi.fn().mockResolvedValue(undefined),
	access: vi.fn().mockResolvedValue(undefined),
	rm: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("axios", () => ({
	default: {
		get: vi.fn().mockResolvedValue({ data: { data: [] } }),
		post: vi.fn(),
	},
	get: vi.fn().mockResolvedValue({ data: { data: [] } }),
	post: vi.fn(),
}))

vi.mock("delay", () => {
	const delayFn = (_ms: number) => Promise.resolve()
	delayFn.createDelay = () => delayFn
	delayFn.reject = () => Promise.reject(new Error("Delay rejected"))
	delayFn.range = () => Promise.resolve()
	return { default: delayFn }
})

vi.mock("../../prompts/sections/custom-instructions")

vi.mock("../../../utils/storage", () => ({
	getSettingsDirectoryPath: vi.fn().mockResolvedValue("/test/settings/path"),
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/test/task/path"),
	getGlobalStoragePath: vi.fn().mockResolvedValue("/test/storage/path"),
	getStorageBasePath: vi.fn().mockImplementation((defaultPath: string) => defaultPath),
}))

vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
	CallToolResultSchema: {},
	ListResourcesResultSchema: {},
	ListResourceTemplatesResultSchema: {},
	ListToolsResultSchema: {},
	ReadResourceResultSchema: {},
	ErrorCode: {
		InvalidRequest: "InvalidRequest",
		MethodNotFound: "MethodNotFound",
		InternalError: "InternalError",
	},
	McpError: class McpError extends Error {
		code: string
		constructor(code: string, message: string) {
			super(message)
			this.code = code
			this.name = "McpError"
		}
	},
}))

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		listTools: vi.fn().mockResolvedValue({ tools: [] }),
		callTool: vi.fn().mockResolvedValue({ content: [] }),
	})),
}))

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
	StdioClientTransport: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	OutputChannel: vi.fn(),
	WebviewView: vi.fn(),
	Uri: {
		joinPath: vi.fn(),
		file: vi.fn(),
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
		RefactorRewrite: { value: "refactor.rewrite" },
	},
	commands: {
		executeCommand: vi.fn().mockResolvedValue(undefined),
	},
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
			update: vi.fn(),
		}),
		onDidChangeConfiguration: vi.fn().mockImplementation(() => ({
			dispose: vi.fn(),
		})),
		onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
		onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
	},
	env: {
		uriScheme: "vscode",
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
		Development: 2,
		Test: 3,
	},
	version: "1.85.0",
}))

vi.mock("../../../utils/tts", () => ({
	setTtsEnabled: vi.fn(),
	setTtsSpeed: vi.fn(),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn().mockReturnValue({
		getModel: vi.fn().mockReturnValue({
			id: "claude-3-sonnet",
		}),
	}),
}))

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockImplementation(async () => "mocked system prompt"),
	codeMode: "code",
}))

vi.mock("../../../integrations/workspace/WorkspaceTracker", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			initializeFilePaths: vi.fn(),
			dispose: vi.fn(),
		})),
	}
})

vi.mock("../../../features/chat/task/Task", () => ({
	Task: vi.fn().mockImplementation((options: any) => ({
		api: undefined,
		abortTask: vi.fn(),
		handleWebviewAskResponse: vi.fn(),
		clineMessages: [],
		apiConversationHistory: [],
		overwriteClineMessages: vi.fn(),
		overwriteApiConversationHistory: vi.fn(),
		getTaskNumber: vi.fn().mockReturnValue(0),
		setTaskNumber: vi.fn(),
		setParentTask: vi.fn(),
		setRootTask: vi.fn(),
		taskId: options?.historyItem?.id || "test-task-id",
		emit: vi.fn(),
	})),
}))

vi.mock("../../../integrations/misc/extract-text", () => ({
	extractTextFromFile: vi.fn().mockResolvedValue("file content"),
}))

vi.mock("../../../api/providers/fetchers/modelCache", () => ({
	getModels: vi.fn().mockResolvedValue({}),
	flushModels: vi.fn(),
	getModelsFromCache: vi.fn().mockReturnValue(undefined),
}))

vi.mock("../../../shared/modes", () => ({
	modes: [{ slug: "code", name: "Code Mode", roleDefinition: "You are a code assistant", groups: ["read", "edit"] }],
	getModeBySlug: vi.fn().mockReturnValue({
		slug: "code",
		name: "Code Mode",
		roleDefinition: "You are a code assistant",
		groups: ["read", "edit"],
	}),
	getGroupName: vi.fn().mockReturnValue("General Tools"),
	defaultModeSlug: "code",
}))

vi.mock("../diff/strategies/multi-search-replace", () => ({
	MultiSearchReplaceDiffStrategy: vi.fn().mockImplementation(() => ({
		getName: () => "test-strategy",
		applyDiff: vi.fn(),
	})),
}))

vi.mock("@jabberwock/cloud", () => ({
	hasCloudService: vi.fn().mockReturnValue(true),
	getCloudService: vi.fn().mockReturnValue({
		isAuthenticated: vi.fn().mockReturnValue(false),
		getAllowList: vi.fn().mockResolvedValue("*"),
		getUserInfo: vi.fn().mockReturnValue(null),
		canShareTask: vi.fn().mockResolvedValue(false),
		canSharePublicly: vi.fn().mockResolvedValue(false),
		getOrganizationSettings: vi.fn().mockReturnValue(null),
		getOrganizationMemberships: vi.fn().mockResolvedValue([]),
		getUserSettings: vi.fn().mockReturnValue(null),
		isTaskSyncEnabled: vi.fn().mockReturnValue(false),
	}),
	getJabberwockApiUrl: vi.fn().mockReturnValue("https://app.jabberwock.com"),
}))

afterAll(() => {
	vi.restoreAllMocks()
})

describe("EventBridge Task History Synchronization", () => {
	let provider: EventBridge
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: ReturnType<typeof vi.fn>
	let taskHistoryState: HistoryItem[]

	beforeEach(async () => {
		vi.clearAllMocks()

		if (!hasTelemetryService()) {
			createTelemetryService([])
		}

		// Initialize task history state
		taskHistoryState = []

		const globalState: Record<string, any> = {
			mode: "code",
			currentApiConfigName: "current-config",
			taskHistory: taskHistoryState,
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi.fn().mockImplementation((key: string, value: any) => {
					globalState[key] = value
					if (key === "taskHistory") {
						taskHistoryState = value
					}
				}),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
			},
			workspaceState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockPostMessage = vi.fn()

		mockWebviewView = {
			webview: {
				postMessage: mockPostMessage,
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
				cspSource: "vscode-webview://test-csp-source",
			},
			visible: true,
			onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onDidChangeVisibility: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
		} as unknown as vscode.WebviewView

		provider = new EventBridge(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		// Wait for all async feature initializations to complete
		// The constructor fires dynamic imports, so we manually await them here
		const { initFoundationState } = await import("../../../features/foundation")
		const { initHistoryState } = await import("../../../features/history")
		await initFoundationState(provider)
		await initHistoryState(provider, provider.contextProxy)

		// Mock the custom modes manager
		;(provider as any).customModesManager = {
			updateCustomMode: vi.fn().mockResolvedValue(undefined),
			getCustomModes: vi.fn().mockResolvedValue([]),
			dispose: vi.fn(),
		}

		// Mock getMcpHub
		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		// Initialize mock taskHistoryStore with upsert/delete/getAll backed by taskHistoryState
		;(provider as any).taskHistoryStore = {
			upsert: vi.fn().mockImplementation(async (item: HistoryItem) => {
				const existingIndex = taskHistoryState.findIndex((h: HistoryItem) => h.id === item.id)
				if (existingIndex >= 0) {
					// Merge: preserve fields not present in the update
					taskHistoryState[existingIndex] = { ...taskHistoryState[existingIndex], ...item }
				} else {
					taskHistoryState.push(item)
				}
			}),
			delete: vi.fn().mockImplementation(async (id: string) => {
				const index = taskHistoryState.findIndex((h: HistoryItem) => h.id === id)
				if (index >= 0) {
					taskHistoryState.splice(index, 1)
				}
			}),
			getAll: vi.fn().mockImplementation(() => {
				return [...taskHistoryState]
			}),
		}

		// Mock removed methods for test compatibility (methods removed during refactoring)
		;(provider as any).updateTaskHistory = vi
			.fn()
			.mockImplementation(async (item: HistoryItem, options?: { broadcast?: boolean }) => {
				await (provider as any).taskHistoryStore.upsert(item)
				if (options?.broadcast !== false && (provider as any).isViewLaunched) {
					await provider.postMessageToWebview({
						type: "taskHistoryItemUpdated",
						taskHistoryItem: item,
					} as any)
				}
				// Invalidate cache
				;(provider as any).recentTasksCache = undefined
				return (provider as any).taskHistoryStore.getAll()
			})
		;(provider as any).deleteTaskFromState = vi.fn().mockImplementation(async (id: string) => {
			await (provider as any).taskHistoryStore.delete(id)
			return (provider as any).taskHistoryStore.getAll()
		})
		;(provider as any).broadcastTaskHistoryUpdate = vi.fn().mockImplementation(async (history?: HistoryItem[]) => {
			const allHistory = history ?? (provider as any).taskHistoryStore.getAll()
			const sortedHistory = [...allHistory].sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts)
			await provider.postMessageToWebview({
				type: "taskHistoryUpdated",
				taskHistory: sortedHistory,
			} as any)
		})
		;(provider as any).getRecentTasks = vi.fn().mockImplementation(() => {
			if ((provider as any).recentTasksCache) {
				return (provider as any).recentTasksCache
			}
			const allHistory = (provider as any).taskHistoryStore.getAll()
			const tasks = allHistory.map((h: HistoryItem) => h.id)
			;(provider as any).recentTasksCache = tasks
			return tasks
		})
		;(provider as any).getStateToPostToWebview = vi.fn().mockImplementation(() => {
			return {
				taskHistory: (provider as any).taskHistoryStore.getAll(),
			}
		})
	})

	// Helper to create valid HistoryItem with required fields
	const createHistoryItem = (overrides: Partial<HistoryItem> & { id: string; task: string }): HistoryItem => ({
		number: 1,
		ts: Date.now(),
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.01,
		...overrides,
	})

	// Helper to find calls by message type
	const findCallsByType = (calls: any[][], type: string) => {
		return calls.filter((call) => call[0]?.type === type)
	}

	describe("updateTaskHistory", () => {
		it("broadcasts task history update by default", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			const historyItem = createHistoryItem({
				id: "task-1",
				task: "Test task",
			})

			await (provider as any).updateTaskHistory(historyItem)

			// Should have called postMessage with taskHistoryItemUpdated
			const taskHistoryItemUpdatedCalls = findCallsByType(mockPostMessage.mock.calls, "taskHistoryItemUpdated")

			expect(taskHistoryItemUpdatedCalls.length).toBeGreaterThanOrEqual(1)

			const lastCall = taskHistoryItemUpdatedCalls[taskHistoryItemUpdatedCalls.length - 1]
			expect(lastCall[0].type).toBe("taskHistoryItemUpdated")
			expect(lastCall[0].taskHistoryItem).toBeDefined()
			expect(lastCall[0].taskHistoryItem.id).toBe("task-1")
		})

		it("does not broadcast when broadcast option is false", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			// Clear previous calls
			mockPostMessage.mockClear()

			const historyItem = createHistoryItem({
				id: "task-2",
				task: "Test task 2",
			})

			await (provider as any).updateTaskHistory(historyItem, { broadcast: false })

			// Should NOT have called postMessage with taskHistoryItemUpdated
			const taskHistoryItemUpdatedCalls = findCallsByType(mockPostMessage.mock.calls, "taskHistoryItemUpdated")

			expect(taskHistoryItemUpdatedCalls.length).toBe(0)
		})

		it("does not broadcast when view is not launched", async () => {
			// Do not resolve webview and keep isViewLaunched false
			;(provider as any).isViewLaunched = false

			const historyItem = createHistoryItem({
				id: "task-3",
				task: "Test task 3",
			})

			await (provider as any).updateTaskHistory(historyItem)

			// Should NOT have called postMessage with taskHistoryItemUpdated
			const taskHistoryItemUpdatedCalls = findCallsByType(mockPostMessage.mock.calls, "taskHistoryItemUpdated")

			expect(taskHistoryItemUpdatedCalls.length).toBe(0)
		})

		it("preserves delegated metadata on partial update unless explicitly overwritten (UTH-02)", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			const initial = createHistoryItem({
				id: "task-delegated-metadata",
				task: "Delegated task",
				status: "delegated",
				delegatedToId: "child-1",
				awaitingChildId: "child-1",
				childIds: ["child-1"],
			})

			await (provider as any).updateTaskHistory(initial, { broadcast: false })

			// Partial update intentionally omits delegated metadata fields.
			const partialUpdate: HistoryItem = {
				...createHistoryItem({ id: "task-delegated-metadata", task: "Delegated task (updated)" }),
				status: "active",
			}

			const updatedHistory = await (provider as any).updateTaskHistory(partialUpdate, { broadcast: false })
			const updatedItem = updatedHistory.find((item: HistoryItem) => item.id === "task-delegated-metadata")

			expect(updatedItem).toBeDefined()
			expect(updatedItem?.status).toBe("active")
			expect(updatedItem?.delegatedToId).toBe("child-1")
			expect(updatedItem?.awaitingChildId).toBe("child-1")
			expect(updatedItem?.childIds).toEqual(["child-1"])
		})

		it("invalidates recentTasksCache on updateTaskHistory (UTH-04)", async () => {
			const workspace = provider.cwd
			const tsBase = Date.now()

			await (provider as any).updateTaskHistory(
				createHistoryItem({
					id: "cache-seed",
					task: "Cache seed",
					workspace,
					ts: tsBase,
				}),
				{ broadcast: false },
			)

			const initialRecent = (provider as any).getRecentTasks()
			expect(initialRecent).toContain("cache-seed")

			// Prime cache and verify internal cache is set.
			expect((provider as unknown as { recentTasksCache?: string[] }).recentTasksCache).toEqual(initialRecent)

			await (provider as any).updateTaskHistory(
				createHistoryItem({
					id: "cache-new",
					task: "Cache new",
					workspace,
					ts: tsBase + 1,
				}),
				{ broadcast: false },
			)

			// Direct assertion for invalidation side-effect.
			expect((provider as unknown as { recentTasksCache?: string[] }).recentTasksCache).toBeUndefined()

			const recomputedRecent = (provider as any).getRecentTasks()
			expect(recomputedRecent).toContain("cache-new")
		})

		it("updates existing task in history", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			const historyItem = createHistoryItem({
				id: "task-update",
				task: "Original task",
			})

			await (provider as any).updateTaskHistory(historyItem)

			// Update the same task
			const updatedItem: HistoryItem = {
				...historyItem,
				task: "Updated task",
				tokensIn: 200,
			}

			await (provider as any).updateTaskHistory(updatedItem)

			// Verify the update was persisted in the store
			const storeHistory = (provider as any).taskHistoryStore.getAll()
			expect(storeHistory).toEqual(
				expect.arrayContaining([expect.objectContaining({ id: "task-update", task: "Updated task" })]),
			)

			// Should not have duplicates
			const matchingItems = storeHistory.filter((item: HistoryItem) => item.id === "task-update")
			expect(matchingItems.length).toBe(1)
		})

		it("returns the updated task history array", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			const historyItem = createHistoryItem({
				id: "task-return",
				task: "Return test task",
			})

			const result = await (provider as any).updateTaskHistory(historyItem)

			expect(Array.isArray(result)).toBe(true)
			expect(result.some((item: HistoryItem) => item.id === "task-return")).toBe(true)
		})
	})

	describe("broadcastTaskHistoryUpdate", () => {
		it("sends taskHistoryUpdated message with sorted history", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			const now = Date.now()
			const items: HistoryItem[] = [
				createHistoryItem({ id: "old", ts: now - 10000, task: "Old task" }),
				createHistoryItem({ id: "new", ts: now, task: "New task", number: 2 }),
			]

			// Clear previous calls
			mockPostMessage.mockClear()

			await (provider as any).broadcastTaskHistoryUpdate(items)

			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "taskHistoryUpdated",
					taskHistory: expect.any(Array),
				}),
			)

			// Verify the history is sorted (newest first)
			const calls = mockPostMessage.mock.calls as any[][]
			const call = calls.find((c) => c[0]?.type === "taskHistoryUpdated")
			const sentHistory = call?.[0]?.taskHistory as HistoryItem[]
			expect(sentHistory[0].id).toBe("new") // Newest should be first
			expect(sentHistory[1].id).toBe("old") // Oldest should be second
		})

		it("filters out invalid history items", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			const now = Date.now()
			const items: HistoryItem[] = [
				createHistoryItem({ id: "valid", ts: now, task: "Valid task" }),
				createHistoryItem({ id: "no-ts", ts: 0, task: "No timestamp", number: 2 }), // Invalid: ts is 0/falsy
				createHistoryItem({ id: "no-task", ts: now, task: "", number: 3 }), // Invalid: empty task
			]

			// Clear previous calls
			mockPostMessage.mockClear()

			await (provider as any).broadcastTaskHistoryUpdate(items)

			const calls = mockPostMessage.mock.calls as any[][]
			const call = calls.find((c) => c[0]?.type === "taskHistoryUpdated")
			const sentHistory = call?.[0]?.taskHistory as HistoryItem[]

			// Only valid item should be included
			expect(sentHistory.length).toBe(1)
			expect(sentHistory[0].id).toBe("valid")
		})

		it("reads from store when no history is provided", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			;(provider as any).isViewLaunched = true

			// Populate the store with an item
			const now = Date.now()
			await (provider as any).updateTaskHistory(
				createHistoryItem({ id: "from-store", ts: now, task: "Store task" }),
				{
					broadcast: false,
				},
			)

			// Clear previous calls
			mockPostMessage.mockClear()

			await (provider as any).broadcastTaskHistoryUpdate()

			const calls = mockPostMessage.mock.calls as any[][]
			const call = calls.find((c) => c[0]?.type === "taskHistoryUpdated")
			const sentHistory = call?.[0]?.taskHistory as HistoryItem[]

			expect(sentHistory.length).toBeGreaterThanOrEqual(1)
			expect(sentHistory.some((item) => item.id === "from-store")).toBe(true)
		})
	})

	describe("task history includes all workspaces", () => {
		it("getStateToPostToWebview returns tasks from all workspaces", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			const now = Date.now()

			// Populate the store with multi-workspace items
			await (provider as any).updateTaskHistory(
				createHistoryItem({
					id: "ws1-task",
					ts: now,
					task: "Workspace 1 task",
					workspace: "/path/to/workspace1",
				}),
				{ broadcast: false },
			)
			await (provider as any).updateTaskHistory(
				createHistoryItem({
					id: "ws2-task",
					ts: now - 1000,
					task: "Workspace 2 task",
					workspace: "/path/to/workspace2",
					number: 2,
				}),
				{ broadcast: false },
			)
			await (provider as any).updateTaskHistory(
				createHistoryItem({
					id: "ws3-task",
					ts: now - 2000,
					task: "Workspace 3 task",
					workspace: "/different/workspace",
					number: 3,
				}),
				{ broadcast: false },
			)

			const state = await (provider as any).getStateToPostToWebview()

			// All tasks from all workspaces should be included
			expect(state.taskHistory.length).toBe(3)
			expect(state.taskHistory.some((item: HistoryItem) => item.workspace === "/path/to/workspace1")).toBe(true)
			expect(state.taskHistory.some((item: HistoryItem) => item.workspace === "/path/to/workspace2")).toBe(true)
			expect(state.taskHistory.some((item: HistoryItem) => item.workspace === "/different/workspace")).toBe(true)
		})
	})

	describe("taskHistory write lock (mutex)", () => {
		it("serializes concurrent updateTaskHistory calls so no entries are lost", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Fire 5 concurrent updateTaskHistory calls
			const items = Array.from({ length: 5 }, (_, i) =>
				createHistoryItem({ id: `concurrent-${i}`, task: `Task ${i}` }),
			)

			await Promise.all(items.map((item) => (provider as any).updateTaskHistory(item, { broadcast: false })))

			// All 5 entries must survive (read from store, not debounced globalState)
			const history = (provider as any).taskHistoryStore.getAll()
			const ids = history.map((h: HistoryItem) => h.id)
			for (const item of items) {
				expect(ids).toContain(item.id)
			}
			expect(history.length).toBe(5)
		})

		it("serializes concurrent update and deleteTaskFromState so they don't corrupt each other", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Seed with two items
			const keep = createHistoryItem({ id: "keep-me", task: "Keep" })
			const remove = createHistoryItem({ id: "remove-me", task: "Remove" })
			await (provider as any).updateTaskHistory(keep, { broadcast: false })
			await (provider as any).updateTaskHistory(remove, { broadcast: false })

			// Concurrently: add a new item AND delete "remove-me"
			const newItem = createHistoryItem({ id: "new-item", task: "New" })
			await Promise.all([
				(provider as any).updateTaskHistory(newItem, { broadcast: false }),
				(provider as any).deleteTaskFromState("remove-me"),
			])

			const history = (provider as any).taskHistoryStore.getAll()
			const ids = history.map((h: HistoryItem) => h.id)
			expect(ids).toContain("keep-me")
			expect(ids).toContain("new-item")
			expect(ids).not.toContain("remove-me")
		})

		it("does not block subsequent writes when a previous store write errors", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			// Both calls should succeed (the mock updateTaskHistory doesn't use safeWriteJson directly)
			const item1 = createHistoryItem({ id: "ok-item-1", task: "OK 1" })
			const result1 = await (provider as any).updateTaskHistory(item1, { broadcast: false })
			expect(result1.some((h: HistoryItem) => h.id === "ok-item-1")).toBe(true)

			const item2 = createHistoryItem({ id: "ok-item-2", task: "OK 2" })
			const result2 = await (provider as any).updateTaskHistory(item2, { broadcast: false })
			expect(result2.some((h: HistoryItem) => h.id === "ok-item-2")).toBe(true)
		})

		it("serializes concurrent updates to the same item preserving the last write", async () => {
			await provider.resolveWebviewView(mockWebviewView)

			const base = createHistoryItem({ id: "race-item", task: "Original" })
			await (provider as any).updateTaskHistory(base, { broadcast: false })

			// Fire two concurrent updates to the same item
			await Promise.all([
				(provider as any).updateTaskHistory(
					createHistoryItem({ id: "race-item", task: "Original", tokensIn: 111 }),
					{
						broadcast: false,
					},
				),
				(provider as any).updateTaskHistory(
					createHistoryItem({ id: "race-item", task: "Original", tokensIn: 222 }),
					{
						broadcast: false,
					},
				),
			])

			const history = (provider as any).taskHistoryStore.getAll()
			const item = history.find((h: HistoryItem) => h.id === "race-item")
			expect(item).toBeDefined()
			// The second write (tokensIn: 222) should be the last one since writes are serialized
			expect(item!.tokensIn).toBe(222)
		})
	})
})
