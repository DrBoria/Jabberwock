import * as path from "path"
import { Parser as ParserT, Language as LanguageT, Query as QueryT } from "web-tree-sitter"
import {
	javascriptQuery,
	typescriptQuery,
	tsxQuery,
	pythonQuery,
	rustQuery,
	goQuery,
	cppQuery,
	cQuery,
	csharpQuery,
	rubyQuery,
	javaQuery,
	phpQuery,
	htmlQuery,
	swiftQuery,
	kotlinQuery,
	cssQuery,
	ocamlQuery,
	solidityQuery,
	tomlQuery,
	vueQuery,
	luaQuery,
	systemrdlQuery,
	tlaPlusQuery,
	zigQuery,
	embeddedTemplateQuery,
	elispQuery,
	elixirQuery,
} from "./queries"

export interface LanguageParser {
	[key: string]: {
		parser: ParserT
		query: QueryT
	}
}

async function loadLanguage(langName: string, sourceDirectory?: string) {
	const baseDir = sourceDirectory || __dirname
	const wasmPath = path.join(baseDir, `tree-sitter-${langName}.wasm`)

	try {
		return await LanguageT.load(wasmPath)
	} catch (error) {
		console.error(
			`[jabberwock] Error loading language: ${wasmPath}: ${error instanceof Error ? error.message : error}`,
		)
		throw error
	}
}

let isParserInitialized = false

/*
Using node bindings for tree-sitter is problematic in vscode extensions 
because of incompatibility with electron. Going the .wasm route has the 
advantage of not having to build for multiple architectures.

We use web-tree-sitter and tree-sitter-wasms which provides auto-updating
prebuilt WASM binaries for tree-sitter's language parsers.

This function loads WASM modules for relevant language parsers based on input files:
1. Extracts unique file extensions
2. Maps extensions to language names
3. Loads corresponding WASM files (containing grammar rules)
4. Uses WASM modules to initialize tree-sitter parsers

This approach optimizes performance by loading only necessary parsers once for all relevant files.

Sources:
- https://github.com/tree-sitter/node-tree-sitter/issues/169
- https://github.com/tree-sitter/node-tree-sitter/issues/168
- https://github.com/Gregoor/tree-sitter-wasms/blob/main/README.md
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/query-test.js
*/
export async function loadRequiredLanguageParsers(filesToParse: string[], sourceDirectory?: string) {
	if (!isParserInitialized) {
		try {
			await ParserT.init()
			isParserInitialized = true
		} catch (error) {
			console.error(`[jabberwock] Error initializing parser: ${error instanceof Error ? error.message : error}`)
			throw error
		}
	}

	const extensionsToLoad = new Set(filesToParse.map((file) => path.extname(file).toLowerCase().slice(1)))
	const parsers: LanguageParser = {}

	type ExtensionConfig = {
		languageName: string
		query: string
		parserKey?: string
	}

	const EXTENSION_MAP: Record<string, ExtensionConfig> = {
		js: { languageName: "javascript", query: javascriptQuery },
		jsx: { languageName: "javascript", query: javascriptQuery },
		ts: { languageName: "typescript", query: typescriptQuery },
		tsx: { languageName: "tsx", query: tsxQuery },
		py: { languageName: "python", query: pythonQuery },
		rs: { languageName: "rust", query: rustQuery },
		go: { languageName: "go", query: goQuery },
		cpp: { languageName: "cpp", query: cppQuery },
		hpp: { languageName: "cpp", query: cppQuery },
		c: { languageName: "c", query: cQuery },
		h: { languageName: "c", query: cQuery },
		cs: { languageName: "c_sharp", query: csharpQuery },
		rb: { languageName: "ruby", query: rubyQuery },
		java: { languageName: "java", query: javaQuery },
		php: { languageName: "php", query: phpQuery },
		swift: { languageName: "swift", query: swiftQuery },
		kt: { languageName: "kotlin", query: kotlinQuery },
		kts: { languageName: "kotlin", query: kotlinQuery },
		css: { languageName: "css", query: cssQuery },
		html: { languageName: "html", query: htmlQuery },
		ml: { languageName: "ocaml", query: ocamlQuery },
		mli: { languageName: "ocaml", query: ocamlQuery },
		scala: { languageName: "scala", query: luaQuery },
		sol: { languageName: "solidity", query: solidityQuery },
		toml: { languageName: "toml", query: tomlQuery },
		vue: { languageName: "vue", query: vueQuery },
		lua: { languageName: "lua", query: luaQuery },
		rdl: { languageName: "systemrdl", query: systemrdlQuery },
		tla: { languageName: "tlaplus", query: tlaPlusQuery },
		zig: { languageName: "zig", query: zigQuery },
		ejs: { languageName: "embedded_template", query: embeddedTemplateQuery, parserKey: "embedded_template" },
		erb: { languageName: "embedded_template", query: embeddedTemplateQuery, parserKey: "embedded_template" },
		el: { languageName: "elisp", query: elispQuery },
		ex: { languageName: "elixir", query: elixirQuery },
		exs: { languageName: "elixir", query: elixirQuery },
	}

	for (const ext of extensionsToLoad) {
		const config = EXTENSION_MAP[ext]
		if (!config) {
			throw new Error(`Unsupported language: ${ext}`)
		}

		const language = await loadLanguage(config.languageName, sourceDirectory)
		const query = new QueryT(language, config.query)
		const parserKey = config.parserKey ?? ext

		const parser = new ParserT()
		parser.setLanguage(language)
		parsers[parserKey] = { parser, query }
	}

	return parsers
}
