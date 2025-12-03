/**
 * Unit tests for src/fork-resolver.ts
 */
import { jest } from '@jest/globals'
import * as github from '../__fixtures__/github.js'

jest.unstable_mockModule('@actions/github', () => github)

const { ForkResolver } = await import('../src/fork-resolver.js')

describe('ForkResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('resolveDependencies', () => {
    it('Returns dependencies without fork info for non-fork organizations', async () => {
      const resolver = new ForkResolver({
        forkOrganizations: ['myorg'],
        token: 'test-token'
      })

      const dependencies = [
        {
          owner: 'actions',
          repo: 'checkout',
          ref: 'v4',
          uses: 'actions/checkout@v4'
        }
      ]

      const result = await resolver.resolveDependencies(dependencies)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        owner: 'actions',
        repo: 'checkout',
        ref: 'v4',
        original: undefined
      })
    })

    it('Resolves fork using GitHub API', async () => {
      github.mockOctokit.rest.repos.get.mockResolvedValueOnce({
        data: {
          fork: true,
          parent: {
            owner: { login: 'actions' },
            name: 'checkout'
          }
        }
      })

      const resolver = new ForkResolver({
        forkOrganizations: ['myorg'],
        token: 'test-token'
      })

      const dependencies = [
        {
          owner: 'myorg',
          repo: 'checkout',
          ref: 'v4',
          uses: 'myorg/checkout@v4'
        }
      ]

      const result = await resolver.resolveDependencies(dependencies)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        owner: 'myorg',
        repo: 'checkout',
        ref: 'v4',
        original: {
          owner: 'actions',
          repo: 'checkout'
        }
      })
      expect(github.mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'myorg',
        repo: 'checkout'
      })
    })

    it('Resolves fork using regex pattern', async () => {
      const resolver = new ForkResolver({
        forkOrganizations: ['myorg'],
        forkRegex: /^(?<org>myorg)\/actions-(?<repo>.+)$/,
        token: 'test-token'
      })

      const dependencies = [
        {
          owner: 'myorg',
          repo: 'actions-checkout',
          ref: 'v4',
          uses: 'myorg/actions-checkout@v4'
        }
      ]

      const result = await resolver.resolveDependencies(dependencies)

      expect(result).toHaveLength(1)
      expect(result[0].original).toEqual({
        owner: 'myorg',
        repo: 'checkout'
      })
    })

    it('Handles API errors gracefully', async () => {
      github.mockOctokit.rest.repos.get.mockRejectedValueOnce(
        new Error('API Error')
      )

      const resolver = new ForkResolver({
        forkOrganizations: ['myorg'],
        token: 'test-token'
      })

      const dependencies = [
        {
          owner: 'myorg',
          repo: 'checkout',
          ref: 'v4',
          uses: 'myorg/checkout@v4'
        }
      ]

      const result = await resolver.resolveDependencies(dependencies)

      expect(result).toHaveLength(1)
      expect(result[0].original).toBeUndefined()
    })

    it('Deduplicates dependencies with same owner/repo/ref', async () => {
      const resolver = new ForkResolver({
        forkOrganizations: [],
        token: 'test-token'
      })

      const dependencies = [
        {
          owner: 'actions',
          repo: 'checkout',
          ref: 'v4',
          uses: 'actions/checkout@v4'
        },
        {
          owner: 'actions',
          repo: 'checkout',
          ref: 'v4',
          uses: 'actions/checkout@v4'
        }
      ]

      const result = await resolver.resolveDependencies(dependencies)

      expect(result).toHaveLength(1)
    })
  })

  describe('regex pattern matching', () => {
    it('Correctly applies regex with named groups', async () => {
      const resolver = new ForkResolver({
        forkOrganizations: ['enterprise'],
        forkRegex: /^(?<org>[^/]+)\/actions-(?<repo>.+)$/,
        token: 'test-token'
      })

      const dependencies = [
        {
          owner: 'enterprise',
          repo: 'actions-checkout',
          ref: 'v4',
          uses: 'enterprise/actions-checkout@v4'
        }
      ]

      const result = await resolver.resolveDependencies(dependencies)

      expect(result).toHaveLength(1)
      expect(result[0].original).toEqual({
        owner: 'enterprise',
        repo: 'checkout'
      })
    })
  })
})
