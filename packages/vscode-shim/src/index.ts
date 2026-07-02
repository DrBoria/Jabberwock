/**
 * @jabberwock/vscode-shim
 *
 * A production-ready VSCode API mock for running VSCode extensions in Node.js CLI applications.
 * This package provides a complete implementation of the VSCode Extension API, allowing you to
 * run VSCode extensions without VSCode installed.
 *
 * @packageDocumentation
 */

// ============================================================================
// Classes
// ============================================================================
export { Position } from "./classes/types/Position.ts"
export { Range } from "./classes/types/Range.ts"
export { Selection } from "./classes/types/Selection.ts"
export { Uri } from "./classes/types/Uri.ts"
export { EventEmitter } from "./classes/events/EventEmitter.ts"
export { TextEdit, WorkspaceEdit } from "./classes/text/TextEdit.ts"
export {
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
} from "./classes/types/Additional.ts"
export { CancellationTokenSource, type CancellationToken } from "./classes/events/CancellationToken.ts"
export { OutputChannel } from "./classes/window/OutputChannel.ts"
export { StatusBarItem } from "./classes/window/StatusBarItem.ts"
export { TextEditorDecorationType } from "./classes/window/TextEditorDecorationType.ts"
export { ExtensionContextImpl as ExtensionContext } from "./context/ExtensionContext.ts"

// ============================================================================
// API Classes
// ============================================================================
export { FileSystemAPI } from "./api/classes/FileSystemAPI.ts"
export {
	MockWorkspaceConfiguration,
	setRuntimeConfig,
	setRuntimeConfigValues,
	clearRuntimeConfig,
} from "./api/classes/WorkspaceConfiguration.ts"
export { WorkspaceAPI } from "./api/classes/WorkspaceAPI.ts"
export { TabGroupsAPI } from "./api/classes/TabGroupsAPI.ts"
export { WindowAPI } from "./api/classes/WindowAPI.ts"
export { CommandsAPI } from "./api/classes/CommandsAPI.ts"
export { createVSCodeAPIMock } from "./api/helpers/create-vscode-api-mock.ts"

// ============================================================================
// Enums
// ============================================================================
export {
	ConfigurationTarget,
	ViewColumn,
	TextEditorRevealType,
	StatusBarAlignment,
	DiagnosticSeverity,
	DiagnosticTag,
	EndOfLine,
	UIKind,
	ExtensionMode,
	ExtensionKind,
	FileType,
	DecorationRangeBehavior,
	OverviewRulerLane,
} from "./types/enums.ts"

// ============================================================================
// Types
// ============================================================================
export type { IdentityInfo, WorkspaceConfiguration, Disposable } from "./interfaces/workspace.ts"
export type { Thenable, Memento, FileStat, TextEditorOptions, ConfigurationInspect } from "./types/interfaces.ts"
export type { TextDocument, TextLine, WorkspaceFolder } from "./interfaces/document.ts"
export type { Terminal } from "./interfaces/terminal.ts"
export type { IExtensionHost, ExtensionHostEventMap, ExtensionHostEventName } from "./interfaces/extension-host.ts"
export type { SecretStorage } from "./vscode.ts"

// ============================================================================
// Utilities
// ============================================================================
export { logs, setLogger, type Logger } from "./utils/logger.ts"
export { VSCodeMockPaths } from "./utils/paths.ts"
export { machineIdSync } from "./utils/machine-id.ts"

// ============================================================================
// Re-export as createVSCodeAPI for simpler API
// ============================================================================
export { createVSCodeAPIMock as createVSCodeAPI } from "./api/helpers/create-vscode-api-mock.ts"
