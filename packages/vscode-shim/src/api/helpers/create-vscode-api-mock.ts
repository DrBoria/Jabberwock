import { machineIdSync } from "../../utils/machine-id.ts"
import { logs } from "../../utils/logger.ts"
import { Uri } from "../../classes/types/Uri.ts"
import { Position } from "../../classes/types/Position.ts"
import { Range } from "../../classes/types/Range.ts"
import { Selection } from "../../classes/types/Selection.ts"
import { EventEmitter } from "../../classes/events/EventEmitter.ts"
import { TextEdit, WorkspaceEdit } from "../../classes/text/TextEdit.ts"
import {
	Location,
	Diagnostic,
	DiagnosticRelatedInformation,
	ThemeColor,
	ThemeIcon,
	CodeActionKind,
	CodeLens,
	LanguageModelTextPart,
	LanguageModelToolCallPart,
	LanguageModelToolResultPart,
	FileSystemError,
} from "../../classes/types/Additional.ts"
import { CancellationTokenSource } from "../../classes/events/CancellationToken.ts"
import { StatusBarItem } from "../../classes/window/StatusBarItem.ts"
import { ExtensionContextImpl } from "../../context/ExtensionContext.ts"
import { WorkspaceAPI } from "../classes/WorkspaceAPI.ts"
import { WindowAPI } from "../classes/WindowAPI.ts"
import { CommandsAPI } from "../classes/CommandsAPI.ts"
import {
	ConfigurationTarget,
	ViewColumn,
	TextEditorRevealType,
	StatusBarAlignment,
	DiagnosticSeverity,
	DiagnosticTag,
	EndOfLine,
	UIKind,
	ExtensionMode,
	FileType,
	DecorationRangeBehavior,
	OverviewRulerLane,
} from "../../types.ts"
import type { IdentityInfo } from "../../interfaces/workspace.ts"
import {
	CancellationTokenClass,
	DisposableClass,
	TabInputText,
	TabInputTextDiff,
	createLanguagesObject,
	createExtensionsObject,
	FileSystemWatcherClass,
	RelativePatternClass,
	UriHandlerClass,
} from "./create-vscode-api-mock-helpers.ts"

const Package = { version: "1.0.0" }

export interface VSCodeAPIMockOptions {
	appRoot?: string
	storageDir?: string
}

export function createVSCodeAPIMock(
	extensionRootPath: string,
	workspacePath: string,
	identity?: IdentityInfo,
	options?: VSCodeAPIMockOptions,
) {
	const context = new ExtensionContextImpl({
		extensionPath: extensionRootPath,
		workspacePath: workspacePath,
		storageDir: options?.storageDir,
	})
	const workspace = new WorkspaceAPI(workspacePath, context)
	const window = new WindowAPI()
	const commands = new CommandsAPI()
	window.setWorkspace(workspace)

	const env = {
		appName: `wrapper|cli|cli|${Package.version}`,
		appRoot: options?.appRoot || import.meta.dirname,
		language: "en",
		machineId: identity?.machineId || machineIdSync(),
		sessionId: identity?.sessionId || "cli-session-id",
		remoteName: undefined,
		shell: process.env.SHELL || "/bin/bash",
		uriScheme: "vscode",
		uiKind: 1,
		openExternal: async (uri: Uri): Promise<boolean> => {
			logs.info(`Would open external URL: ${uri.toString()}`, "VSCode.Env")
			return true
		},
		clipboard: {
			readText: async (): Promise<string> => {
				logs.debug("Clipboard read requested", "VSCode.Clipboard")
				return ""
			},
			writeText: async (text: string): Promise<void> => {
				logs.debug(
					`Clipboard write: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`,
					"VSCode.Clipboard",
				)
			},
		},
	}

	return {
		version: "1.84.0",
		Uri,
		EventEmitter,
		ConfigurationTarget,
		ViewColumn,
		TextEditorRevealType,
		StatusBarAlignment,
		DiagnosticSeverity,
		DiagnosticTag,
		Position,
		Range,
		Selection,
		Location,
		Diagnostic,
		DiagnosticRelatedInformation,
		TextEdit,
		WorkspaceEdit,
		EndOfLine,
		UIKind,
		ExtensionMode,
		CodeActionKind,
		ThemeColor,
		ThemeIcon,
		DecorationRangeBehavior,
		OverviewRulerLane,
		StatusBarItem,
		CancellationToken: CancellationTokenClass,
		CancellationTokenSource,
		CodeLens,
		LanguageModelTextPart,
		LanguageModelToolCallPart,
		LanguageModelToolResultPart,
		ExtensionContext: ExtensionContextImpl,
		FileType,
		FileSystemError,
		Disposable: DisposableClass,
		TabInputText,
		TabInputTextDiff,
		workspace,
		window,
		commands,
		env,
		context,
		languages: createLanguagesObject(),
		debug: {
			onDidStartDebugSession: () => ({ dispose: () => {} }),
			onDidTerminateDebugSession: () => ({ dispose: () => {} }),
		},
		tasks: {
			onDidStartTask: () => ({ dispose: () => {} }),
			onDidEndTask: () => ({ dispose: () => {} }),
		},
		extensions: createExtensionsObject(context),
		FileSystemWatcher: FileSystemWatcherClass,
		RelativePattern: RelativePatternClass,
		ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
		UriHandler: UriHandlerClass,
	}
}
