export interface SearchReplaceParams {
	file_path: string
	old_string: string
	new_string: string
}
export interface ValidationResult {
	relPath: string
}
export interface AccessResult {
	absolutePath: string
	isFileWriteProtected: boolean
}
export interface MatchResult {
	fileContent: string
	newContent: string
}
