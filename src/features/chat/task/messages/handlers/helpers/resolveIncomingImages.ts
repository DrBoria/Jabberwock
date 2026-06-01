import type { ITaskModel } from "../../../../task/store"
import { resolveImageMentions } from "../../actions/resolveImageMentions"

/**
 * Resolves image file mentions in incoming messages.
 * Matches read_file behavior: respects size limits and model capabilities.
 */
export async function resolveIncomingImages(
	payload: { text?: string; images?: string[] },
	store: ITaskModel,
	maxImageFileSize: number,
	maxTotalImageSize: number,
) {
	const text = payload.text ?? ""
	const images = payload.images
	const resolved = await resolveImageMentions({
		text,
		images,
		cwd: store.cwd,
		jabberwockIgnoreController: store.jabberwockIgnoreController,
		maxImageFileSize,
		maxTotalImageSize,
	})
	return resolved
}
