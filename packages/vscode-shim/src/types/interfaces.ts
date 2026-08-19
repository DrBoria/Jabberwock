import type { ConfigurationTarget, ExtensionKind, ExtensionMode, FileType } from "./enums.ts"

export type Thenable<T> = Promise<T>

export interface Disposable {
	dispose(): void
}

export interface IUri {
	scheme: string
	authority: string
	path: string
	query: string
	fragment: string
	fsPath: string
	toString(): string
}

export interface IPosition {
	line: number
	character: number
	isEqual(other: IPosition): boolean
	isBefore(other: IPosition): boolean
	isBeforeOrEqual(other: IPosition): boolean
	isAfter(other: IPosition): boolean
	isAfterOrEqual(other: IPosition): boolean
	compareTo(other: IPosition): number
}

export interface IRange {
	start: IPosition
	end: IPosition
	isEmpty: boolean
	isSingleLine: boolean
	contains(positionOrRange: IPosition | IRange): boolean
	isEqual(other: IRange): boolean
	intersection(other: IRange): IRange | undefined
	union(other: IRange): IRange
}

export interface ISelection extends IRange {
	anchor: IPosition
	active: IPosition
	isReversed: boolean
}

export interface TextLine {
	text: string
	range: IRange
	rangeIncludingLineBreak: IRange
	firstNonWhitespaceCharacterIndex: number
	isEmptyOrWhitespace: boolean
}

export interface TextDocument {
	uri: IUri
	fileName: string
	languageId: string
	version: number
	isDirty: boolean
	isClosed: boolean
	lineCount: number
	getText(range?: IRange): string
	lineAt(line: number): TextLine
	offsetAt(position: IPosition): number
	positionAt(offset: number): IPosition
	save(): Thenable<boolean>
	validateRange(range: IRange): IRange
	validatePosition(position: IPosition): IPosition
}

export interface WorkspaceFolder {
	uri: IUri
	name: string
	index: number
}

export interface ConfigurationInspect<T> {
	key: string
	defaultValue?: T
	globalValue?: T
	workspaceValue?: T
	workspaceFolderValue?: T
}

export interface WorkspaceConfiguration {
	get<T>(section: string): T | undefined
	get<T>(section: string, defaultValue: T): T
	has(section: string): boolean
	inspect<T>(section: string): ConfigurationInspect<T> | undefined
	update(section: string, value: unknown, configurationTarget?: ConfigurationTarget): Thenable<void>
}

export interface Memento {
	get<T>(key: string): T | undefined
	get<T>(key: string, defaultValue: T): T
	update(key: string, value: unknown): Thenable<void>
	keys(): readonly string[]
}

export interface SecretStorageChangeEvent {
	key: string
}

export interface SecretStorage {
	get(key: string): Thenable<string | undefined>
	store(key: string, value: string): Thenable<void>
	delete(key: string): Thenable<void>
	onDidChange: Event<SecretStorageChangeEvent>
}

export interface Extension<T> {
	id: string
	extensionUri: IUri
	extensionPath: string
	isActive: boolean
	packageJSON: Record<string, unknown>
	exports: T
	extensionKind: ExtensionKind
	activate(): Thenable<T>
}

export interface ExtensionContext {
	subscriptions: Disposable[]
	workspaceState: Memento
	globalState: Memento & { setKeysForSync(keys: readonly string[]): void }
	secrets: SecretStorage
	extensionUri: IUri
	extensionPath: string
	environmentVariableCollection: Record<string, unknown>
	storageUri: IUri | undefined
	storagePath: string | undefined
	globalStorageUri: IUri
	globalStoragePath: string
	logUri: IUri
	logPath: string
	extensionMode: ExtensionMode
	extension: Extension<unknown> | undefined
}

export type Event<T> = (listener: (e: T) => void, thisArgs?: unknown, disposables?: Disposable[]) => Disposable

export interface CancellationToken {
	isCancellationRequested: boolean
	onCancellationRequested: Event<unknown>
}

export interface FileStat {
	type: FileType
	ctime: number
	mtime: number
	size: number
}

export interface TextEditorOptions {
	tabSize?: number
	insertSpaces?: boolean
	cursorStyle?: number
	lineNumbers?: number
}
