/**
 * Unit tests for dependency-scanner.ts
 */

import { describe, it, expect } from '@jest/globals'
import * as path from 'path'
import { scanDependencies } from '../src/dependency-scanner.js'

const fixturesPath = path.join(process.cwd(), '__fixtures__')

describe('dependency-scanner', () => {
  describe('scanDependencies', () => {
    it('should scan workflows and find all dependencies', async () => {
      const workflowsPath = path.join(fixturesPath, 'workflows')
      const dependencies = await scanDependencies(
        workflowsPath,
        [],
        fixturesPath
      )

      // Should find dependencies from both workflows and callable workflows
      expect(dependencies.size).toBeGreaterThanOrEqual(3)

      // Check for specific dependencies
      const depNames = Array.from(dependencies.values()).map((d) => d.name)
      expect(depNames).toContain('actions/checkout')
      expect(depNames).toContain('actions/setup-node')
    })

    it('should recursively scan local composite actions', async () => {
      const workflowsPath = path.join(fixturesPath, 'workflows')
      const dependencies = await scanDependencies(
        workflowsPath,
        [],
        fixturesPath
      )

      // Should find dependencies from nested composite actions
      const depNames = Array.from(dependencies.values()).map((d) => d.name)
      expect(depNames).toContain('actions/cache')
      expect(depNames).toContain('github/codeql-action/init')
    })

    it('should scan additional paths for composite actions', async () => {
      const workflowsPath = path.join(fixturesPath, 'workflows')
      const additionalPaths = ['actions']

      const dependencies = await scanDependencies(
        workflowsPath,
        additionalPaths,
        fixturesPath
      )

      // Should find dependencies from additional paths
      expect(dependencies.size).toBeGreaterThanOrEqual(3)
    })

    it('should handle empty workflow directory', async () => {
      const emptyPath = path.join(fixturesPath, 'non-existent')
      const dependencies = await scanDependencies(emptyPath, [], fixturesPath)

      expect(dependencies.size).toBe(0)
    })

    it('should deduplicate dependencies', async () => {
      const workflowsPath = path.join(fixturesPath, 'workflows')
      const dependencies = await scanDependencies(
        workflowsPath,
        [],
        fixturesPath
      )

      // Even if actions/checkout appears multiple times with same version,
      // it should only be counted once
      const checkoutDeps = Array.from(dependencies.entries()).filter(([key]) =>
        key.startsWith('actions/checkout@')
      )

      // Each unique version should appear only once
      const uniqueVersions = new Set(checkoutDeps.map(([key]) => key))
      expect(uniqueVersions.size).toBe(checkoutDeps.length)
    })
  })
})
