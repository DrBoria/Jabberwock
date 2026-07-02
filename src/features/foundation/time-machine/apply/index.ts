/**
 * apply_patch tool module
 *
 * A stripped-down, file-oriented diff format designed to be easy to parse and safe to apply.
 * Based on the Codex apply_patch specification.
 */

export { parsePatch } from "./parser"
export { ParseError } from "./parser.types"
export type { Hunk, UpdateFileChunk, ApplyPatchArgs } from "./parser.types"

export { seekSequence } from "./seek-sequence"

export { applyChunksToContent, processHunk, processAllHunks, ApplyPatchError } from "./apply"
export type { ApplyPatchFileChange } from "./apply"
