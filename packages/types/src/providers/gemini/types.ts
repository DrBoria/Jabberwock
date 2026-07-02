// https://ai.google.dev/gemini-api/docs/models/gemini
import { geminiModels } from "./models.ts"

export type GeminiModelId = keyof typeof geminiModels

export const geminiDefaultModelId: GeminiModelId = "gemini-3.1-pro-preview"
