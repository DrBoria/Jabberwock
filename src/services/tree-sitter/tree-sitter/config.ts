const DEFAULT_MIN_COMPONENT_LINES_VALUE = 4

let currentMinComponentLines = DEFAULT_MIN_COMPONENT_LINES_VALUE

export function getMinComponentLines(): number {
	return currentMinComponentLines
}

export function setMinComponentLines(value: number): void {
	currentMinComponentLines = value
}

export const extensions = [
	"tla",
	"js",
	"jsx",
	"ts",
	"vue",
	"tsx",
	"py",
	"rs",
	"go",
	"c",
	"h",
	"cpp",
	"hpp",
	"cs",
	"rb",
	"java",
	"php",
	"swift",
	"sol",
	"kt",
	"kts",
	"ex",
	"exs",
	"el",
	"html",
	"htm",
	"md",
	"markdown",
	"json",
	"css",
	"rdl",
	"ml",
	"mli",
	"lua",
	"scala",
	"toml",
	"zig",
	"elm",
	"ejs",
	"erb",
	"vb",
].map((e) => `.${e}`)
