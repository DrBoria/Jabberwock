import path from "path"
import { virtualWorkspace } from "../fs/VirtualWorkspace"
import { formatResponse } from "../prompts/responses"
import { fileExistsAtPath } from "../../utils/fs"
import { getReadablePath } from "../../utils/path"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { Task } from "../task/Task"
import { buildApiHandler } from "../../api"

export class AnalyzeImageTool extends BaseTool<"analyze_image"> {
	name = "analyze_image" as const

	async execute(params: { path: string; prompt?: string }, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { path: relPath, prompt = "Analyze and describe this image in detail." } = params
		const { pushToolResult, askApproval, handleError } = callbacks

		if (!relPath) {
			task.consecutiveMistakeCount++
			task.recordToolError("analyze_image")
			pushToolResult(await task.sayAndCreateMissingParamError("analyze_image", "path"))
			return
		}

		try {
			const fullPath = path.resolve(task.cwd, relPath)
			let exists = false
			try {
				await virtualWorkspace.stat(fullPath)
				exists = true
			} catch {}

			if (!exists) {
				pushToolResult(formatResponse.toolError(`Image not found: ${getReadablePath(task.cwd, relPath)}`))
				return
			}

			const accessAllowed = task.jabberwockIgnoreController?.validateAccess(relPath)

			if (!accessAllowed) {
				pushToolResult(formatResponse.jabberwockIgnoreError(relPath))
				return
			}

			task.consecutiveMistakeCount = 0

			const approvalMessage = JSON.stringify({
				tool: "analyzeImage",
				path: getReadablePath(task.cwd, relPath),
				content: prompt,
			})

			const didApprove = await askApproval("tool", approvalMessage)

			if (!didApprove) return

			const imageBuffer = await virtualWorkspace.readBuffer(fullPath)
			const imageExtension = path.extname(fullPath).toLowerCase().replace(".", "")
			const supportedFormats = ["png", "jpg", "jpeg", "gif", "webp"]

			if (!supportedFormats.includes(imageExtension)) {
				pushToolResult(formatResponse.toolError(`Unsupported format: ${imageExtension}`))
				return
			}

			const mimeType = imageExtension === "jpg" ? "jpeg" : imageExtension
			const base64Data = imageBuffer.toString("base64")

			const apiConfig = task.apiConfiguration

			if (!apiConfig) {
				pushToolResult(formatResponse.toolError("No API configuration found."))
				return
			}

			const apiHandler = buildApiHandler(apiConfig)
			let resultText = ""

			try {
				const stream = apiHandler.createMessage("You are an expert visual layout and graphic analyzer.", [
					{
						role: "user",
						content: [
							{ type: "text", text: prompt },
							{
								type: "image",
								source: {
									type: "base64",
									media_type: `image/${mimeType}` as
										| "image/jpeg"
										| "image/png"
										| "image/gif"
										| "image/webp",
									data: base64Data,
								},
							},
						],
					},
				])

				for await (const chunk of stream) {
					if (chunk.type === "text") {
						resultText += chunk.text
					}
				}
			} catch (apiError) {
				pushToolResult(
					formatResponse.toolError(
						`API Error analyzing image: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
					),
				)
				return
			}

			if (!resultText) {
				pushToolResult(formatResponse.toolError("Received empty analysis from the model."))
				return
			}

			task.recordToolUsage("analyze_image")
			pushToolResult(`Analysis of ${relPath}:\n\n${resultText}`)
		} catch (error) {
			await handleError("analyzing image", error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"analyze_image">): Promise<void> {
		const relPath = block.params.path
		const prompt = block.params.prompt || ""

		const partialMessage = JSON.stringify({
			tool: "analyzeImage",
			path: relPath ?? "",
			content: prompt,
		})

		await task.ask("tool", partialMessage, block.partial).catch(() => {})
	}
}

export const analyzeImageTool = new AnalyzeImageTool()
