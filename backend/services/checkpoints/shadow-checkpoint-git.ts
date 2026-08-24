import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git"

/**
 * Creates a SimpleGit instance with sanitized environment variables to prevent
 * interference from inherited git environment variables like GIT_DIR and GIT_WORK_TREE.
 */
export function createSanitizedGit(baseDir: string): SimpleGit {
	const sanitizedEnv: Record<string, string> = {}

	for (const [key, value] of Object.entries(process.env)) {
		if (
			key === "GIT_DIR" ||
			key === "GIT_WORK_TREE" ||
			key === "GIT_INDEX_FILE" ||
			key === "GIT_OBJECT_DIRECTORY" ||
			key === "GIT_ALTERNATE_OBJECT_DIRECTORIES" ||
			key === "GIT_CEILING_DIRECTORIES" ||
			key === "GIT_TEMPLATE_DIR"
		) {
			continue
		}
		if (value !== undefined) {
			sanitizedEnv[key] = value
		}
	}

	const options: Partial<SimpleGitOptions> = {
		baseDir,
		config: [],
	}
	const git = simpleGit(options)
	git.env(sanitizedEnv)
	return git
}
