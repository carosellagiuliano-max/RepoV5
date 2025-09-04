/**
 * Shared type definitions for monitoring and logging system
 */

import { LogLevel, LogContext } from './logger'

// Logger interface for consistent typing
export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  fatal(message: string, context?: LogContext): void
  setCorrelationId(id: string): void
  getCorrelationId(): string
}

// Health check result structure
export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn'
  timestamp: string
  duration: number
  componentId?: string
  componentType?: string
  observedValue?: string | number
  observedUnit?: string
  targetValue?: string | number
  targetUnit?: string
  output?: string
  error?: string
}

// Monitoring context for function handlers
export interface MonitoringContext {
  correlationId: string
  logger: Logger
  startTime: number
  functionName: string
}

// Request context structure for Netlify functions
export interface RequestContext {
  requestId: string
  stage?: string
  accountId?: string
  resourceId?: string
  apiId?: string
  httpMethod?: string
  resourcePath?: string
  path?: string
  protocol?: string
  requestTime?: string
  requestTimeEpoch?: number
  identity?: {
    cognitoIdentityPoolId?: string
    accountId?: string
    cognitoIdentityId?: string
    caller?: string
    sourceIp?: string
    principalOrgId?: string
    accessKey?: string
    cognitoAuthenticationType?: string
    cognitoAuthenticationProvider?: string
    userArn?: string
    userAgent?: string
    user?: string
  }
  domainName?: string
  domainPrefix?: string
  extendedRequestId?: string
}

// Alert payload structure
export interface AlertPayload {
  alertType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: string
  correlationId?: string
  metadata?: Record<string, unknown>
  source?: string
  tags?: string[]
}

// Correlation context for request tracking
export interface CorrelationContext {
  correlationId: string
  parentId?: string
  traceId?: string
  spanId?: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

// Axios request/response configuration types
export interface AxiosRequestConfig {
  url?: string
  method?: string
  baseURL?: string
  headers?: Record<string, string>
  params?: Record<string, unknown>
  data?: unknown
  timeout?: number
  withCredentials?: boolean
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'document' | 'stream'
  maxContentLength?: number
  maxBodyLength?: number
  validateStatus?: (status: number) => boolean
  paramsSerializer?: (params: Record<string, unknown>) => string
  [key: string]: unknown
}

export interface AxiosResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: AxiosRequestConfig
  request?: unknown
}

// Test mock types
export interface MockSupabaseClient {
  from: (table: string) => MockQueryBuilder
  auth: {
    getUser: () => Promise<{ data: { user: unknown } | null; error: unknown }>
  }
  storage: {
    from: (bucket: string) => MockStorageBucket
  }
}

export interface MockQueryBuilder {
  select: (columns?: string) => MockQueryBuilder
  insert: (values: unknown) => MockQueryBuilder
  update: (values: unknown) => MockQueryBuilder
  delete: () => MockQueryBuilder
  eq: (column: string, value: unknown) => MockQueryBuilder
  single: () => Promise<{ data: unknown; error: unknown }>
  [key: string]: unknown
}

export interface MockStorageBucket {
  list: () => Promise<{ data: unknown[]; error: unknown }>
  upload: (path: string, file: unknown) => Promise<{ data: unknown; error: unknown }>
  download: (path: string) => Promise<{ data: unknown; error: unknown }>
}

// Test response types
export interface TestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data?: unknown
  json?: () => Promise<unknown>
  text?: () => Promise<string>
}

export interface TestRequestConfig {
  url: string
  method?: string
  headers?: Record<string, string>
  data?: unknown
  timeout?: number
}