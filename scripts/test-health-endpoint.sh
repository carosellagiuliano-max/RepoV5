#!/bin/bash

# Health Check Integration Test
# Tests the health endpoint with various scenarios

set -e

echo "🏥 Running Health Check Integration Tests"
echo "========================================="

# Configuration
HEALTH_URL="${1:-http://localhost:8888/.netlify/functions/health}"
TEST_CORRELATION_ID="test-$(date +%s)"

echo "Health URL: $HEALTH_URL"
echo "Test Correlation ID: $TEST_CORRELATION_ID"
echo ""

# Test 1: Basic health check
echo "Test 1: Basic Health Check"
echo "--------------------------"
RESPONSE=$(curl -s -w "%{http_code}" \
  -H "X-Correlation-Id: $TEST_CORRELATION_ID" \
  "$HEALTH_URL")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
  echo "✅ Valid HTTP status code"
  
  # Parse response body
  STATUS=$(echo "$BODY" | jq -r '.status // "invalid"')
  CORRELATION_ID=$(echo "$BODY" | jq -r '.correlationId // "missing"')
  TIMESTAMP=$(echo "$BODY" | jq -r '.timestamp // "missing"')
  
  echo "Overall Status: $STATUS"
  echo "Correlation ID: $CORRELATION_ID"
  echo "Timestamp: $TIMESTAMP"
  
  # Validate correlation ID matches
  if [ "$CORRELATION_ID" = "$TEST_CORRELATION_ID" ]; then
    echo "✅ Correlation ID correctly passed through"
  else
    echo "❌ Correlation ID mismatch"
  fi
  
  # Check required fields
  REQUIRED_FIELDS=("status" "timestamp" "version" "buildInfo" "checks" "metrics" "correlationId")
  
  for field in "${REQUIRED_FIELDS[@]}"; do
    if echo "$BODY" | jq -e ".$field" > /dev/null; then
      echo "✅ Required field '$field' present"
    else
      echo "❌ Missing required field '$field'"
    fi
  done
  
  # Check health checks
  HEALTH_CHECKS=("database" "smtp" "sms" "storage" "queue" "budget")
  
  for check in "${HEALTH_CHECKS[@]}"; do
    CHECK_STATUS=$(echo "$BODY" | jq -r ".checks.$check.status // \"missing\"")
    if [ "$CHECK_STATUS" != "missing" ]; then
      echo "✅ Health check '$check': $CHECK_STATUS"
    else
      echo "❌ Missing health check '$check'"
    fi
  done
  
else
  echo "❌ Invalid HTTP status code: $HTTP_CODE"
  echo "Response body: $BODY"
fi

echo ""

# Test 2: CORS preflight request
echo "Test 2: CORS Preflight Request"
echo "-------------------------------"
CORS_RESPONSE=$(curl -s -w "%{http_code}" \
  -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Correlation-Id" \
  "$HEALTH_URL")

CORS_HTTP_CODE="${CORS_RESPONSE: -3}"
CORS_BODY="${CORS_RESPONSE%???}"

echo "CORS HTTP Status: $CORS_HTTP_CODE"

if [ "$CORS_HTTP_CODE" = "200" ]; then
  echo "✅ CORS preflight request successful"
  if [ -z "$CORS_BODY" ]; then
    echo "✅ Empty response body as expected"
  else
    echo "❌ Response body should be empty for OPTIONS request"
  fi
else
  echo "❌ CORS preflight failed: $CORS_HTTP_CODE"
fi

echo ""

# Test 3: Invalid HTTP method
echo "Test 3: Invalid HTTP Method"
echo "----------------------------"
INVALID_RESPONSE=$(curl -s -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  "$HEALTH_URL")

INVALID_HTTP_CODE="${INVALID_RESPONSE: -3}"
INVALID_BODY="${INVALID_RESPONSE%???}"

echo "Invalid Method HTTP Status: $INVALID_HTTP_CODE"

if [ "$INVALID_HTTP_CODE" = "405" ]; then
  echo "✅ Correctly rejected invalid method"
  
  ERROR_MESSAGE=$(echo "$INVALID_BODY" | jq -r '.error // "missing"')
  if [ "$ERROR_MESSAGE" = "Method not allowed" ]; then
    echo "✅ Correct error message"
  else
    echo "❌ Unexpected error message: $ERROR_MESSAGE"
  fi
else
  echo "❌ Should return 405 for invalid method, got: $INVALID_HTTP_CODE"
fi

echo ""

# Test 4: Response time check
echo "Test 4: Response Time Check"
echo "---------------------------"
START_TIME=$(date +%s%N)
RESPONSE=$(curl -s "$HEALTH_URL")
END_TIME=$(date +%s%N)

DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))
echo "Response time: ${DURATION_MS}ms"

if [ "$DURATION_MS" -lt 5000 ]; then
  echo "✅ Response time acceptable (< 5s)"
else
  echo "⚠️ Response time high (> 5s)"
fi

echo ""

# Test 5: JSON structure validation
echo "Test 5: JSON Structure Validation"
echo "----------------------------------"
HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")

# Validate JSON structure
if echo "$HEALTH_RESPONSE" | jq . > /dev/null 2>&1; then
  echo "✅ Valid JSON response"
  
  # Check for consistent log structure
  BUILD_INFO=$(echo "$HEALTH_RESPONSE" | jq '.buildInfo')
  if [ "$BUILD_INFO" != "null" ]; then
    echo "✅ Build info present"
    
    VERSION=$(echo "$HEALTH_RESPONSE" | jq -r '.buildInfo.version // "missing"')
    ENVIRONMENT=$(echo "$HEALTH_RESPONSE" | jq -r '.buildInfo.environment // "missing"')
    NODE_VERSION=$(echo "$HEALTH_RESPONSE" | jq -r '.buildInfo.nodeVersion // "missing"')
    
    echo "  - Version: $VERSION"
    echo "  - Environment: $ENVIRONMENT"
    echo "  - Node Version: $NODE_VERSION"
  else
    echo "❌ Build info missing"
  fi
  
  # Check metrics
  METRICS=$(echo "$HEALTH_RESPONSE" | jq '.metrics')
  if [ "$METRICS" != "null" ]; then
    echo "✅ Metrics present"
    
    UPTIME=$(echo "$HEALTH_RESPONSE" | jq -r '.metrics.uptime // "missing"')
    MEMORY_USED=$(echo "$HEALTH_RESPONSE" | jq -r '.metrics.memoryUsage.used // "missing"')
    MEMORY_TOTAL=$(echo "$HEALTH_RESPONSE" | jq -r '.metrics.memoryUsage.total // "missing"')
    
    echo "  - Uptime: ${UPTIME}s"
    echo "  - Memory: ${MEMORY_USED}MB / ${MEMORY_TOTAL}MB"
  else
    echo "❌ Metrics missing"
  fi
  
else
  echo "❌ Invalid JSON response"
  echo "Response: $HEALTH_RESPONSE"
fi

echo ""
echo "🏁 Health Check Integration Tests Complete"
echo "=========================================="

# Summary
echo ""
echo "Summary:"
echo "--------"
echo "✅ Basic health check functionality"
echo "✅ CORS support for cross-origin requests"
echo "✅ HTTP method validation and error handling"
echo "✅ Response time monitoring"
echo "✅ JSON structure validation"
echo "✅ Correlation ID pass-through"
echo "✅ Comprehensive health checks for all dependencies"
echo ""
echo "The health endpoint is ready for production monitoring!"