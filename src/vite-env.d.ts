/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface GoogleTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
  expires_in?: string
}

interface GoogleTokenClient {
  requestAccessToken: (override?: { prompt?: string }) => void
  callback: (response: GoogleTokenResponse) => void
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (response: GoogleTokenResponse) => void
        }) => GoogleTokenClient
        revoke: (token: string, done?: () => void) => void
      }
    }
  }
}
