/**
 * Calendar Integration Tests
 * Tests for iCal generation and token security
 */

import { generateICalFeed, generateTestICalFeed, validateICalFeed } from '../src/lib/calendar/ical-generator'
import { generateCalendarToken, hashCalendarToken, verifyCalendarToken, isValidTokenFormat } from '../src/lib/calendar/token-utils'

// Simple test runner
function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n🧪 Testing: ${name}`)
  try {
    const result = fn()
    if (result instanceof Promise) {
      result.then(() => console.log('✅ PASS')).catch(err => console.log('❌ FAIL:', err.message))
    } else {
      console.log('✅ PASS')
    }
  } catch (err) {
    console.log('❌ FAIL:', err instanceof Error ? err.message : String(err))
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

// Test iCal generation
test('generates valid test iCal feed', () => {
  const icalFeed = generateTestICalFeed()
  
  assert(icalFeed.includes('BEGIN:VCALENDAR'), 'Should start with BEGIN:VCALENDAR')
  assert(icalFeed.includes('END:VCALENDAR'), 'Should end with END:VCALENDAR')
  assert(icalFeed.includes('VERSION:2.0'), 'Should include version')
  assert(icalFeed.includes('PRODID:'), 'Should include product ID')
  assert(icalFeed.includes('BEGIN:VEVENT'), 'Should include at least one event')
  assert(icalFeed.includes('END:VEVENT'), 'Should close events')
  
  console.log('  - Feed length:', icalFeed.length, 'characters')
  console.log('  - Events found:', (icalFeed.match(/BEGIN:VEVENT/g) || []).length)
})

test('validates iCal feed format', () => {
  const icalFeed = generateTestICalFeed()
  const validation = validateICalFeed(icalFeed)
  
  assert(validation.valid, `Feed should be valid. Errors: ${validation.errors.join(', ')}`)
  assert(validation.errors.length === 0, 'Should have no validation errors')
})

test('generates secure calendar tokens', () => {
  const token1 = generateCalendarToken()
  const token2 = generateCalendarToken()
  
  assert(token1 !== token2, 'Tokens should be unique')
  assert(token1.length === 64, 'Token should be 64 characters long')
  assert(/^[a-f0-9]+$/i.test(token1), 'Token should be hexadecimal')
  assert(isValidTokenFormat(token1), 'Token should pass format validation')
  
  console.log('  - Token length:', token1.length)
  console.log('  - Sample token:', token1.substring(0, 16) + '...')
})

test('hashes and verifies calendar tokens correctly', () => {
  const token = generateCalendarToken()
  const hash1 = hashCalendarToken(token)
  const hash2 = hashCalendarToken(token)
  
  assert(hash1 === hash2, 'Same token should produce same hash')
  assert(verifyCalendarToken(token, hash1), 'Token should verify against its hash')
  assert(!verifyCalendarToken('invalid', hash1), 'Invalid token should not verify')
  assert(!verifyCalendarToken(token, 'invalid'), 'Invalid hash should not verify')
  
  console.log('  - Hash length:', hash1.length)
  console.log('  - Sample hash:', hash1.substring(0, 16) + '...')
})

test('validates token format correctly', () => {
  assert(isValidTokenFormat('a'.repeat(64)), 'Valid hex string should pass')
  assert(isValidTokenFormat('A'.repeat(64)), 'Uppercase hex should pass')
  assert(isValidTokenFormat('1234567890abcdef'.repeat(4)), 'Mixed hex should pass')
  
  assert(!isValidTokenFormat(''), 'Empty string should fail')
  assert(!isValidTokenFormat('short'), 'Short string should fail')
  assert(!isValidTokenFormat('g'.repeat(64)), 'Non-hex characters should fail')
  assert(!isValidTokenFormat('a'.repeat(63)), '63 chars should fail')
  assert(!isValidTokenFormat('a'.repeat(65)), '65 chars should fail')
})

test('handles edge cases in iCal generation', () => {
  const edgeCaseData = {
    staff: {
      id: 'staff-123',
      profile_id: 'profile-123',
      first_name: 'Test, Name; With\\Special\nChars',
      last_name: 'Staff',
      email: 'test@example.com'
    },
    appointments: [
      {
        id: 'apt-1',
        start_time: '2024-12-25T10:00:00Z', // Christmas
        end_time: '2024-12-25T11:00:00Z',
        status: 'confirmed',
        notes: 'Special chars: , ; \\ \n test',
        service: {
          name: 'Test, Service; With\\Special\nChars',
          duration_minutes: 60
        },
        customer: {
          first_name: 'Customer, Name; With\\Special\nChars',
          last_name: 'Test',
          email: 'customer@example.com'
        }
      }
    ]
  }
  
  const icalFeed = generateICalFeed(edgeCaseData)
  const validation = validateICalFeed(icalFeed)
  
  assert(validation.valid, `Feed with special characters should be valid. Errors: ${validation.errors.join(', ')}`)
  assert(icalFeed.includes('\\,'), 'Should escape commas')
  assert(icalFeed.includes('\\;'), 'Should escape semicolons')
  assert(icalFeed.includes('\\n'), 'Should escape newlines')
  assert(icalFeed.includes('\\\\'), 'Should escape backslashes')
})

// Run all tests
console.log('🚀 Running Calendar Integration Tests...')
console.log('====================================')

// Run tests and show summary
let passCount = 0
let totalCount = 0

// Override test function to count results
const originalTest = test
const testOverride = (name: string, fn: () => void | Promise<void>) => {
  totalCount++
  try {
    const result = fn()
    if (result instanceof Promise) {
      result.then(() => passCount++).catch(() => {})
    } else {
      passCount++
    }
  } catch (err) {
    // Failure already logged
  }
  originalTest(name, fn)
}

// Note: In a real environment, you would export these tests or use a proper test framework
console.log('\n📊 Test Summary:')
console.log(`Total tests: ${totalCount}`)
console.log(`Estimated passes: ${passCount}`)
console.log('\n💡 To run these tests properly, use a test framework like Jest or Vitest')
console.log('   Example: npm install --save-dev vitest && npx vitest calendar.test.ts')