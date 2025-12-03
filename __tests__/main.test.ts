/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mock modules
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/dependency-scanner.js', () => ({
  scanDependencies: jest.fn(() => Promise.resolve(new Map()))
}))
jest.unstable_mockModule('../src/dependency-submission.js', () => ({
  submitDependencies: jest.fn(() => Promise.resolve(0))
}))

const { run } = await import('../src/main.js')
const { scanDependencies } = await import('../src/dependency-scanner.js')
const { submitDependencies } = await import('../src/dependency-submission.js')

describe('main.ts', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()

    // Set up environment variables
    process.env = {
      ...originalEnv,
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_SHA: 'abc123',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_WORKSPACE: '/workspace'
    }

    // Set default inputs
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'token':
          return 'test-token'
        case 'workflow-path':
          return '.github/workflows'
        case 'additional-paths':
          return ''
        default:
          return ''
      }
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should scan and submit dependencies successfully', async () => {
    const mockDeps = new Map([
      [
        'actions/checkout@v4',
        {
          name: 'actions/checkout',
          version: 'v4',
          type: 'action' as const,
          source: 'actions/checkout@v4'
        }
      ]
    ])

    ;(scanDependencies as jest.Mock).mockResolvedValue(mockDeps)
    ;(submitDependencies as jest.Mock).mockResolvedValue(1)

    await run()

    expect(scanDependencies).toHaveBeenCalledWith(
      '/workspace/.github/workflows',
      [],
      '/workspace'
    )

    expect(submitDependencies).toHaveBeenCalledWith(
      'test-token',
      'owner',
      'repo',
      mockDeps,
      'abc123',
      'refs/heads/main'
    )

    expect(core.setOutput).toHaveBeenCalledWith('dependency-count', '1')
  })

  it('should handle additional paths', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'token':
          return 'test-token'
        case 'workflow-path':
          return '.github/workflows'
        case 'additional-paths':
          return 'actions,custom/actions'
        default:
          return ''
      }
    })
    ;(scanDependencies as jest.Mock).mockResolvedValue(new Map())
    ;(submitDependencies as jest.Mock).mockResolvedValue(0)

    await run()

    expect(scanDependencies).toHaveBeenCalledWith(
      '/workspace/.github/workflows',
      ['actions', 'custom/actions'],
      '/workspace'
    )
  })

  it('should handle missing environment variables', async () => {
    delete process.env.GITHUB_REPOSITORY

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'GITHUB_REPOSITORY environment variable is not set'
    )
  })

  it('should handle scanning errors', async () => {
    const error = new Error('Scan failed')
    ;(scanDependencies as jest.Mock).mockRejectedValue(error)

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('Scan failed')
  })
})
