import type {
	ImageGenerationOptions,
	ImagesApiOptions,
	ImageGenerationResult,
	ImageGenerationResponse,
	ImagesApiResponse,
} from "./types"
import {
	buildImagesApiRequestBody,
	buildUserContent,
	catchToError,
	extractErrorMessage,
	extractImageFromProviderResponse,
	processImagesApiResult,
} from "./helpers"

/**
 * Shared image generation implementation for OpenRouter and Jabberwock Cloud providers
 */
export async function generateImageWithProvider(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, model, prompt, inputImage } = options

	try {
		const response = await fetch(`${baseURL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/RooVetGit/Jabberwock",
				"X-Title": "Jabberwock",
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: "user",
						content: buildUserContent(prompt, inputImage),
					},
				],
				modalities: ["image", "text"],
			}),
		})

		if (!response.ok) {
			const errorMessage = await extractErrorMessage(response)

			return { success: false, error: errorMessage }
		}

		const result: ImageGenerationResponse = await response.json()

		return extractImageFromProviderResponse(result)
	} catch (error) {
		return { success: false, error: catchToError(error) }
	}
}

/**
 * Generate an image using OpenAI's Images API (/v1/images/generations)
 * Supports BFL models (Flux) with provider-specific options for image editing
 */
export async function generateImageWithImagesApi(options: ImagesApiOptions): Promise<ImageGenerationResult> {
	const { baseURL, authToken, outputFormat = "png" } = options

	try {
		const url = `${baseURL}/images/generations`
		const requestBody = buildImagesApiRequestBody(options)

		const fetchOptions: RequestInit = {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/RooVetGit/Jabberwock",
				"X-Title": "Jabberwock",
			},
			body: JSON.stringify(requestBody),
		}

		const response = await fetch(url, fetchOptions)

		if (!response.ok) {
			const errorMessage = await extractErrorMessage(response)

			return { success: false, error: errorMessage }
		}

		const result: ImagesApiResponse = await response.json()

		return processImagesApiResult(result, outputFormat)
	} catch (error) {
		return { success: false, error: catchToError(error) }
	}
}
