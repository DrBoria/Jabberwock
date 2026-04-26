/**
 * Paste handling utilities for ChatTextArea.
 * Handles URL paste and image paste from clipboard.
 */

import { MAX_IMAGES_PER_MESSAGE } from "../../ChatView"

const ACCEPTED_IMAGE_TYPES = ["png", "jpeg", "webp"]

/**
 * Checks if a clipboard item is an accepted image type.
 */
export function isAcceptedImage(item: DataTransferItem): boolean {
	const [type, subtype] = item.type.split("/")
	return type === "image" && ACCEPTED_IMAGE_TYPES.includes(subtype)
}

/**
 * Reads an image file from a DataTransferItem and returns a data URL.
 */
export function readImageFromItem(item: DataTransferItem): Promise<string | null> {
	return new Promise<string | null>((resolve) => {
		const blob = item.getAsFile()
		if (!blob) {
			resolve(null)
			return
		}
		const reader = new FileReader()
		reader.onloadend = () => {
			if (reader.error) {
				console.error("Error reading image file", reader.error)
				resolve(null)
			} else {
				resolve(typeof reader.result === "string" ? reader.result : null)
			}
		}
		reader.readAsDataURL(blob)
	})
}

/**
 * Reads an image file from a File object and returns a data URL.
 */
export function readImageFromFile(file: File): Promise<string | null> {
	return new Promise<string | null>((resolve) => {
		const reader = new FileReader()
		reader.onloadend = () => {
			if (reader.error) {
				console.error("Error reading image file", reader.error)
				resolve(null)
			} else {
				resolve(typeof reader.result === "string" ? reader.result : null)
			}
		}
		reader.readAsDataURL(file)
	})
}

/**
 * Processes clipboard items and extracts image data URLs.
 * Returns up to MAX_IMAGES_PER_MESSAGE images.
 */
export async function extractImagesFromClipboard(
	items: DataTransferItemList,
	existingImageCount: number,
): Promise<string[]> {
	const imageItems = Array.from(items).filter(isAcceptedImage)
	if (imageItems.length === 0) return []

	const imagePromises = imageItems.map(readImageFromItem)
	const imageDataArray = await Promise.all(imagePromises)
	const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

	return dataUrls.slice(0, MAX_IMAGES_PER_MESSAGE - existingImageCount)
}

/**
 * Processes dropped files and extracts image data URLs.
 */
export async function extractImagesFromFiles(files: FileList, existingImageCount: number): Promise<string[]> {
	const acceptedTypes = ["png", "jpeg", "webp"]
	const imageFiles = Array.from(files).filter((file) => {
		const [type, subtype] = file.type.split("/")
		return type === "image" && acceptedTypes.includes(subtype)
	})

	if (imageFiles.length === 0) return []

	const imagePromises = imageFiles.map(readImageFromFile)
	const imageDataArray = await Promise.all(imagePromises)
	return imageDataArray
		.filter((dataUrl): dataUrl is string => dataUrl !== null)
		.slice(0, MAX_IMAGES_PER_MESSAGE - existingImageCount)
}
