import * as path from "path"

import { mentionRegexGlobal, unescapeSpaces } from "@shared/context/mentions"
import {
	isSupportedImageFormat,
	readImageAsDataUrlWithBuffer,
	validateImageForProcessing,
	ImageMemoryTracker,
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
} from "@features/chat/tools/helpers/generate-image/imageHelpers"
import { validateAccess } from "@utils/ignore"

const MAX_IMAGES_PER_MESSAGE = 20

export interface ResolveImageMentionsOptions {
	text: string
	images?: string[]
	cwd: string
	jabberwockIgnoreController?: string
	/** Whether the current model supports images. Defaults to true. */
	supportsImages?: boolean
	/** Maximum size per image file in MB. Defaults to 5MB. */
	maxImageFileSize?: number
	/** Maximum total size of all images in MB. Defaults to 20MB. */
	maxTotalImageSize?: number
}

export interface ResolveImageMentionsResult {
	text: string
	images: string[]
}

function isPathWithinCwd(absPath: string, cwd: string): boolean {
	const rel = path.relative(cwd, absPath)
	return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
}

function dedupePreserveOrder(values: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const v of values) {
		if (seen.has(v)) continue
		seen.add(v)
		result.push(v)
	}
	return result
}

function extractImageMentions(text: string): string[] {
	const mentions = Array.from(text.matchAll(mentionRegexGlobal))
		.map((m) => m[1])
		.filter(Boolean)

	return mentions.filter((mention) => {
		if (!mention.startsWith("/")) return false
		const relPath = unescapeSpaces(mention.slice(1))
		const ext = path.extname(relPath).toLowerCase()
		return isSupportedImageFormat(ext)
	})
}

async function processSingleImageMention(
	mention: string,
	cwd: string,
	jabberwockIgnoreController: string | undefined,
	supportsImages: boolean,
	maxImageFileSize: number,
	maxTotalImageSize: number,
	imageMemoryTracker: ImageMemoryTracker,
): Promise<string | null> {
	const relPath = unescapeSpaces(mention.slice(1))
	const absPath = path.resolve(cwd, relPath)
	if (!isPathWithinCwd(absPath, cwd)) {
		return null
	}

	if (!validateAccess(jabberwockIgnoreController, relPath, cwd)) {
		return null
	}

	try {
		const validationResult = await validateImageForProcessing(
			absPath,
			supportsImages,
			maxImageFileSize,
			maxTotalImageSize,
			imageMemoryTracker.getTotalMemoryUsed(),
		)

		if (!validationResult.isValid) {
			return null
		}

		const { dataUrl } = await readImageAsDataUrlWithBuffer(absPath)

		if (validationResult.sizeInMB) {
			imageMemoryTracker.addMemoryUsage(validationResult.sizeInMB)
		}

		return dataUrl
	} catch {
		return null
	}
}

export async function resolveImageMentions({
	text,
	images = [],
	cwd,
	jabberwockIgnoreController,
	supportsImages = true,
	maxImageFileSize = DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	maxTotalImageSize = DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
}: ResolveImageMentionsOptions): Promise<ResolveImageMentionsResult> {
	if (images.length >= MAX_IMAGES_PER_MESSAGE) {
		return { text, images: images.slice(0, MAX_IMAGES_PER_MESSAGE) }
	}

	if (!supportsImages) {
		return { text, images }
	}

	const imageMentions = extractImageMentions(text)

	const imageMemoryTracker = new ImageMemoryTracker()
	const newImages: string[] = []

	for (const mention of imageMentions) {
		if (images.length + newImages.length >= MAX_IMAGES_PER_MESSAGE) {
			break
		}

		const dataUrl = await processSingleImageMention(
			mention,
			cwd,
			jabberwockIgnoreController,
			supportsImages,
			maxImageFileSize,
			maxTotalImageSize,
			imageMemoryTracker,
		)

		if (dataUrl) {
			newImages.push(dataUrl)
		}
	}

	const merged = dedupePreserveOrder([...images, ...newImages]).slice(0, MAX_IMAGES_PER_MESSAGE)

	return { text, images: merged }
}
