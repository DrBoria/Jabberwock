export enum ConfigurationTarget {
	Global = 1,
	Workspace = 2,
	WorkspaceFolder = 3,
}

export enum ExtensionKind {
	UI = 1,
	Workspace = 2,
}

export enum ExtensionMode {
	Production = 1,
	Development = 2,
	Test = 3,
}

export enum FileType {
	Unknown = 0,
	File = 1,
	Directory = 2,
	SymbolicLink = 64,
}

export enum ViewColumn {
	Active = -1,
	Beside = -2,
	One = 1,
	Two = 2,
	Three = 3,
}

export enum UIKind {
	Desktop = 1,
	Web = 2,
}

export enum EndOfLine {
	LF = 1,
	CRLF = 2,
}

export enum StatusBarAlignment {
	Left = 1,
	Right = 2,
}

export enum DiagnosticSeverity {
	Error = 0,
	Warning = 1,
	Information = 2,
	Hint = 3,
}

export enum DiagnosticTag {
	Unnecessary = 1,
	Deprecated = 2,
}

export enum OverviewRulerLane {
	Left = 1,
	Center = 2,
	Right = 4,
	Full = 7,
}

export enum DecorationRangeBehavior {
	OpenOpen = 0,
	ClosedClosed = 1,
	OpenClosed = 2,
	ClosedOpen = 3,
}

export enum TextEditorRevealType {
	Default = 0,
	InCenter = 1,
	InCenterIfOutsideViewport = 2,
	AtTop = 3,
}
