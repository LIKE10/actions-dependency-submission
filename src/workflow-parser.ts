/**
 * Parse GitHub Actions workflow files to extract dependencies
 */

import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'yaml'
import { ActionDependency, WorkflowFile } from './types.js'

/**
 * Parse a workflow or action YAML file and extract action dependencies
 */
export async function parseWorkflowFile(
  filePath: string
): Promise<WorkflowFile> {
  const content = await fs.promises.readFile(filePath, 'utf-8')
  const parsed = yaml.parse(content)

  const dependencies: ActionDependency[] = []
  const localActions: string[] = []
  const callableWorkflows: string[] = []

  if (!parsed) {
    return { path: filePath, dependencies, localActions, callableWorkflows }
  }

  // Check if this is a composite action
  if (parsed.runs && parsed.runs.using === 'composite') {
    extractFromCompositeAction(parsed, dependencies, localActions)
  }
  // Check if this is a workflow (has jobs)
  else if (parsed.jobs) {
    extractFromWorkflow(parsed, dependencies, localActions, callableWorkflows)
  }

  return { path: filePath, dependencies, localActions, callableWorkflows }
}

/**
 * Extract dependencies from a composite action
 */
function extractFromCompositeAction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: any,
  dependencies: ActionDependency[],
  localActions: string[]
): void {
  if (!action.runs || !action.runs.steps) {
    return
  }

  for (const step of action.runs.steps) {
    if (step.uses) {
      const dep = parseActionUses(step.uses)
      if (dep) {
        if (dep.type === 'local' && dep.path) {
          localActions.push(dep.path)
        } else {
          dependencies.push({
            name: dep.name,
            version: dep.version,
            type: 'action',
            source: step.uses
          })
        }
      }
    }
  }
}

/**
 * Extract dependencies from a workflow file
 */
function extractFromWorkflow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow: any,
  dependencies: ActionDependency[],
  localActions: string[],
  callableWorkflows: string[]
): void {
  for (const jobName in workflow.jobs) {
    const job = workflow.jobs[jobName]

    // Check for callable workflows (uses at job level)
    if (job.uses) {
      const dep = parseWorkflowUses(job.uses)
      if (dep) {
        if (dep.type === 'local' && dep.path) {
          callableWorkflows.push(dep.path)
        } else {
          dependencies.push({
            name: dep.name,
            version: dep.version,
            type: 'action',
            source: job.uses
          })
        }
      }
    }

    // Check steps for action dependencies
    if (job.steps) {
      for (const step of job.steps) {
        if (step.uses) {
          const dep = parseActionUses(step.uses)
          if (dep) {
            if (dep.type === 'local' && dep.path) {
              localActions.push(dep.path)
            } else {
              dependencies.push({
                name: dep.name,
                version: dep.version,
                type: 'action',
                source: step.uses
              })
            }
          }
        }
      }
    }
  }
}

/**
 * Parse a 'uses' field from a workflow or composite action
 * Formats: owner/repo@ref, owner/repo/path@ref, ./path, docker://image
 */
function parseActionUses(uses: string): {
  type: 'remote' | 'local' | 'docker'
  name: string
  version: string
  path?: string
} | null {
  // Skip docker actions
  if (uses.startsWith('docker://')) {
    return null
  }

  // Local action reference (starts with ./ or ../ or .\)
  if (
    uses.startsWith('./') ||
    uses.startsWith('../') ||
    uses.startsWith('.\\') ||
    uses.startsWith('..\\')
  ) {
    return {
      type: 'local',
      name: uses,
      version: '',
      path: uses
    }
  }

  // Remote action reference (owner/repo@ref or owner/repo/path@ref)
  const match = uses.match(/^([^@]+)@(.+)$/)
  if (match) {
    const [, nameWithPath, ref] = match
    return {
      type: 'remote',
      name: nameWithPath,
      version: ref
    }
  }

  return null
}

/**
 * Parse a 'uses' field from a job (callable workflow)
 * Formats: owner/repo/.github/workflows/workflow.yml@ref, ./path/workflow.yml
 */
function parseWorkflowUses(uses: string): {
  type: 'remote' | 'local'
  name: string
  version: string
  path?: string
} | null {
  // Local workflow reference (starts with ./ or ../ or .\)
  if (
    uses.startsWith('./') ||
    uses.startsWith('../') ||
    uses.startsWith('.\\') ||
    uses.startsWith('..\\')
  ) {
    return {
      type: 'local',
      name: uses,
      version: '',
      path: uses
    }
  }

  // Remote workflow reference (owner/repo/.github/workflows/workflow.yml@ref)
  const match = uses.match(/^([^@]+)@(.+)$/)
  if (match) {
    const [, nameWithPath, ref] = match
    return {
      type: 'remote',
      name: nameWithPath,
      version: ref
    }
  }

  return null
}

/**
 * Check if a file is a composite action
 */
export async function isCompositeAction(filePath: string): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const parsed = yaml.parse(content)
    return parsed?.runs?.using === 'composite'
  } catch {
    return false
  }
}

/**
 * Check if a file is a callable workflow
 */
export async function isCallableWorkflow(filePath: string): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const parsed = yaml.parse(content)
    // A callable workflow has workflow_call trigger
    return (
      parsed?.on?.workflow_call !== undefined ||
      parsed?.true?.workflow_call !== undefined
    )
  } catch {
    return false
  }
}

/**
 * Recursively scan a directory for workflow files
 */
export async function findWorkflowFiles(dirPath: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await findWorkflowFiles(fullPath)
        files.push(...subFiles)
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))
      ) {
        files.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files
}
