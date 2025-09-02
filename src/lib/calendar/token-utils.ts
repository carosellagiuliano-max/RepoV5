/**
 * Calendar Token Management
 * Handles secure token generation, validation and management for calendar feeds
 */

import { createHash, createHmac, randomBytes, createCipher, createDecipher, timingSafeEqual } from 'crypto'

/**
 * Generates a cryptographically secure calendar token
 */
export function generateCalendarToken(): string {
  // Generate 32 random bytes and encode as hex (64 character string)
  return randomBytes(32).toString('hex')
}

/**
 * Hashes a calendar token for secure storage
 */
export function hashCalendarToken(token: string): string {
  const secret = process.env.CALENDAR_TOKEN_SECRET || 'default-secret-change-in-production'
  return createHmac('sha256', secret).update(token).digest('hex')
}

/**
 * Verifies a calendar token against its hash
 */
export function verifyCalendarToken(token: string, hash: string): boolean {
  try {
    const computedHash = hashCalendarToken(token)
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'))
  } catch (error) {
    return false
  }
}

/**
 * Encrypts sensitive data for storage (used for Google tokens)
 */
export function encryptData(data: string): string {
  const key = process.env.CALENDAR_ENCRYPTION_KEY || 'default-key-change-in-production-32'
  
  // Ensure key is 32 bytes
  const keyBuffer = Buffer.from(key.slice(0, 32).padEnd(32, '0'))
  
  const iv = randomBytes(16)
  const cipher = createCipher('aes-256-cbc', keyBuffer)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Prepend IV to encrypted data
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypts sensitive data from storage
 */
export function decryptData(encryptedData: string): string {
  const key = process.env.CALENDAR_ENCRYPTION_KEY || 'default-key-change-in-production-32'
  
  // Ensure key is 32 bytes
  const keyBuffer = Buffer.from(key.slice(0, 32).padEnd(32, '0'))
  
  const [ivHex, encrypted] = encryptedData.split(':')
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted data format')
  }
  
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = createDecipher('aes-256-cbc', keyBuffer)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Generates a time-limited token that expires after a certain duration
 */
export function generateExpiringToken(durationHours: number = 24 * 30): { token: string; expiresAt: string } {
  const token = generateCalendarToken()
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
  
  return { token, expiresAt }
}

/**
 * Checks if a token has expired
 */
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date() > new Date(expiresAt)
}

/**
 * Validates token format (must be 64 hex characters)
 */
export function isValidTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token)
}

/**
 * Generates a secure calendar feed URL
 */
export function generateCalendarFeedUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || process.env.VITE_SITE_URL || 'https://your-domain.netlify.app'
  return `${base}/.netlify/functions/calendar/ical/staff-feed?token=${token}`
}

/**
 * Rate limiting helper for calendar feeds
 */
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

export function checkRateLimit(identifier: string, maxRequests: number = 60, windowMs: number = 60 * 1000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)
  
  if (!entry || now > entry.resetTime) {
    // First request or window expired
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }
  
  if (entry.count >= maxRequests) {
    return false
  }
  
  entry.count++
  return true
}

/**
 * Cleans up expired rate limit entries
 */
export function cleanupRateLimit(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

// Clean up rate limit entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimit, 5 * 60 * 1000)
}