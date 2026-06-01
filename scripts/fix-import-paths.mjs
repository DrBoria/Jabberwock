/**
 * Fix wrong import paths added by previous batch-fix script.
 * 
 * The script added imports like `../../features/chat/task/utils/messaging` to files
 * that are ALREADY inside `features/chat/task/`. These need to be corrected to
 * proper relative paths.
 * 
 * From `utils/`:
 *   ../../features/chat/task/utils/X  →  ./X
 *   ../../features/chat/task/actions/X → ../actions/X
 * 
 * From `actions/`:
 *   ../../features/chat/task/utils/X   →  ../utils/X
 *   ../../features/chat/task/actions/X →  ./X  (or remove if self-import)
 */
import fs from "fs"
import path from "path"

const SRC_DIR = path.resolve("src/features/chat/task")

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf-8")
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf-8")
}

/**
 * Fixes wrong import paths in a file.
 * Returns {fixed: boolean, content: string} 
 */
function fixImports(content, relativeFromDir) {
  // Determine the directory relative to `features/chat/task/`
  // e.g., "utils" or "actions"
  const parts = relativeFromDir.split("/")
  
  let fixed = false
  
  // Pattern: from features/chat/task/ subdirectories
  // Wrong: ../../features/chat/task/utils/X
  // Wrong: ../../features/chat/task/actions/X
  
  // Fix 1: Replace ../../features/chat/task/utils/X with ./X (when in utils/)
  // Fix 2: Replace ../../features/chat/task/actions/X with ../actions/X (when in utils/)
  // Fix 3: Replace ../../features/chat/task/utils/X with ../utils/X (when in actions/)
  // Fix 4: Replace ../../features/chat/task/actions/X with ./X (when in actions/) -- but this is self-import, remove
  
  const wrongPattern = /from\s+["']\.\.\/\.\.\/features\/chat\/task\/((?:utils|actions)\/[^"']+)["']/g
  
  content = content.replace(wrongPattern, (match, modulePath) => {
    fixed = true
    const [targetDir, ...rest] = modulePath.split("/")
    const moduleName = rest.join("/")
    
    if (relativeFromDir === "utils") {
      if (targetDir === "utils") {
        // From utils/, import from ./moduleName
        return `from "./${moduleName}"`
      } else if (targetDir === "actions") {
        // From utils/, import from ../actions/moduleName
        return `from "../actions/${moduleName}"`
      }
    } else if (relativeFromDir === "actions") {
      if (targetDir === "utils") {
        // From actions/, import from ../utils/moduleName
        return `from "../utils/${moduleName}"`
      } else if (targetDir === "actions") {
        // From actions/, import from ./moduleName
        return `from "./${moduleName}"`
      }
    }
    return match
  })
  
  return { fixed, content }
}

/**
 * Remove self-import lines (importing the same file from itself).
 */
function removeSelfImports(content, filePath) {
  // Get the filename without extension
  const basename = path.basename(filePath, ".ts")
  const dir = path.dirname(filePath)
  const relativeDir = path.relative(SRC_DIR, dir)
  
  // Pattern: import ... from "./FileName" where FileName matches the current file
  // or import ... from "../actions/FileName" when in actions/
  const selfImportPattern = new RegExp(
    `import\\s+.*?\\s+from\\s+["']\\.\\/?${basename}["'];?\\n?`,
    "g"
  )
  const prevContent = content
  content = content.replace(selfImportPattern, "")
  if (prevContent !== content) {
    return { fixed: true, content }
  }
  return { fixed: false, content }
}

// Process all .ts files in features/chat/task/
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    
    if (entry.isDirectory()) {
      processDirectory(fullPath)
    } else if (entry.name.endsWith(".ts")) {
      const relativePath = path.relative(SRC_DIR, fullPath)
      const relativeDir = path.dirname(relativePath)
      
      let content = readFile(fullPath)
      let fileChanged = false
      
      // Fix import paths
      const importResult = fixImports(content, relativeDir)
      if (importResult.fixed) {
        content = importResult.content
        fileChanged = true
      }
      
      // Fix self-imports (messaging.ts had self-import of approveAsk/denyAsk)
      // Actually the self-import in messaging uses the wrong path, which 
      // was already handled by fixImports. Let me check special cases.
      
      // Special case: messaging.ts has self-import at wrong path
      if (entry.name === "messaging.ts") {
        // The line: import { approveAsk, denyAsk } from "../../features/chat/task/utils/messaging"
        // After fixImports, it becomes: import { approveAsk, denyAsk } from "./messaging"
        // which is still a self-import. Remove it.
        const selfImportRegex = /import\s+\{[^}]*approveAsk[^}]*denyAsk[^}]*\}\s+from\s+["']\.\/messaging["'];\n?/g
        const newContent = content.replace(selfImportRegex, "")
        if (newContent !== content) {
          content = newContent
          fileChanged = true
        }
        
        // Also handle the self-import with just approveAsk
        const selfImportRegex2 = /import\s+\{[^}]*approveAsk[^}]*\}\s+from\s+["']\.\/messaging["'];\n?/g
        const newContent2 = content.replace(selfImportRegex2, "")
        if (newContent2 !== content) {
          content = newContent2
          fileChanged = true
        }
      }
      
      // Special case: delegation.ts self-import
      if (entry.name === "delegation.ts") {
        // Line 6: import { startSubtask, resumeAfterDelegation } from "./delegation"
        const selfImportDelegation = /import\s+\{[^}]*startSubtask[^}]*resumeAfterDelegation[^}]*\}\s+from\s+["']\.\/delegation["'];\n?/g
        const newContent = content.replace(selfImportDelegation, "")
        if (newContent !== content) {
          content = newContent
          fileChanged = true
        }
      }
      
      if (fileChanged) {
        console.log(`Fixed imports in: ${relativePath}`)
        writeFile(fullPath, content)
      }
    }
  }
}

processDirectory(SRC_DIR)
console.log("Done fixing import paths!")
