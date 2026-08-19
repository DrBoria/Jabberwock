/**
 * Browser stub for json-stream-stringify.
 *
 * json-stream-stringify is a Node-only module that uses stream.Readable.
 * It's only used by safeWriteJson (file writing utility), which should never
 * actually execute in the webview context. This stub exists solely to satisfy
 * Vite's module resolution when safeWriteJson is transitively included through
 * the @utils/io barrel export.
 */

export class JsonStreamStringify {
	constructor(_value: unknown, _replacer?: unknown, _spaces?: unknown) {}
}
