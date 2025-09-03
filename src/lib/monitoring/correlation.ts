/**
 * Frontend Correlation ID Management
 * 
 * Ensures correlation IDs flow through all frontend requests
 * and are consistent across the application lifecycle.
 */

import { v4 as uuidv4 } from 'uuid'

class CorrelationManager {
  private static instance: CorrelationManager
  private currentCorrelationId: string | null = null
  private sessionCorrelationId: string | null = null

  private constructor() {
    // Initialize session correlation ID on first load
    this.sessionCorrelationId = this.generateCorrelationId()
    
    // Set initial request correlation ID
    this.currentCorrelationId = this.generateCorrelationId()
  }

  public static getInstance(): CorrelationManager {
    if (!CorrelationManager.instance) {
      CorrelationManager.instance = new CorrelationManager()
    }
    return CorrelationManager.instance
  }

  private generateCorrelationId(): string {
    return uuidv4()
  }

  /**
   * Get the current correlation ID for this request/operation
   */
  public getCurrentCorrelationId(): string {
    if (!this.currentCorrelationId) {
      this.currentCorrelationId = this.generateCorrelationId()
    }
    return this.currentCorrelationId
  }

  /**
   * Get the session correlation ID (consistent for the entire session)
   */
  public getSessionCorrelationId(): string {
    return this.sessionCorrelationId!
  }

  /**
   * Start a new request with a fresh correlation ID
   */
  public startNewRequest(): string {
    this.currentCorrelationId = this.generateCorrelationId()
    return this.currentCorrelationId
  }

  /**
   * Set a specific correlation ID (useful when received from server)
   */
  public setCorrelationId(correlationId: string): void {
    this.currentCorrelationId = correlationId
  }

  /**
   * Get headers with correlation ID for API requests
   */
  public getCorrelationHeaders(): Record<string, string> {
    return {
      'X-Correlation-Id': this.getCurrentCorrelationId()
    }
  }

  /**
   * Create a fetch wrapper that automatically includes correlation ID
   */
  public createFetch() {
    return async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers)
      
      // Add correlation ID if not already present
      if (!headers.has('X-Correlation-Id')) {
        headers.set('X-Correlation-Id', this.getCurrentCorrelationId())
      }

      const response = await fetch(input, {
        ...init,
        headers
      })

      // Extract correlation ID from response if present
      const responseCorrelationId = response.headers.get('X-Correlation-Id')
      if (responseCorrelationId) {
        this.setCorrelationId(responseCorrelationId)
      }

      return response
    }
  }

  /**
   * Create an Axios request interceptor
   */
  public createAxiosInterceptor() {
    return {
      request: (config: any) => {
        if (!config.headers['X-Correlation-Id']) {
          config.headers['X-Correlation-Id'] = this.getCurrentCorrelationId()
        }
        return config
      },
      response: (response: any) => {
        const correlationId = response.headers['x-correlation-id']
        if (correlationId) {
          this.setCorrelationId(correlationId)
        }
        return response
      }
    }
  }
}

// Export singleton instance
export const correlationManager = CorrelationManager.getInstance()

// Export convenience functions
export const getCurrentCorrelationId = () => correlationManager.getCurrentCorrelationId()
export const getSessionCorrelationId = () => correlationManager.getSessionCorrelationId()
export const startNewRequest = () => correlationManager.startNewRequest()
export const getCorrelationHeaders = () => correlationManager.getCorrelationHeaders()

// Export enhanced fetch function
export const fetchWithCorrelation = correlationManager.createFetch()

// React hook for using correlation IDs in components
export const useCorrelationId = () => {
  return {
    currentId: correlationManager.getCurrentCorrelationId(),
    sessionId: correlationManager.getSessionCorrelationId(),
    startNewRequest: () => correlationManager.startNewRequest(),
    getHeaders: () => correlationManager.getCorrelationHeaders()
  }
}