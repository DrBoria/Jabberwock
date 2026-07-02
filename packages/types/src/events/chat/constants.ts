export const CHAT = {
	// ─── ChatMessagesList ───────────────────────────────────────────────────
	MESSAGES_LIST: {
		ASK_RESPONSE: "askResponse" as const,
		DELETE_MESSAGE: "deleteMessage" as const,
		DELETE_MESSAGE_CONFIRM: "deleteMessageConfirm" as const,
		SUBMIT_EDITED_MESSAGE: "submitEditedMessage" as const,
		EDIT_MESSAGE_CONFIRM: "editMessageConfirm" as const,
		CHAT_TREE_SNAPSHOT: "chatTreeSnapshot" as const,
		CHAT_TREE_PATCH: "chatTreePatch" as const,
		MESSAGE_UPDATED: "messageUpdated" as const,
		SHOW_EDIT_MESSAGE_DIALOG: "showEditMessageDialog" as const,
		SHOW_DELETE_MESSAGE_DIALOG: "showDeleteMessageDialog" as const,
	},

	// ─── ChatNotifications ───────────────────────────────────────────────────
	NOTIFICATIONS: {
		CHECKPOINT_DIFF: "checkpointDiff" as const,
		CHECKPOINT_RESTORE: "checkpointRestore" as const,
		PLAY_SOUND: "playSound" as const,
		PLAY_TTS: "playTts" as const,
		STOP_TTS: "stopTts" as const,
		TTS_ENABLED: "ttsEnabled" as const,
		TTS_SPEED: "ttsSpeed" as const,
		QUEUE_MESSAGE: "queueMessage" as const,
		REMOVE_QUEUED_MESSAGE: "removeQueuedMessage" as const,
		EDIT_QUEUED_MESSAGE: "editQueuedMessage" as const,
		ELICITATION_RESPONSE: "elicitationResponse" as const,
		CANCEL_AUTO_APPROVAL: "cancelAutoApproval" as const,
		LAST_MESSAGE_SEEN: "lastMessageSeen" as const,
		CURRENT_CHECKPOINT_UPDATED: "currentCheckpointUpdated" as const,
		CHECKPOINT_INIT_WARNING: "checkpointInitWarning" as const,
		TTS_START: "ttsStart" as const,
		TTS_STOP: "ttsStop" as const,
		COMMAND_EXECUTION_STATUS: "commandExecutionStatus" as const,
		MCP_EXECUTION_STATUS: "mcpExecutionStatus" as const,
	},

	// ─── ChatTask ───────────────────────────────────────────────────
	TASK: {
		NEW_TASK: "newTask" as const,
		CANCEL_TASK: "cancelTask" as const,
		CLEAR_TASK: "clearTask" as const,
		TASK_SYNC_ENABLED: "taskSyncEnabled" as const,
		CONDENSE_TASK_CONTEXT_REQUEST: "condenseTaskContextRequest" as const,
		WEBVIEW_DID_LAUNCH: "webviewDidLaunch" as const,
		SET_CHAT_BOX_MESSAGE: "setChatBoxMessage" as const,
		ACTION: "action" as const,
		STATE: "state" as const,
		CONDENSE_TASK_CONTEXT_STARTED: "condenseTaskContextStarted" as const,
		CONDENSE_TASK_CONTEXT_RESPONSE: "condenseTaskContextResponse" as const,
		ACCEPT_INPUT: "acceptInput" as const,
		GOAL_ADD: "goalAdd" as const,
		GOAL_REMOVE: "goalRemove" as const,
		GOAL_UPDATE: "goalUpdate" as const,
		GOAL_REORDER: "goalReorder" as const,
	},

	// ─── ChatTextArea ───────────────────────────────────────────────────
	TEXT_AREA: {
		ENHANCE_PROMPT: "enhancePrompt" as const,
		DRAGGED_IMAGES: "draggedImages" as const,
		SELECT_IMAGES: "selectImages" as const,
		SEARCH_FILES: "searchFiles" as const,
		ENHANCED_PROMPT: "enhancedPrompt" as const,
		FILE_SEARCH_RESULTS: "fileSearchResults" as const,
		INSERT_TEXT_INTO_TEXTAREA: "insertTextIntoTextarea" as const,
	},

	// ─── ChatTopic ───────────────────────────────────────────────────
	TOPIC: {
		MODE: "mode" as const,
		REQUEST_COMMANDS: "requestCommands" as const,
		SWITCH_MODE: "switchMode" as const,
		UPDATE_TODO_LIST: "updateTodoList" as const,
		TASK_HISTORY_UPDATED: "taskHistoryUpdated" as const,
		TASK_HISTORY_ITEM_UPDATED: "taskHistoryItemUpdated" as const,
		COMMANDS: "commands" as const,
		MODES: "modes" as const,
	},
} as const
