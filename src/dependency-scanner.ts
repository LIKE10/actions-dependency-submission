/**
 * Scan for dependencies across workflows and actions
 */

import * as path from 'path'
import * as fs from 'fs'
import { ActionDependency } from './types.js'
import {
  parseWorkflowFile,
  findWorkflowFiles,
  isCompositeAction
} from './workflow-parser.js'

/**
 * Scan all workflows and recursively find dependencies
 */
export async function scanDependencies(
  workflowPath: string,
  additionalPaths: string[],
  repoRoot: string
): Promise<Map<string, ActionDependency>> {
  const allDependencies = new Map<string, ActionDependency>()
  const processedFiles = new Set<string>()

  // Find all workflow files
  const workflowFiles = await findWorkflowFiles(workflowPath)

  // Queue for processing files
  const filesToProcess = [...workflowFiles]

  // Process all files, recursively adding local actions
  while (filesToProcess.length > 0) {
    const file = filesToProcess.shift()
    if (!file || processedFiles.has(file)) {
      continue
    }

    processedFiles.add(file)

    const parsed = await parseWorkflowFile(file)

    // Add all remote dependencies
    for (const dep of parsed.dependencies) {
      const key = `${dep.name}@${dep.version}`
      if (!allDependencies.has(key)) {
        allDependencies.set(key, dep)
      }
    }

    // Process local actions
    for (const localAction of parsed.localActions) {
      const localPath = resolveLocalPath(file, localAction, repoRoot)
      if (localPath) {
        const actionYml = await findActionYml(localPath)
        if (actionYml && !processedFiles.has(actionYml)) {
          const isComposite = await isCompositeAction(actionYml)
          if (isComposite) {
            filesToProcess.push(actionYml)
          }
        }
      }
    }

    // Process callable workflows
    for (const callableWorkflow of parsed.callableWorkflows) {
      const workflowPath = resolveLocalPath(file, callableWorkflow, repoRoot)
      if (workflowPath && !processedFiles.has(workflowPath)) {
        filesToProcess.push(workflowPath)
      }
    }
  }

  // Scan additional paths for composite actions and callable workflows
  for (const additionalPath of additionalPaths) {
    const fullPath = path.join(repoRoot, additionalPath)
    const files = await findWorkflowFiles(fullPath)

    for (const file of files) {
      if (processedFiles.has(file)) {
        continue
      }

      // Check if it's a composite action or callable workflow
      const isComposite = await isCompositeAction(file)
      if (isComposite) {
        processedFiles.add(file)
        const parsed = await parseWorkflowFile(file)

        // Add dependencies
        for (const dep of parsed.dependencies) {
          const key = `${dep.name}@${dep.version}`
          if (!allDependencies.has(key)) {
            allDependencies.set(key, dep)
          }
        }

        // Process nested local actions
        for (const localAction of parsed.localActions) {
          const localPath = resolveLocalPath(file, localAction, repoRoot)
          if (localPath) {
            const actionYml = await findActionYml(localPath)
            if (actionYml && !processedFiles.has(actionYml)) {
              const isComposite = await isCompositeAction(actionYml)
              if (isComposite) {
                filesToProcess.push(actionYml)
              }
            }
          }
        }
      }
    }
  }

  return allDependencies
}

/**
 * Resolve a local path reference relative to a workflow file
 */
function resolveLocalPath(
  workflowFile: string,
  localPath: string,
  repoRoot: string
): string | null {
  try {
    const workflowDir = path.dirname(workflowFile)
    const resolved = path.resolve(workflowDir, localPath)

    // Ensure the path is within the repository
    if (!resolved.startsWith(repoRoot)) {
      return null
    }

    return resolved
  } catch {
    return null
  }
}

/**
 * Find action.yml or action.yaml in a directory
 */
async function findActionYml(dirPath: string): Promise<string | null> {
  try {
    const stats = await fs.promises.stat(dirPath)

    // If it's a file and ends with .yml or .yaml, return it
    if (
      stats.isFile() &&
      (dirPath.endsWith('.yml') || dirPath.endsWith('.yaml'))
    ) {
      return dirPath
    }

    // If it's a directory, look for action.yml or action.yaml
    if (stats.isDirectory()) {
      const actionYml = path.join(dirPath, 'action.yml')
      const actionYaml = path.join(dirPath, 'action.yaml')

      if (await fileExists(actionYml)) {
        return actionYml
      }
      if (await fileExists(actionYaml)) {
        return actionYaml
      }
    }
  } catch {
    // Path doesn't exist
  }

  return null
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}
