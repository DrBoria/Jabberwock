#!/usr/bin/env node

/**
 * Fix remaining type errors after the Task.ts refactoring.
 */
import fs from "fs"
import path from "path"

const srcDir = "src"

// ── MST state property mappings ─────────────────────────────────────────

const mainStateProps = {
  "abort": "_state.abort",
  "abandoned": "_state.abandoned",
  "todoList": "_state.todoList",
  "toolUsage": "_state.toolUsage",
  "currentStreamingContentIndex": "_state.currentStreamingContentIndex",
  "didCompleteReadingStream": "_state.didCompleteReadingStream",
  "didRejectTool": "_state.didRejectTool",
  "didAlreadyUseTool": "_state.didAlreadyUseTool",
  "didToolFailInCurrentTurn": "_state.didToolFailInCurrentTurn",
  "assistantMessageSavedToHistory": "_state.assistantMessageSavedToHistory",
  "isStreaming": "_state.isStreaming",
  "isWaitingForFirstChunk": "_state.isWaitingForFirstChunk",
  "isInitialized": "_state.isInitialized",
  "isPaused": "_state.isPaused",
  "isCompleted": "_state.isCompleted",
  "turnResetPending": "_state.turnResetPending",
  "skipPrevResponseIdOnce": "_state.skipPrevResponseIdOnce",
  "currentStreamingDidCheckpoint": "_state.currentStreamingDidCheckpoint",
  "askResponse": "_state.askResponse",
  "askResponseText": "_state.askResponseText",
  "askResponseImages": "_state.askResponseImages",
  "askShownAt": "_state.askShownAt",
  "idleAsk": "_state.idleAsk",
  "resumableAsk": "_state.resumableAsk",
  "interactiveAsk": "_state.interactiveAsk",
  "childTaskId": "_state.childTaskId",
  "childTaskIds": "_state.childTaskIds",
  "pendingNewTaskToolCallId": "_state.pendingNewTaskToolCallId",
  "completionResultSummary": "_state.completionResultSummary",
  "abortReason": "_state.abortReason",
  "_taskMode": "_state._taskMode",
  "_taskApiConfigName": "_state._taskApiConfigName",
  "consecutiveMistakeLimit": "_state.mistakeTracking.consecutiveMistakeLimit",
}

const subStoreProps = {
  "presentAssistantMessageLocked": "_state.presentAssistantMessage.presentAssistantMessageLocked",
  "presentAssistantMessageHasPendingUpdates": "_state.presentAssistantMessage.presentAssistantMessageHasPendingUpdates",
  "userMessageContentReady": "_state.presentAssistantMessage.userMessageContentReady",
  "consecutiveMistakeCount": "_state.mistakeTracking.consecutiveMistakeCount",
  "consecutiveNoAssistantMessagesCount": "_state.mistakeTracking.consecutiveNoAssistantMessagesCount",
  "consecutiveNoToolUseCount": "_state.mistakeTracking.consecutiveNoToolUseCount",
  "consecutiveMistakeCountForApplyDiff": "_state.mistakeTracking.consecutiveMistakeCountForApplyDiff",
  "consecutiveMistakeCountForEditFile": "_state.mistakeTracking.consecutiveMistakeCountForEditFile",
  "enableCheckpoints": "_state.checkpoints.enableCheckpoints",
  "currentCheckpoint": "_state.checkpoints.currentCheckpoint",
}

const allStateProps = { ...subStoreProps, ...mainStateProps }

const methodToFunc = {
  "ask": "ask",
  "say": "say",
  "handleWebviewAskResponse": "handleWebviewAskResponse",
  "recordToolUsage": "recordToolUsage",
  "recordToolError": "recordToolError",
  "pushToolResultToUserContent": "pushToolResultToUserContent",
  "checkpointSave": "checkpointSave",
  "flushPendingToolResultsToHistory": "flushPendingToolResultsToHistory",
  "overwriteClineMessages": "overwriteClineMessages",
  "overwriteApiConversationHistory": "overwriteApiConversationHistory",
  "abortTask": "abortTask",
  "condenseContext": "condenseContext",
  "processQueuedMessages": "processQueuedMessages",
  "getSystemPrompt": "getSystemPrompt",
  "startSubtask": "startSubtask",
  "resumeAfterDelegation": "resumeAfterDelegation",
  "addToClineMessages": "addToClineMessages",
  "updateClineMessage": "updateClineMessage",
  "addToApiConversationHistory": "addToApiConversationHistory",
  "saveClineMessages": "saveClineMessages",
  "findMessageByTimestamp": "findMessageByTimestamp",
  "approveAsk": "approveAsk",
  "denyAsk": "denyAsk",
}

function getImportPath(relFile, funcName) {
  const dirs = {
    "ask": "../../features/chat/task/utils/messaging",
    "say": "../../features/chat/task/utils/messaging",
    "handleWebviewAskResponse": "../../features/chat/task/utils/messaging",
    "recordToolUsage": "../../features/chat/task/utils/metrics",
    "recordToolError": "../../features/chat/task/utils/metrics",
    "pushToolResultToUserContent": "../../features/chat/task/utils/streaming",
    "checkpointSave": "../checkpoints",
    "flushPendingToolResultsToHistory": "../../features/chat/task/utils/flushPendingToolResults",
    "overwriteClineMessages": "../../features/chat/task/utils/messagePersistence",
    "overwriteApiConversationHistory": "../../features/chat/task/actions/overwriteApiHistory",
    "abortTask": "../../features/chat/task/actions/taskLifecycle",
    "condenseContext": "../../features/chat/task/utils/condenseContext",
    "processQueuedMessages": "../../features/chat/task/actions/processQueuedMessages",
    "getSystemPrompt": "../../features/chat/task/utils/systemPrompt",
    "startSubtask": "../../features/chat/task/actions/delegation",
    "resumeAfterDelegation": "../../features/chat/task/actions/delegation",
    "addToClineMessages": "../../features/chat/task/utils/messagePersistence",
    "updateClineMessage": "../../features/chat/task/utils/messagePersistence",
    "saveClineMessages": "../../features/chat/task/utils/messagePersistence",
    "findMessageByTimestamp": "../../features/chat/task/utils/messagePersistence",
    "approveAsk": "../../features/chat/task/utils/messaging",
    "denyAsk": "../../features/chat/task/utils/messaging",
  }

  let basePath = dirs[funcName]
  if (!basePath) return null

  // Adjust for test files located in core/ directory
  if (relFile.startsWith("core/task/__tests__/") || relFile.startsWith("core/tools/__tests__/")) {
    const testPaths = {
      "ask": "../features/chat/task/utils/messaging",
      "say": "../features/chat/task/utils/messaging",
      "handleWebviewAskResponse": "../features/chat/task/utils/messaging",
      "recordToolUsage": "../features/chat/task/utils/metrics",
      "recordToolError": "../features/chat/task/utils/metrics",
      "pushToolResultToUserContent": "../features/chat/task/utils/streaming",
      "checkpointSave": "../checkpoints",
      "flushPendingToolResultsToHistory": "../features/chat/task/utils/flushPendingToolResults",
      "abortTask": "../features/chat/task/actions/taskLifecycle",
      "condenseContext": "../features/chat/task/utils/condenseContext",
      "approveAsk": "../features/chat/task/utils/messaging",
      "denyAsk": "../features/chat/task/utils/messaging",
    }
    if (testPaths[funcName]) return testPaths[funcName]
  }

  return basePath
}

function walkDir(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "__pycache__") continue
      files.push(...walkDir(fullPath))
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath)
    }
  }
  return files
}

function addImports(content, importsToAdd) {
  if (importsToAdd.length === 0) return content

  // Find the last non-empty import line
  const lines = content.split("\n")
  let lastImportIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^import .+ from ["'].+["']\s*;?$/.test(lines[i].trim())) {
      lastImportIdx = i
    }
  }
  if (lastImportIdx === -1) return content

  // Check for existing imports of the same module
  const existingModules = new Set()
  for (let i = 0; i <= lastImportIdx; i++) {
    const m = lines[i].match(/from ["'](.+)["']/)
    if (m) existingModules.add(m[1])
  }

  const newLines = []
  for (const line of importsToAdd) {
    const modMatch = line.match(/from "(.+)"$/)
    if (!modMatch) continue
    const modPath = modMatch[1]
    if (existingModules.has(modPath)) {
      // Merge function names into existing import
      const funcsMatch = line.match(/import \{ (.+) \} from/)
      if (!funcsMatch) continue
      const neededFuncs = funcsMatch[1].split(", ").map(f => f.trim())
      
      // Find and update the existing import line
      for (let i = 0; i <= lastImportIdx; i++) {
        if (lines[i].includes(`from "${modPath}"`)) {
          const existingFuncsMatch = lines[i].match(/\{ (.+) \}/)
          if (existingFuncsMatch) {
            const existingFuncs = existingFuncsMatch[1].split(",").map(f => f.trim())
            const merged = [...new Set([...existingFuncs, ...neededFuncs])]
            lines[i] = lines[i].replace(/\{ (.+) \}/, `{ ${merged.join(", ")} }`)
          }
          break
        }
      }
    } else {
      newLines.push(line)
    }
  }

  if (newLines.length > 0) {
    lines.splice(lastImportIdx + 1, 0, ...newLines)
  }

  return lines.join("\n")
}

// ── Fix a single file ─────────────────────────────────────────────────

function fixContent(content, relFile) {
  let modified = content
  let neededImports = new Set()

  // Fix MST property access for common variable names
  for (const v of ["task", "mockTask", "cline", "mock"]) {
    for (const [prop, replacement] of Object.entries(allStateProps)) {
      // Match varName.prop but not varName.other.prop (already accessed through _state)
      // Use word boundary and ensure no _state. before
      const regex = new RegExp(`(?<!\\._state\\.)(?<!\\._state\\.\\w+\\.)${v}\\.${prop}\\b`, "g")
      modified = modified.replace(regex, `${v}.${replacement}`)
    }
  }

  // Fix method calls for common variable names
  const callers = ["task", "mockTask", "cline"]
  for (const [method, funcName] of Object.entries(methodToFunc)) {
    for (const v of callers) {
      const callRegex = new RegExp(`${v}\\.${method}\\(`, "g")
      if (callRegex.test(modified)) {
        modified = modified.replace(callRegex, `${funcName}(${v}, `)
        neededImports.add(funcName)
      }
    }
  }

  // Fix vi.spyOn for removed methods - use cast instead
  for (const method of Object.keys(methodToFunc)) {
    const spyRegex = new RegExp(`vi\\.spyOn\\((task|mockTask), "(${method})"\\)`, "g")
    modified = modified.replace(spyRegex, 'vi.spyOn($1 as any, "$2" as any)')
  }

  // Add imports
  if (neededImports.size > 0) {
    const byModule = {}
    for (const funcName of neededImports) {
      const modPath = getImportPath(relFile, funcName)
      if (!modPath) continue
      if (!byModule[modPath]) byModule[modPath] = []
      byModule[modPath].push(funcName)
    }
    const importLines = []
    for (const [modPath, funcs] of Object.entries(byModule)) {
      const unique = [...new Set(funcs)]
      importLines.push(`import { ${unique.join(", ")} } from "${modPath}"`)
    }
    modified = addImports(modified, importLines)
  }

  return modified
}

// ── File-specific fixes ───────────────────────────────────────────────

function fixPresentAssistantMessage(filePath) {
  let content = fs.readFileSync(filePath, "utf-8")
  const relFile = path.relative(srcDir, filePath)

  // Use cline variable, apply general fix
  content = fixContent(content, relFile)

  return content
}

function fixCheckpointsIndex(filePath) {
  let content = fs.readFileSync(filePath, "utf-8")
  const relFile = path.relative(srcDir, filePath)

  // task.say(...) → say(task, ...)
  content = content.replace(/task\.say\(/g, "say(task, ")
  
  content = addImports(content, ['import { say } from "../../features/chat/task/utils/messaging"'])

  return content
}

function fixMessageManagerIndex(filePath) {
  let content = fs.readFileSync(filePath, "utf-8")
  
  // this.task.overwriteClineMessages(...) → overwriteClineMessages(this.task, ...)
  content = content.replace(/this\.task\.overwriteClineMessages\(/g, "overwriteClineMessages(this.task, ")
  
  // this.task.overwriteApiConversationHistory(...) → overwriteApiConversationHistory(this.task, ...)
  content = content.replace(/this\.task\.overwriteApiConversationHistory\(/g, "overwriteApiConversationHistory(this.task, ")
  
  if (content.includes("overwriteClineMessages(this.task, ") || content.includes("overwriteApiConversationHistory(this.task, ")) {
    content = addImports(content, [
      'import { overwriteClineMessages } from "../../features/chat/task/utils/messagePersistence"',
      'import { overwriteApiConversationHistory } from "../../features/chat/task/actions/overwriteApiHistory"'
    ])
  }
  
  return content
}

// ── Main ───────────────────────────────────────────────────────────────

const allFiles = walkDir(srcDir)

let totalFixed = 0

for (const filePath of allFiles) {
  const relative = path.relative(".", filePath)
  let content = fs.readFileSync(filePath, "utf-8")
  const original = content
  const relFile = path.relative(srcDir, filePath)

  if (filePath.endsWith("core/assistant-message/presentAssistantMessage.ts")) {
    content = fixPresentAssistantMessage(filePath)
  } else if (filePath.endsWith("core/checkpoints/index.ts")) {
    content = fixCheckpointsIndex(filePath)
  } else if (filePath.endsWith("core/message-manager/index.ts")) {
    content = fixMessageManagerIndex(filePath)
  } else if (relFile.startsWith("core/") || relFile.startsWith("features/") || relFile.startsWith("services/")) {
    content = fixContent(content, relFile)
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf-8")
    console.log(`✅ Fixed: ${relative}`)
    totalFixed++
  }
}

console.log(`\n🎯 Total files fixed: ${totalFixed}`)
