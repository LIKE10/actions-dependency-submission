import * as core from '@actions/core'
import * as path from 'path'
import { scanDependencies } from './dependency-scanner.js'
import { submitDependencies } from './dependency-submission.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('token', { required: true })
    const workflowPath = core.getInput('workflow-path') || '.github/workflows'
    const additionalPathsInput = core.getInput('additional-paths') || ''

    // Parse additional paths (comma or newline separated)
    const additionalPaths = additionalPathsInput
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    // Get repository information from environment
    const repository = process.env.GITHUB_REPOSITORY
    if (!repository) {
      throw new Error('GITHUB_REPOSITORY environment variable is not set')
    }

    const [owner, repo] = repository.split('/')
    const sha = process.env.GITHUB_SHA
    const ref = process.env.GITHUB_REF

    if (!sha || !ref) {
      throw new Error(
        'GITHUB_SHA or GITHUB_REF environment variable is not set'
      )
    }

    // Get repository root
    const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd()
    const fullWorkflowPath = path.join(repoRoot, workflowPath)

    core.info(`Scanning workflows in: ${fullWorkflowPath}`)
    if (additionalPaths.length > 0) {
      core.info(`Additional paths: ${additionalPaths.join(', ')}`)
    }

    // Scan for dependencies
    const dependencies = await scanDependencies(
      fullWorkflowPath,
      additionalPaths,
      repoRoot
    )

    core.info(`Found ${dependencies.size} unique dependencies`)

    // Submit dependencies to GitHub
    const count = await submitDependencies(
      token,
      owner,
      repo,
      dependencies,
      sha,
      ref
    )

    // Set output
    core.setOutput('dependency-count', count.toString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
