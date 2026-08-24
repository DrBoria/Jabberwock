import { t } from "@i18n"

import type { ImageGenerationResponse, ImagesApiResponse, ImageGenerationResult, ImagesApiOptions } from "./types"

export function parseHttpError(errorText: string): string | null {
	if (!errorText) return null

	try {
		const errorJson = JSON.parse(errorText)
		if (errorJson.error?.message) {
			return t("tools:generateImage.failedWithMessage", {
				message: errorJson.error.message,
			})
		}
	} catch {
		// Use default error message
	}

	return null
}

export async function extractErrorMessage(response: Response): Promise<string> {
	const defaultMessage = t("tools:generateImage.failedWithStatus", {
		status: response.status,
		statusText: response.statusText,
	})

	try {
		const errorText = await response.text()
		const parsed = parseHttpError(errorText)
		return parsed || defaultMessage
	} catch {
		return defaultMessage
	}
}

export function buildUserContent(
	prompt: string,
	inputImage?: string,
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
	if (!inputImage) return prompt

	return [
		{ type: "text", text: prompt },
		{ type: "image_url", image_url: { url: inputImage } },
	]
}

export function catchToError(error: unknown): string {
	return error instanceof Error ? error.message : t("tools:generateImage.unknownError")
}

export function getFirstImageData(result: ImageGenerationResponse): string | undefined {
	const images = result.choices?.[0]?.message?.images

	if (!images || images.length === 0) {
		return undefined
	}

	return images[0]?.image_url?.url
}

export function extractImageFromProviderResponse(result: ImageGenerationResponse): ImageGenerationResult {
	if (result.error) {
		return {
			success: false,
			error: t("tools:generateImage.failedWithMessage", { message: result.error.message }),
		}
	}

	const imageData = getFirstImageData(result)

	if (!imageData) {
		return { success: false, error: t("tools:generateImage.noImageGenerated") }
	}

	const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/)

	if (!base64Match) {
		return { success: false, error: t("tools:generateImage.invalidImageFormat") }
	}

	return { success: true, imageData, imageFormat: base64Match[1] }
}

export function buildImagesApiRequestBody(options: ImagesApiOptions): Record<string, unknown> {
	const { model, prompt, size, quality, inputImage, outputFormat } = options
	const body: Record<string, unknown> = { model, prompt, n: 1 }

	if (size) body.size = size
	if (quality) body.quality = quality

	if (model.startsWith("bfl/")) {
		body.providerOptions = {
			blackForestLabs: {
				outputFormat,
				...(inputImage && { inputImage }),
			},
		}
	} else {
		body.output_format = outputFormat
	}

	return body
}

export function processUrlImage(imageItem: { url: string }, outputFormat: string): ImageGenerationResult {
	if (imageItem.url.startsWith("data:image/")) {
		const formatMatch = imageItem.url.match(/^data:image\/(\w+);/)

		return { success: true, imageData: imageItem.url, imageFormat: formatMatch?.[1] || outputFormat }
	}

	return { success: true, imageData: imageItem.url, imageFormat: outputFormat }
}

export function processImagesApiResult(result: ImagesApiResponse, outputFormat: string): ImageGenerationResult {
	if (result.error) {
		return {
			success: false,
			error: t("tools:generateImage.failedWithMessage", { message: result.error.message }),
		}
	}

	const images = result.data

	if (!images || images.length === 0) {
		return { success: false, error: t("tools:generateImage.noImageGenerated") }
	}

	const imageItem = images[0]

	if (imageItem?.b64_json) {
		return {
			success: true,
			imageData: `data:image/${outputFormat};base64,${imageItem.b64_json}`,
			imageFormat: outputFormat,
		}
	}

	if (imageItem?.url) {
		return processUrlImage(imageItem as { url: string }, outputFormat)
	}

	return { success: false, error: t("tools:generateImage.invalidImageData") }
}
