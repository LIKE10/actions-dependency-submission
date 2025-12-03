/**
 * Types for GitHub Actions dependency submission
 */

/**
 * Represents a dependency on a GitHub Action
 */
export interface ActionDependency {
  name: string
  version: string
  type: 'action'
  source?: string
}

/**
 * Represents a parsed workflow or action file
 */
export interface WorkflowFile {
  path: string
  dependencies: ActionDependency[]
  localActions: string[]
  callableWorkflows: string[]
}

/**
 * Package URL (purl) for dependency submission
 */
export interface PackageUrl {
  name: string
  version: string
  purl: string
}
