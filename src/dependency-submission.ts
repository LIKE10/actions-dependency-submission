/**
 * Submit dependencies to GitHub's Dependency Submission API
 */

import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import { ActionDependency } from './types.js'

/**
 * Submit dependencies to GitHub
 */
export async function submitDependencies(
  token: string,
  owner: string,
  repo: string,
  dependencies: Map<string, ActionDependency>,
  sha: string,
  ref: string
): Promise<number> {
  if (dependencies.size === 0) {
    core.info('No dependencies to submit')
    return 0
  }

  const octokit = getOctokit(token)

  // Convert dependencies to the format required by the API
  const manifests: {
    [key: string]: {
      name: string
      file: { source_location: string }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolved: { [key: string]: any }
    }
  } = {}

  // Group dependencies by their source (workflow file)
  const manifestName = 'github-actions-workflows'
  manifests[manifestName] = {
    name: manifestName,
    file: {
      source_location: '.github/workflows/'
    },
    resolved: {}
  }

  for (const [key, dep] of dependencies) {
    const packageUrl = convertToPackageUrl(dep)
    manifests[manifestName].resolved[key] = {
      package_url: packageUrl,
      relationship: 'direct',
      scope: 'runtime',
      dependencies: []
    }
  }

  try {
    // Submit the dependency snapshot
    await octokit.rest.dependencyGraph.createRepositorySnapshot({
      owner,
      repo,
      version: 0,
      sha,
      ref,
      job: {
        correlator: `${process.env.GITHUB_WORKFLOW || 'workflow'}-${process.env.GITHUB_JOB || 'job'}`,
        id: process.env.GITHUB_RUN_ID || '0'
      },
      detector: {
        name: 'actions-dependency-submission',
        version: '1.0.0',
        url: 'https://github.com/jessehouwing/actions-dependency-submission'
      },
      scanned: new Date().toISOString(),
      manifests
    })

    core.info(`Successfully submitted ${dependencies.size} dependencies`)
    return dependencies.size
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Failed to submit dependencies: ${error.message}`)
      throw error
    }
    throw new Error('Failed to submit dependencies')
  }
}

/**
 * Convert an ActionDependency to a Package URL (purl)
 * Format: pkg:github/owner/repo@version
 */
function convertToPackageUrl(dep: ActionDependency): string {
  // GitHub Actions use the github ecosystem
  const name = dep.name.replace(/\//g, '%2F')
  return `pkg:github/${name}@${dep.version}`
}
