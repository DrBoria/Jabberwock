# Chat Tools Helpers Restructure Plan

## Current State: 30 Files in a Flat Folder

The folder [`src/features/chat/tools/helpers/`](src/features/chat/tools/helpers) contains 30 files across multiple tool domains, all at the same level. Two files are pure barrel/re-export wrappers. Several files have duplicate utility functions.

## File Inventory

### executeCommand Group (7 files — 6 real + 1 barrel)

| File                                                                                       | Purpose                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [`executeCommandHelpers.ts`](src/features/chat/tools/helpers/executeCommandHelpers.ts)     | **BARREL** — re-exports from 5 sibling files                                                                             |
| [`executeCommandState.ts`](src/features/chat/tools/helpers/executeCommandState.ts)         | `CommandOutputState` interface, `ShellIntegrationError` class, state factory, output interceptor, working-dir resolution |
| [`executeCommandOutput.ts`](src/features/chat/tools/helpers/executeCommandOutput.ts)       | `buildTerminalCallbacks`, `createOutputPublisher` (terminal output publishing/piping)                                    |
| [`executeCommandExecution.ts`](src/features/chat/tools/helpers/executeCommandExecution.ts) | `executeCommandInTerminal`, `executeWithShellFallback` (actual command spawn)                                            |
| [`executeCommandFormat.ts`](src/features/chat/tools/helpers/executeCommandFormat.ts)       | `formatBytes`, `formatCommandResult`, `formatExitStatus`, `formatPersistedOutput`                                        |
| [`executeCommandTimeouts.ts`](src/features/chat/tools/helpers/executeCommandTimeouts.ts)   | `raceCommandTimeouts`, `awaitPostTimeoutResult`, `resolveAgentTimeoutMs`                                                 |

### readFile Group (6 files)

| File                                                                                   | Purpose                                                                                                                          |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`readFileHelpers.ts`](src/features/chat/tools/helpers/readFileHelpers.ts)             | Types (`FileResult`, `InternalFileEntry`), `buildFileEntry`, `validateOffsetParam`, `validateAccessAndFilter`, `getErrorMessage` |
| [`readFileOrchestration.ts`](src/features/chat/tools/helpers/readFileOrchestration.ts) | Top-level orchestration: `processNewFileResults`, `handleNewFileError` — imports from approval + processing + binary             |
| [`readFileProcessing.ts`](src/features/chat/tools/helpers/readFileProcessing.ts)       | File processing: `processApprovedFile`, `processTextFile`, `buildAndPushResult`, output builders                                 |
| [`readFileApproval.ts`](src/features/chat/tools/helpers/readFileApproval.ts)           | Approval flow: `requestApproval`, `requestSingleFileApproval`, `requestBatchApproval`                                            |
| [`readFileLegacy.ts`](src/features/chat/tools/helpers/readFileLegacy.ts)               | Legacy read: `readLegacyFileContent`, `processLegacyFileEntry`, `handleLegacyBinaryFile`                                         |
| [`readFileBinary.ts`](src/features/chat/tools/helpers/readFileBinary.ts)               | Binary handling: `handleBinaryFile`, `handleImageFileProcessing`, `handleSupportedBinaryFormat`                                  |

### File Editing Group (7 files)

| File                                                                                     | Purpose                                                                                                                           |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`editFileHelpers.ts`](src/features/chat/tools/helpers/editFileHelpers.ts)               | Core edit: `performEditReplacement`, `normalizeToLF`, `restoreLineEnding`, `resolveRelativePath`, `escapeRegExp`, regex builders  |
| [`editFileSaveHelpers.ts`](src/features/chat/tools/helpers/editFileSaveHelpers.ts)       | Save/approval: `handleEditFileApprovalAndSave`, `handleEditFilePartial`, `recordEditFileFailure`, `readEditFileState`             |
| [`editToolHelpers.ts`](src/features/chat/tools/helpers/editToolHelpers.ts)               | Legacy edit tool: `validateEditParams`, `readAndValidateEditFile`, `requestEditApprovalAndSave`                                   |
| [`searchReplaceHelpers.ts`](src/features/chat/tools/helpers/searchReplaceHelpers.ts)     | SearchReplace tool: `validateSearchReplaceParams`, `validateSearchReplaceAccess`, `readAndMatchContent`, `applySearchReplaceDiff` |
| [`applyDiffHelpers.ts`](src/features/chat/tools/helpers/applyDiffHelpers.ts)             | ApplyDiff tool: `buildApplyDiffResult`, `buildApprovalMessage`, `buildDiffFailureError`, `saveDiffDirectly`, `saveDiffWithView`   |
| [`applyPatchCreateDelete.ts`](src/features/chat/tools/helpers/applyPatchCreateDelete.ts) | ApplyPatch: `handlePatchAddFile`, `handlePatchDeleteFile`                                                                         |
| [`applyPatchFileOps.ts`](src/features/chat/tools/helpers/applyPatchFileOps.ts)           | ApplyPatch: `handlePatchFileMove`, `handlePatchUpdateFile`, `saveUpdatedFile`                                                     |

### Other Tool Helpers (8 files)

| File                                                                                         | Purpose                                                                                              |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`writeToFileHelpers.ts`](src/features/chat/tools/helpers/writeToFileHelpers.ts)             | WriteToFile tool: validation, existence check, partial context, execution, diff view                 |
| [`readCommandOutputHelpers.ts`](src/features/chat/tools/helpers/readCommandOutputHelpers.ts) | ReadCommandOutput: param validation, `readArtifact`, `formatBytes`, `escapeRegExp`, `addLineNumbers` |
| [`readCommandOutputSearch.ts`](src/features/chat/tools/helpers/readCommandOutputSearch.ts)   | ReadCommandOutput: `searchInArtifact` (regex search in output artifacts)                             |
| [`updateTodoListHelpers.ts`](src/features/chat/tools/helpers/updateTodoListHelpers.ts)       | UpdateTodoList: parsing, validation, broadcasting, markdown checklist handling                       |
| [`attemptCompletionHelpers.ts`](src/features/chat/tools/helpers/attemptCompletionHelpers.ts) | AttemptCompletion: pre-condition validation, subtask delegation                                      |
| [`toolResultFormatting.ts`](src/features/chat/tools/helpers/toolResultFormatting.ts)         | Single function `formatToolInvocation` — **DEAD CODE** (0 references)                                |

### Image Group (5 files — 2 root + 3 subfolder)

| File                                                                                           | Purpose                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`imageHelpers.ts`](src/features/chat/tools/helpers/imageHelpers.ts)                           | `ImageMemoryTracker`, `processImageFile`, `validateImageForProcessing`, `readImageAsDataUrlWithBuffer`, `isSupportedImageFormat` — shared by readFile (binary images) and image generation |
| [`generateImageHelpers.ts`](src/features/chat/tools/helpers/generateImageHelpers.ts)           | **BARREL** — re-exports from `generate-image/*`                                                                                                                                            |
| [`generate-image/validation.ts`](src/features/chat/tools/helpers/generate-image/validation.ts) | `validateImageParams`, `resolveImageModel`                                                                                                                                                 |
| [`generate-image/flow.ts`](src/features/chat/tools/helpers/generate-image/flow.ts)             | `executeImageFlow`, `executeImageGenerationAndValidate`                                                                                                                                    |
| [`generate-image/io.ts`](src/features/chat/tools/helpers/generate-image/io.ts)                 | `readInputImage`, `saveGeneratedImage`                                                                                                                                                     |

## Findings

### 1. Duplicate Functions

**`escapeRegExp`** — defined in TWO places:

- [`editFileHelpers.ts`](src/features/chat/tools/helpers/editFileHelpers.ts:51) — `export function escapeRegExp(input: string): string`
- [`readCommandOutputHelpers.ts`](src/features/chat/tools/helpers/readCommandOutputHelpers.ts:26) — `export function escapeRegExp(string: string): string`

Both are identical implementations. The `readCommandOutputHelpers.ts` version is imported by [`readCommandOutputSearch.ts`](src/features/chat/tools/helpers/readCommandOutputSearch.ts:4). The `editFileHelpers.ts` version is used internally. **Extract to a shared utility.**

**`formatBytes`** — defined in TWO places:

- [`executeCommandFormat.ts`](src/features/chat/tools/helpers/executeCommandFormat.ts:106) — outputs `"B"` suffix (e.g., `"1023B"`)
- [`readCommandOutputHelpers.ts`](src/features/chat/tools/helpers/readCommandOutputHelpers.ts:30) — outputs `"bytes"` suffix (e.g., `"1023 bytes"`)

Slightly different output formats but functionally identical. **Standardize and extract to a shared utility.**

### 2. Barrel/Passthrough Files

**`executeCommandHelpers.ts`** — Pure barrel file that re-exports from 5 sibling files. Imported by [`ExecuteCommandTool.ts`](src/features/chat/tools/ExecuteCommandTool.ts:15-19). **Eliminate** — its purpose is subsumed by the subfolder `index.ts`.

**`generateImageHelpers.ts`** — Pure barrel file re-exporting from `generate-image/*`. **Eliminate** — the `generate-image/` subfolder should have its own `index.ts`.

### 3. Dead Code

**`toolResultFormatting.ts`** — Exports `formatToolInvocation` which has **zero references** in the codebase. **Remove** (or keep as a candidate for cleanup).

### 4. No Overlap with `api/handlers/helpers`

The API handlers helpers deal with API streaming, request preparation, retry/backoff, and abort management — a completely different domain from chat tool execution. No function overlap.

## Proposed Subfolder Structure

```
helpers/
├── index.ts                          # Barrel: re-exports from all subfolders
│
├── execute/                          # 5 files (was 6, barrel eliminated)
│   ├── index.ts
│   ├── executeCommandState.ts        # State, interceptor, working-dir
│   ├── executeCommandOutput.ts       # Terminal callbacks, output publisher
│   ├── executeCommandExecution.ts    # Command spawn, shell fallback
│   ├── executeCommandFormat.ts       # Formatting utilities
│   └── executeCommandTimeouts.ts     # Timeout racing
│
├── readfile/                         # 6 files
│   ├── index.ts
│   ├── readFileHelpers.ts            # Types, validation, filtering
│   ├── readFileOrchestration.ts      # Top-level orchestration
│   ├── readFileProcessing.ts         # Content processing, output building
│   ├── readFileApproval.ts           # User approval flow
│   ├── readFileLegacy.ts             # Legacy read support
│   └── readFileBinary.ts             # Binary/image file handling
│
├── edit/                             # 7 files — core editing tools
│   ├── index.ts
│   ├── editFileHelpers.ts            # Core edit logic, regex builders
│   ├── editFileSaveHelpers.ts        # Save/approval flow
│   ├── editToolHelpers.ts            # Legacy edit tool
│   ├── searchReplaceHelpers.ts       # SearchReplace tool
│   ├── applyDiffHelpers.ts           # ApplyDiff tool
│   ├── applyPatchCreateDelete.ts     # ApplyPatch: add/delete
│   └── applyPatchFileOps.ts          # ApplyPatch: update/move
│
├── readoutput/                       # 2 files
│   ├── index.ts
│   ├── readCommandOutputHelpers.ts   # Param validation, artifact reading
│   └── readCommandOutputSearch.ts    # Regex search in artifacts
│
├── write/                            # 1 file
│   ├── index.ts
│   └── writeToFileHelpers.ts
│
├── lifecycle/                        # 3 files
│   ├── index.ts
│   ├── updateTodoListHelpers.ts
│   └── attemptCompletionHelpers.ts
│
├── generate-image/                   # 4 files (was 3, + index.ts, imageHelpers.ts moves in)
│   ├── index.ts
│   ├── validation.ts
│   ├── flow.ts
│   ├── io.ts
│   └── imageHelpers.ts               # 🚚 MOVED from helpers/ root
│
└── shared/                           # 1 file — extracted deduplicated utilities
    └── index.ts                       # escapeRegExp, formatBytes
```

## Summary of Changes

### Files to Create (9 new `index.ts` barrel files)

- `helpers/index.ts`
- `helpers/execute/index.ts`
- `helpers/readfile/index.ts`
- `helpers/edit/index.ts`
- `helpers/readoutput/index.ts`
- `helpers/write/index.ts`
- `helpers/lifecycle/index.ts`
- `helpers/generate-image/index.ts`
- `helpers/shared/index.ts`

### Files to Eliminate (3)

| File                                                                                   | Reason                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`executeCommandHelpers.ts`](src/features/chat/tools/helpers/executeCommandHelpers.ts) | Barrel — subsumed by `execute/index.ts`             |
| [`generateImageHelpers.ts`](src/features/chat/tools/helpers/generateImageHelpers.ts)   | Barrel — subsumed by `generate-image/index.ts`      |
| [`toolResultFormatting.ts`](src/features/chat/tools/helpers/toolResultFormatting.ts)   | Dead code — `formatToolInvocation` has 0 references |

### Files to Move (1)

| File                                                                 | From            | To                                       |
| -------------------------------------------------------------------- | --------------- | ---------------------------------------- |
| [`imageHelpers.ts`](src/features/chat/tools/helpers/imageHelpers.ts) | `helpers/` root | `helpers/generate-image/imageHelpers.ts` |

### Files to Deduplicate

| Function       | Locations                                                        | Action                                                                  |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `escapeRegExp` | `editFileHelpers.ts:51` + `readCommandOutputHelpers.ts:26`       | Extract to `shared/index.ts`, import by both                            |
| `formatBytes`  | `executeCommandFormat.ts:106` + `readCommandOutputHelpers.ts:30` | Extract to `shared/index.ts`, standardize output format, import by both |

### Import Updates Required

Every tool file importing from `./helpers/<file>` must be updated to import from `./helpers/<subfolder>/<file>`:

| Tool File                                                                      | Current Import                                                                             | New Import                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------- |
| [`ExecuteCommandTool.ts`](src/features/chat/tools/ExecuteCommandTool.ts)       | `./helpers/executeCommandHelpers`                                                          | `./helpers/execute`        |
| [`ReadFileTool.ts`](src/features/chat/tools/ReadFileTool.ts)                   | `./helpers/readFileHelpers`, `./helpers/readFileLegacy`, `./helpers/readFileOrchestration` | `./helpers/readfile`       |
| [`EditFileTool.ts`](src/features/chat/tools/EditFileTool.ts)                   | `./helpers/editFileHelpers`, `./helpers/editFileSaveHelpers`                               | `./helpers/edit`           |
| [`EditTool.ts`](src/features/chat/tools/EditTool.ts)                           | `./helpers/editToolHelpers`                                                                | `./helpers/edit`           |
| [`SearchReplaceTool.ts`](src/features/chat/tools/SearchReplaceTool.ts)         | `./helpers/searchReplaceHelpers`                                                           | `./helpers/edit`           |
| [`ApplyDiffTool.ts`](src/features/chat/tools/ApplyDiffTool.ts)                 | `./helpers/applyDiffHelpers`                                                               | `./helpers/edit`           |
| [`ApplyPatchTool.ts`](src/features/chat/tools/ApplyPatchTool.ts)               | `./helpers/applyPatchCreateDelete`, `./helpers/applyPatchFileOps`                          | `./helpers/edit`           |
| [`WriteToFileTool.ts`](src/features/chat/tools/WriteToFileTool.ts)             | `./helpers/writeToFileHelpers`                                                             | `./helpers/write`          |
| [`ReadCommandOutputTool.ts`](src/features/chat/tools/ReadCommandOutputTool.ts) | `./helpers/readCommandOutputHelpers` or `Search`                                           | `./helpers/readoutput`     |
| [`UpdateTodoListTool.ts`](src/features/chat/tools/UpdateTodoListTool.ts)       | `./helpers/updateTodoListHelpers`                                                          | `./helpers/lifecycle`      |
| [`AttemptCompletionTool.ts`](src/features/chat/tools/AttemptCompletionTool.ts) | `./helpers/attemptCompletionHelpers`                                                       | `./helpers/lifecycle`      |
| [`GenerateImageTool.ts`](src/features/chat/tools/GenerateImageTool.ts)         | `./helpers/generateImageHelpers`                                                           | `./helpers/generate-image` |

## Execution Order

1. **Create `shared/index.ts`** — Extract `escapeRegExp` and `formatBytes` into shared utilities. Update all imports.
2. **Move `imageHelpers.ts`** into `generate-image/` — Update `readFileOrchestration.ts` import.
3. **Update `generate-image/index.ts`** — Add barrel exports (replacing `generateImageHelpers.ts`).
4. **Create subfolder barrel files** — `execute/`, `readfile/`, `edit/`, `readoutput/`, `write/`, `lifecycle/`, `generate-image/`, root `helpers/index.ts`.
5. **Eliminate barrel files** — Remove `executeCommandHelpers.ts` and `generateImageHelpers.ts`.
6. **Remove dead code** — Remove `toolResultFormatting.ts`.
7. **Update all imports** in tool files (12 files).
8. **Verify** — Run type checker to confirm no broken imports.
