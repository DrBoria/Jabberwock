const DEFAULT_MIN_COMPONENT_LINES_VALUE = 4

const __moduleState = {
	currentMinComponentLines: DEFAULT_MIN_COMPONENT_LINES_VALUE,
}
export function getMinComponentLines(): number {
	return __moduleState.currentMinComponentLines
}

export function setMinComponentLines(value: number): void {
	__moduleState.currentMinComponentLines = value
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
