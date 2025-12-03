import { jest } from '@jest/globals'

const mockReposGet = jest.fn()
const mockCreateSnapshot = jest.fn()

export const getOctokit = jest.fn(() => ({
  rest: {
    repos: {
      get: mockReposGet
    },
    dependencyGraph: {
      createRepositorySnapshot: mockCreateSnapshot
    }
  }
}))

// Export the mocks so tests can access them
export const mockOctokit = {
  rest: {
    repos: {
      get: mockReposGet
    },
    dependencyGraph: {
      createRepositorySnapshot: mockCreateSnapshot
    }
  }
}

export const context = {
  sha: 'test-sha-123',
  ref: 'refs/heads/main',
  repo: {
    owner: 'test-owner',
    repo: 'test-repo'
  }
}
