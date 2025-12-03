/**
 * Unit tests for workflow-parser.ts
 */

import { describe, it, expect } from '@jest/globals'
import * as path from 'path'
import {
  parseWorkflowFile,
  findWorkflowFiles,
  isCompositeAction
} from '../src/workflow-parser.js'

const fixturesPath = path.join(process.cwd(), '__fixtures__')

describe('workflow-parser', () => {
  describe('parseWorkflowFile', () => {
    it('should parse a workflow file and extract dependencies', async () => {
      const workflowPath = path.join(
        fixturesPath,
        'workflows',
        'test-workflow.yml'
      )
      const result = await parseWorkflowFile(workflowPath)

      expect(result.dependencies).toHaveLength(2)
      expect(result.dependencies[0].name).toBe('actions/checkout')
      expect(result.dependencies[0].version).toBe('v4')
      expect(result.dependencies[1].name).toBe('actions/setup-node')
      expect(result.dependencies[1].version).toBe('v4')
    })

    it('should extract local action references', async () => {
      const workflowPath = path.join(
        fixturesPath,
        'workflows',
        'test-workflow.yml'
      )
      const result = await parseWorkflowFile(workflowPath)

      expect(result.localActions).toHaveLength(1)
      expect(result.localActions[0]).toBe('./../actions/local-action')
    })

    it('should extract callable workflow references', async () => {
      const workflowPath = path.join(
        fixturesPath,
        'workflows',
        'test-workflow.yml'
      )
      const result = await parseWorkflowFile(workflowPath)

      expect(result.callableWorkflows).toHaveLength(1)
      expect(result.callableWorkflows[0]).toBe('./callable-workflow.yml')
    })

    it('should parse a composite action and extract dependencies', async () => {
      const actionPath = path.join(
        fixturesPath,
        '.github',
        'actions',
        'local-action',
        'action.yml'
      )
      const result = await parseWorkflowFile(actionPath)

      expect(result.dependencies).toHaveLength(1)
      expect(result.dependencies[0].name).toBe('actions/cache')
      expect(result.dependencies[0].version).toBe('v3')
    })

    it('should handle nested local actions in composite actions', async () => {
      const actionPath = path.join(
        fixturesPath,
        '.github',
        'actions',
        'local-action',
        'action.yml'
      )
      const result = await parseWorkflowFile(actionPath)

      expect(result.localActions).toHaveLength(1)
      expect(result.localActions[0]).toBe('../another-action')
    })
  })

  describe('isCompositeAction', () => {
    it('should identify a composite action', async () => {
      const actionPath = path.join(
        fixturesPath,
        '.github',
        'actions',
        'local-action',
        'action.yml'
      )
      const result = await isCompositeAction(actionPath)

      expect(result).toBe(true)
    })

    it('should return false for a workflow file', async () => {
      const workflowPath = path.join(
        fixturesPath,
        'workflows',
        'test-workflow.yml'
      )
      const result = await isCompositeAction(workflowPath)

      expect(result).toBe(false)
    })
  })

  describe('findWorkflowFiles', () => {
    it('should find all workflow files in a directory', async () => {
      const workflowsPath = path.join(fixturesPath, 'workflows')
      const files = await findWorkflowFiles(workflowsPath)

      expect(files.length).toBeGreaterThanOrEqual(2)
      expect(files.some((f) => f.endsWith('test-workflow.yml'))).toBe(true)
      expect(files.some((f) => f.endsWith('callable-workflow.yml'))).toBe(true)
    })

    it('should return empty array for non-existent directory', async () => {
      const nonExistentPath = path.join(fixturesPath, 'non-existent')
      const files = await findWorkflowFiles(nonExistentPath)

      expect(files).toEqual([])
    })
  })
})
