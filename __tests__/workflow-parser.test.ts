/**
 * Unit tests for src/workflow-parser.ts
 */
import { describe, it, expect, beforeEach } from '@jest/globals'
import { WorkflowParser } from '../src/workflow-parser.js'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

describe('WorkflowParser', () => {
  let parser: WorkflowParser
  let tempDir: string

  beforeEach(() => {
    parser = new WorkflowParser()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-test-'))
  })

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('parseUsesString', () => {
    it('Parses standard action reference', () => {
      const result = parser.parseUsesString('actions/checkout@v4')

      expect(result).toEqual({
        owner: 'actions',
        repo: 'checkout',
        ref: 'v4',
        uses: 'actions/checkout@v4'
      })
    })

    it('Parses action reference with path', () => {
      const result = parser.parseUsesString('actions/checkout/path@v4')

      expect(result).toEqual({
        owner: 'actions',
        repo: 'checkout',
        ref: 'v4',
        uses: 'actions/checkout/path@v4'
      })
    })

    it('Parses action reference with SHA', () => {
      const result = parser.parseUsesString(
        'actions/checkout@abc123def456abc123def456abc123def456abcd'
      )

      expect(result).toEqual({
        owner: 'actions',
        repo: 'checkout',
        ref: 'abc123def456abc123def456abc123def456abcd',
        uses: 'actions/checkout@abc123def456abc123def456abc123def456abcd'
      })
    })

    it('Returns null for invalid uses string', () => {
      expect(parser.parseUsesString('invalid')).toBeNull()
      expect(parser.parseUsesString('./local-action')).toBeNull()
      expect(parser.parseUsesString('docker://image:tag')).toBeNull()
    })
  })

  describe('parseWorkflowFile', () => {
    it('Extracts dependencies from valid workflow file', async () => {
      const workflowContent = `
name: Test Workflow
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: myorg/custom-action@v1
`
      const workflowFile = path.join(tempDir, 'test.yml')
      fs.writeFileSync(workflowFile, workflowContent)

      const result = await parser.parseWorkflowFile(workflowFile)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        owner: 'actions',
        repo: 'checkout',
        ref: 'v4',
        uses: 'actions/checkout@v4'
      })
      expect(result[1]).toEqual({
        owner: 'actions',
        repo: 'setup-node',
        ref: 'v4',
        uses: 'actions/setup-node@v4'
      })
      expect(result[2]).toEqual({
        owner: 'myorg',
        repo: 'custom-action',
        ref: 'v1',
        uses: 'myorg/custom-action@v1'
      })
    })

    it('Returns empty array for workflow without actions', async () => {
      const workflowContent = `
name: Test Workflow
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
`
      const workflowFile = path.join(tempDir, 'test.yml')
      fs.writeFileSync(workflowFile, workflowContent)

      const result = await parser.parseWorkflowFile(workflowFile)

      expect(result).toHaveLength(0)
    })

    it('Handles invalid workflow file', async () => {
      const workflowFile = path.join(tempDir, 'invalid.yml')
      fs.writeFileSync(workflowFile, 'invalid yaml: [')

      const result = await parser.parseWorkflowFile(workflowFile)

      expect(result).toHaveLength(0)
    })
  })

  describe('parseWorkflowDirectory', () => {
    it('Scans directory and extracts all dependencies', async () => {
      const workflow1 = `
name: Workflow 1
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`
      const workflow2 = `
name: Workflow 2
on: pull_request
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
`
      fs.writeFileSync(path.join(tempDir, 'workflow1.yml'), workflow1)
      fs.writeFileSync(path.join(tempDir, 'workflow2.yaml'), workflow2)

      const result = await parser.parseWorkflowDirectory(tempDir)

      expect(result).toHaveLength(2)
      expect(result[0].repo).toBe('checkout')
      expect(result[1].repo).toBe('setup-node')
    })

    it('Returns empty array for non-existent directory', async () => {
      const result = await parser.parseWorkflowDirectory('/non-existent')

      expect(result).toHaveLength(0)
    })
  })
})
