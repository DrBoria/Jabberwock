/**
 * Type declarations for pdf-parse.
 */
declare module "pdf-parse/lib/pdf-parse" {
	interface PdfResult {
		text: string
		numPages: number
		numrender: number
		info: Record<string, unknown>
		metadata: Record<string, unknown>
		version: string
	}

	interface PdfOptions {
		pagerender?: (page: unknown) => Promise<string>
		max?: number
		version?: "default" | "v1.0.5" | "v1.9.3" | "v2.0.5"
	}

	function pdf(dataBuffer: Buffer, options?: PdfOptions): Promise<PdfResult>
	export = pdf
}
