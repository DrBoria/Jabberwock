import path from "path"
import * as fs from "fs/promises"
import { t } from "@i18n"
import prettyBytes from "pretty-bytes"

/**
 * Default maximum allowed image file size in bytes (5MB)
 */
export const DEFAULT_MAX_IMAGE_FILE_SIZE_MB = 5

/**
 * Default maximum total memory usage for all images in a single read operation (20MB)
 * This is a cumulative limit - as each image is processed, its size is added to the total.
 * If including another image would exceed this limit, it will be skipped with a notice.
 * Example: With a 20MB limit, reading 3 images of 8MB, 7MB, and 10MB would process
 * the first two (15MB total) but skip the third to stay under the limit.
 */
export const DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB = 20

/**
 * Supported image formats that can be displayed
 */
export const SUPPORTED_IMAGE_FORMATS = [
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".bmp",
	".ico",
	".tiff",
	".tif",
	".avif",
] as const

export const IMAGE_MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".bmp": "image/bmp",
	".ico": "image/x-icon",
	".tiff": "image/tiff",
	".tif": "image/tiff",
	".avif": "image/avif",
}

/**
 * Result of image validation
 */
export interface ImageValidationResult {
	isValid: boolean
	reason?: "size_limit" | "memory_limit" | "unsupported_model"
	notice?: string
	sizeInMB?: number
}

/**
 * Result of image processing
 */
export interface ImageProcessingResult {
	dataUrl: string
	buffer: Buffer
	sizeInKB: number
	sizeInMB: number
	notice: string
}

/**
 * Reads an image file and returns both the data URL and buffer
 */
export async function readImageAsDataUrlWithBuffer(filePath: string): Promise<{ dataUrl: string; buffer: Buffer }> {
	const fileBuffer = await fs.readFile(filePath)
	const base64 = fileBuffer.toString("base64")
	const ext = path.extname(filePath).toLowerCase()

	const mimeType = IMAGE_MIME_TYPES[ext] || "image/png"
	const dataUrl = `data:${mimeType};base64,${base64}`

	return { dataUrl, buffer: fileBuffer }
}

/**
 * Checks if a file extension is a supported image format
 */
export function isSupportedImageFormat(ext: string): boolean {
	const normalizedExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
	return (SUPPORTED_IMAGE_FORMATS as readonly string[]).includes(normalizedExt)
}

/**
 * Tracks memory usage for processed images to prevent exceeding cumulative limits
 */
export class ImageMemoryTracker {
	private totalMemoryUsedMB = 0

	addMemoryUsage(sizeInMB: number): void {
		this.totalMemoryUsedMB += sizeInMB
	}

	getTotalMemoryUsed(): number {
		return this.totalMemoryUsedMB
	}
}

/**
 * Validates whether an image file can be processed based on size limits and model capabilities
 */
export async function validateImageForProcessing(
	filePath: string,
	supportsImages: boolean,
	maxImageFileSize: number,
	maxTotalImageSize: number,
	totalMemoryUsed: number,
): Promise<ImageValidationResult> {
	if (!supportsImages) {
		return { isValid: false, reason: "unsupported_model", notice: "Model does not support image processing" }
	}

	try {
		const stats = await fs.stat(filePath)
		const sizeInMB = stats.size / (1024 * 1024)

		if (sizeInMB > maxImageFileSize) {
			return {
				isValid: false,
				reason: "size_limit",
				notice: `Image is ${prettyBytes(stats.size)}. Maximum allowed: ${maxImageFileSize}MB.`,
				sizeInMB,
			}
		}

		if (totalMemoryUsed + sizeInMB > maxTotalImageSize) {
			return {
				isValid: false,
				reason: "memory_limit",
				notice: `Adding this image (${prettyBytes(stats.size)}) would exceed the total memory limit of ${maxTotalImageSize}MB.`,
				sizeInMB,
			}
		}

		return { isValid: true, sizeInMB }
	} catch {
		return { isValid: false, reason: "size_limit", notice: `File not found: ${filePath}` }
	}
}

/**
 * Processes an image file - reads it and returns the data URL along with size information
 */
export async function processImageFile(filePath: string): Promise<ImageProcessingResult> {
	const { dataUrl, buffer } = await readImageAsDataUrlWithBuffer(filePath)
	const sizeInKB = Math.round(buffer.length / 1024)
	const sizeInMB = sizeInKB / 1024

	const notice = `[Image (${path.extname(filePath).slice(1).toUpperCase()}, ${sizeInKB}KB)]`

	return { dataUrl, buffer, sizeInKB, sizeInMB, notice }
}
