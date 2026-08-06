import { ConnectorAdapter, ConnectorCredentials, TestResult, SyncResult } from './types'

export function createMockAdapter(connectorName: string): ConnectorAdapter {
  return {
    name: connectorName,

    async testConnection(creds: ConnectorCredentials): Promise<TestResult> {
      if (!/^https?:\/\/.+/.test(creds.endpoint?.trim() || '')) {
        return { success: false, message: 'Endpoint must be a valid URL starting with http:// or https://' }
      }
      if (!creds.username?.trim() || !creds.password?.trim()) {
        return { success: false, message: 'Username and password are required' }
      }
      return { success: true, message: `Test to ${connectorName} succeeded ✓` }
    },

    async sync(creds: ConnectorCredentials): Promise<SyncResult> {
      // Real API access pending. Returns 0 until a real adapter replaces this mock.
      return { assetsFound: 0, findingsFound: 0, details: `${connectorName} sync ready — awaiting real API credentials to replace mock adapter` }
    },
  }
}