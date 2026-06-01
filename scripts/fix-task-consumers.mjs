#!/usr/bin/env node
// Fix all consumer files that reference removed Task getter/setter/delegation methods

import fs from 'fs'
import path from 'path'

const SRC_DIR = path.resolve(process.cwd(), 'src')

// ── All the property renames needed ──
const PROP_FIXES = {
  // Simple _state access
  'task.abort': 'task._state.abort',
  'task.abandoned': 'task._state.abandoned',
  'task.abortReason': 'task._state.abortReason',
  'task.turnResetPending': 'task._state.turnResetPending',
  'task.isStreaming': 'task._state.isStreaming',
  'task.isWaitingForFirstChunk': 'task._state.isWaitingForFirstChunk',
  'task.didRejectTool': 'task._state.didRejectTool',
  'task.didAlreadyUseTool': 'task._state.didAlreadyUseTool',
  'task.didCompleteReadingStream': 'task._state.didCompleteReadingStream',
  'task.isInitialized': 'task._state.isInitialized',
  'task.isCompleted': 'task._state.isCompleted',
  'task.completionResultSummary': 'task._state.completionResultSummary',
  'task.askResponse': 'task._state.askResponse',
  'task.askResponseText': 'task._state.askResponseText',
  'task.askResponseImages': 'task._state.askResponseImages',
  'task.askShownAt': 'task._state.askShownAt',
  'task.interactiveAsk': 'task._state.interactiveAsk',
  'task.resumableAsk': 'task._state.resumableAsk',
  'task.idleAsk': 'task._state.idleAsk',
  'task.assistantMessageSavedToHistory': 'task._state.assistantMessageSavedToHistory',
  'task.currentStreamingContentIndex': 'task._state.currentStreamingContentIndex',
  'task.currentStreamingDidCheckpoint': 'task._state.currentStreamingDidCheckpoint',
  'task.didToolFailInCurrentTurn': 'task._state.didToolFailInCurrentTurn',
  'task.didFinishAbortingStream': 'task._state.didFinishAbortingStream',
  'task.isPaused': 'task._state.isPaused',
  'task.skipPrevResponseIdOnce': 'task._state.skipPrevResponseIdOnce',
  'task.taskNumber': 'task._state.taskNumber',
  'task.initialStatus': 'task._state.initialStatus',
  'task.todoList': 'task._state.todoList',
  'task.streamingToolCallIndices': 'task._state.streamingToolCallIndices',
  'task.toolUsage': 'task._state.toolUsage',

  // taskStatus is computed - use utility function
  'task.taskStatus': 'getTaskStatus(task)',

  // Sub-store: mistakeTracking
  'task.consecutiveMistakeLimit': 'task._state.mistakeTracking.consecutiveMistakeLimit',
  'task.consecutiveMistakeCount': 'task._state.mistakeTracking.consecutiveMistakeCount',
  'task.consecutiveNoToolUseCount': 'task._state.mistakeTracking.consecutiveNoToolUseCount',
  'task.consecutiveNoAssistantMessagesCount': 'task._state.mistakeTracking.consecutiveNoAssistantMessagesCount',
  'task.consecutiveMistakeCountForApplyDiff': 'task._state.mistakeTracking.consecutiveMistakeCountForApplyDiff',
  'task.consecutiveMistakeCountForEditFile': 'task._state.mistakeTracking.consecutiveMistakeCountForEditFile',

  // Sub-store: checkpoints
  'task.enableCheckpoints': 'task._state.checkpoints.enableCheckpoints',
  'task.checkpointTimeout': 'task._state.checkpoints.checkpointTimeout',
  'task.checkpointServiceInitializing': 'task._state.checkpoints.checkpointServiceInitializing',

  // Sub-store: presentAssistantMessage
  'task.presentAssistantMessageLocked': 'task._state.presentAssistantMessage.presentAssistantMessageLocked',
  'task.presentAssistantMessageHasPendingUpdates': 'task._state.presentAssistantMessage.presentAssistantMessageHasPendingUpdates',
  'task.userMessageContentReady': 'task._state.presentAssistantMessage.userMessageContentReady',
}

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  const original = content
  const relPath = path.relative(SRC_DIR, filePath)
  let needsTaskStatusImport = false

  // Replace simple property accesses (task.xxx -> task._state.xxx)
  // Sort by length descending to match longer paths first
  const sortedProps = Object.entries(PROP_FIXES).sort((a, b) => b[0].length - a[0].length)
  
  for (const [oldRef, newRef] of sortedProps) {
    // Match word boundary after the property name to avoid partial matches
    const regex = new RegExp(
      oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w$])',
      'g'
    )
    
    if (newRef === 'getTaskStatus(task)') {
      // Check if this file actually uses task.taskStatus before replacing
      if (regex.test(content)) {
        needsTaskStatusImport = true
        // Reset lastIndex since test() updated it
        regex.lastIndex = 0
        content = content.replace(regex, newRef)
      }
    } else {
      content = content.replace(regex, newRef)
    }
  }

  // Fix accidental double _state._state.
  content = content.replace(/task\._state\._state\./g, 'task._state.')

  // Add import for getTaskStatus if needed
  if (needsTaskStatusImport) {
    const importStatement = 'import { getTaskStatus } from "../../features/chat/task/utils/metrics"'
    // Try different import paths based on file depth
    const depth = relPath.split('/').length - 1
    let importPath
    if (relPath.startsWith('features/chat/task/')) {
      importPath = './utils/metrics'
    } else if (relPath.startsWith('core/')) {
      importPath = '../features/chat/task/utils/metrics'
    } else if (relPath.startsWith('integrations/')) {
      importPath = '../../features/chat/task/utils/metrics'
    } else {
      // Use a heuristic - count directory depth
      const backticks = '../'.repeat(depth)
      importPath = `${backticks}features/chat/task/utils/metrics`
    }
    
    const importLine = `import { getTaskStatus } from "${importPath}"`
    
    // Find a good place to add the import - after the last existing import
    const importMatch = content.match(/^import .+$/m)
    if (importMatch) {
      // Find the last import line
      const lines = content.split('\n')
      let lastImportIdx = -1
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          lastImportIdx = i
        }
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, importLine)
        content = lines.join('\n')
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  }
  return false
}

function walkDir(dir) {
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
        count += walkDir(fullPath)
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      if (replaceInFile(fullPath)) {
        count++
        console.log(`Fixed: ${path.relative(SRC_DIR, fullPath)}`)
      }
    }
  }
  return count
}

const fixed = walkDir(SRC_DIR)
console.log(`\nFixed ${fixed} files`)
