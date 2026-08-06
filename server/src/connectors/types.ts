export interface ConnectorCredentials {
  endpoint: string
  username: string
  password: string
}

export interface TestResult {
  success: boolean
  message: string
}

export interface SyncResult {
  assetsFound: number
  findingsFound: number
  details?: string
}

export interface ConnectorAdapter {
  name: string
  testConnection(creds: ConnectorCredentials): Promise<TestResult>
  sync(creds: ConnectorCredentials): Promise<SyncResult>
}