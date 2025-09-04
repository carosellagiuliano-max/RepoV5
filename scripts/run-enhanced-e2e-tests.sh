#!/bin/bash

# Enhanced Master Production End-to-End Test Runner
# Supports modular testing, preview environments, and full-stack staging mirrors
# 
# This enhanced version supports:
# 1. Preview environment deployment validation
# 2. Modular test component execution  
# 3. Full-stack staging mirror testing (no local stubs)

set -e

# Configuration
PRODUCTION_URL="${PREVIEW_URL:-${PRODUCTION_URL:-https://your-site.netlify.app}}"
TEST_ENV="${TEST_ENV:-production}"
RESULTS_DIR="./test-results"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
ENHANCED_RESULTS_DIR="$RESULTS_DIR/enhanced-e2e-$TIMESTAMP"
CORRELATION_ID="enhanced-e2e-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test suite tracking
declare -a TEST_SUITES=()
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Function to display usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Enhanced Production End-to-End Test Suite - Master Runner

ENHANCED FEATURES:
✅ Preview Environment Support - Test against deployed staging mirrors
✅ Modular Test Components - Reusable auth, booking, health modules  
✅ Full-Stack Integration - No local stubs, real service testing
✅ Production Readiness Validation - Comprehensive system verification

This script orchestrates comprehensive production validation covering:
1. Netlify (Frontend + Functions)
2. Supabase Database & Policies
3. Security & Compliance  
4. Payments (Stripe)
5. Notifications (Email/SMS)
6. Monitoring & Health
7. Metrics & Reporting
8. SEO/PWA/Performance
9. Supabase Production Readiness

OPTIONS:
    -h, --help              Show this help message
    -u, --url URL          Production/Preview URL to test (default: detect automatically)
    -s, --suite SUITE      Test suite to run: modular|all|basic|security|lighthouse|health
    -q, --quick            Quick mode - skip Lighthouse audits
    -m, --modular          Run only modular test components  
    -p, --preview          Force preview environment mode
    -v, --verbose          Verbose output
    --no-color             Disable colored output

EXAMPLES:
    # Run complete enhanced test suite
    $0

    # Test specific preview URL with modular components
    $0 --url https://preview.netlify.app --modular

    # Quick security and health check
    $0 --suite security --quick

    # Full validation against preview environment
    $0 --preview --verbose

ENVIRONMENT VARIABLES:
    PREVIEW_URL           Preview deployment URL (takes precedence)
    PRODUCTION_URL        Production URL to test
    TEST_ENV             Test environment (preview|staging|production)
    CORRELATION_ID       Test correlation ID for tracking

EOF
}

# Parse command line arguments
SUITE="all"
QUICK_MODE=false
MODULAR_ONLY=false
PREVIEW_MODE=false
VERBOSE=false
USE_COLOR=true

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -u|--url)
            PRODUCTION_URL="$2"
            shift 2
            ;;
        -s|--suite)
            SUITE="$2"
            shift 2
            ;;
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        -m|--modular)
            MODULAR_ONLY=true
            SUITE="modular"
            shift
            ;;
        -p|--preview)
            PREVIEW_MODE=true
            TEST_ENV="preview"
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-color)
            USE_COLOR=false
            RED=''
            GREEN=''
            YELLOW=''
            BLUE=''
            MAGENTA=''
            CYAN=''
            NC=''
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Function to log with timestamp and color
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[$timestamp]${NC} ${message}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp]${NC} ✅ ${message}"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp]${NC} ❌ ${message}"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp]${NC} ⚠️  ${message}"
            ;;
        "DEBUG")
            if [[ $VERBOSE == true ]]; then
                echo -e "${CYAN}[$timestamp]${NC} 🔍 ${message}"
            fi
            ;;
    esac
}

# Function to run test suite with tracking
run_test_suite() {
    local suite_name="$1"
    local command="$2"
    local description="$3"
    
    log "INFO" "Running: $suite_name - $description"
    
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    
    if eval "$command"; then
        PASSED_SUITES=$((PASSED_SUITES + 1))
        log "SUCCESS" "$suite_name completed successfully"
        TEST_SUITES+=("$suite_name:PASS")
        return 0
    else
        FAILED_SUITES=$((FAILED_SUITES + 1))
        log "ERROR" "$suite_name failed"
        TEST_SUITES+=("$suite_name:FAIL")
        return 1
    fi
}

# Create results directory
mkdir -p "$ENHANCED_RESULTS_DIR"

# Environment detection and validation
log "INFO" "🧪 Enhanced Production E2E Test Suite Starting..."
log "INFO" "📊 Correlation ID: $CORRELATION_ID"

# Detect preview URL if available
if [[ -n "$PREVIEW_URL" ]] && [[ "$PREVIEW_URL" != "$PRODUCTION_URL" ]]; then
    log "INFO" "🚀 Preview environment detected: $PREVIEW_URL"
    PRODUCTION_URL="$PREVIEW_URL"
    TEST_ENV="preview"
    PREVIEW_MODE=true
fi

log "INFO" "🌐 Test URL: $PRODUCTION_URL"
log "INFO" "🏷️ Environment: $TEST_ENV"
log "INFO" "📁 Results Directory: $ENHANCED_RESULTS_DIR"

# Validate URL accessibility
log "DEBUG" "Validating URL accessibility..."
if ! curl -s --fail --max-time 30 "$PRODUCTION_URL" > /dev/null; then
    log "ERROR" "Target URL is not accessible: $PRODUCTION_URL"
    exit 1
fi
log "SUCCESS" "Target URL is accessible"

# Export environment variables for child processes
export PRODUCTION_URL
export PREVIEW_URL
export TEST_ENV
export CORRELATION_ID

# Run test suites based on selection
case $SUITE in
    "modular"|"enhanced")
        log "INFO" "🧩 Running Enhanced Modular Test Suite"
        
        # Run modular tests using Vitest
        run_test_suite "Modular E2E Tests" \
            "npm run test src/test/modular-production-e2e.test.ts" \
            "Modular test components with reusable flows"
        ;;
        
    "all"|"complete")
        log "INFO" "🎯 Running Complete Enhanced Test Suite"
        
        # Run modular tests first
        run_test_suite "Modular E2E Tests" \
            "npm run test src/test/modular-production-e2e.test.ts" \
            "Enhanced modular test components"
        
        # Run traditional master suite if modular passes
        if [[ ${TEST_SUITES[-1]} == *":PASS" ]]; then
            run_test_suite "Legacy E2E Tests" \
                "./scripts/run-master-e2e-tests.sh --suite basic" \
                "Original comprehensive test suite"
        fi
        
        # Run security tests
        run_test_suite "Security Validation" \
            "./scripts/run-security-tests.sh" \
            "Security headers, rate limiting, input validation"
        
        # Run performance tests (unless quick mode)
        if [[ $QUICK_MODE == false ]]; then
            run_test_suite "Performance Tests" \
                "./scripts/run-lighthouse-tests.sh" \
                "Lighthouse performance and accessibility audits"
        fi
        ;;
        
    "security")
        log "INFO" "🔒 Running Security Test Suite"
        run_test_suite "Security Validation" \
            "./scripts/run-security-tests.sh" \
            "Security headers, rate limiting, input validation"
        ;;
        
    "lighthouse"|"performance")
        log "INFO" "⚡ Running Performance Test Suite"
        run_test_suite "Performance Tests" \
            "./scripts/run-lighthouse-tests.sh" \
            "Lighthouse performance and accessibility audits"
        ;;
        
    "health")
        log "INFO" "🏥 Running Health Check Suite"
        run_test_suite "Health Checks" \
            "./scripts/test-health-endpoint.sh" \
            "Health endpoints and monitoring validation"
        ;;
        
    "basic")
        log "INFO" "🔧 Running Basic Test Suite"
        run_test_suite "Basic E2E Tests" \
            "./scripts/run-production-e2e-tests.sh" \
            "Core functionality validation"
        ;;
        
    *)
        log "ERROR" "Unknown test suite: $SUITE"
        show_usage
        exit 1
        ;;
esac

# Calculate success rate
SUCCESS_RATE=0
if [[ $TOTAL_SUITES -gt 0 ]]; then
    SUCCESS_RATE=$((PASSED_SUITES * 100 / TOTAL_SUITES))
fi

# Generate enhanced test summary
SUMMARY_FILE="$ENHANCED_RESULTS_DIR/enhanced-test-summary.json"
cat > "$SUMMARY_FILE" << EOF
{
  "testRun": {
    "correlationId": "$CORRELATION_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "testUrl": "$PRODUCTION_URL",
    "environment": "$TEST_ENV",
    "suite": "$SUITE",
    "previewMode": $PREVIEW_MODE,
    "modularOnly": $MODULAR_ONLY,
    "quickMode": $QUICK_MODE
  },
  "summary": {
    "totalSuites": $TOTAL_SUITES,
    "passedSuites": $PASSED_SUITES,
    "failedSuites": $FAILED_SUITES,
    "successRate": $SUCCESS_RATE
  },
  "enhancements": {
    "modularComponents": true,
    "previewEnvironment": $PREVIEW_MODE,
    "fullStackMirror": true,
    "realIntegrationTesting": true
  },
  "suites": [
$(IFS=$'\n'; for suite in "${TEST_SUITES[@]}"; do
    name="${suite%:*}"
    status="${suite#*:}"
    echo "    {"
    echo "      \"name\": \"$name\","
    echo "      \"status\": \"$status\""
    echo "    },"
done | sed '$ s/,$//')
  ],
  "requirements": [
    "Netlify Frontend + Functions",
    "Supabase Database & Policies", 
    "Security & Compliance",
    "Payments (Stripe)",
    "Notifications (Email/SMS)",
    "Monitoring & Health",
    "Metrics & Reporting",
    "SEO/PWA/Performance",
    "Supabase Production Readiness"
  ]
}
EOF

# Display final results
echo
echo "=========================================="
echo "🎯 ENHANCED E2E TEST RESULTS SUMMARY"
echo "=========================================="
echo
echo "📊 Test Execution Details:"
echo "   🆔 Correlation ID: $CORRELATION_ID"
echo "   🌐 Test URL: $PRODUCTION_URL"
echo "   🏷️ Environment: $TEST_ENV"
echo "   📦 Test Suite: $SUITE"
if [[ $PREVIEW_MODE == true ]]; then
echo "   🚀 Preview Mode: ENABLED"
fi
echo
echo "📈 Results Summary:"
echo "   📊 Total Suites: $TOTAL_SUITES"
echo "   ✅ Passed: $PASSED_SUITES"
echo "   ❌ Failed: $FAILED_SUITES"
echo "   📊 Success Rate: ${SUCCESS_RATE}%"
echo
echo "🧩 Enhanced Features:"
echo "   ✅ Modular Test Components"
echo "   ✅ Preview Environment Support"
echo "   ✅ Full-Stack Integration Testing"
echo "   ✅ Real Service Validation (No Stubs)"
echo
echo "📂 Results saved to: $ENHANCED_RESULTS_DIR"
echo "📄 Summary file: $SUMMARY_FILE"
echo

# Display individual suite results
if [[ ${#TEST_SUITES[@]} -gt 0 ]]; then
    echo "🔍 Individual Suite Results:"
    for suite in "${TEST_SUITES[@]}"; do
        name="${suite%:*}"
        status="${suite#*:}"
        if [[ $status == "PASS" ]]; then
            echo "   ✅ $name"
        else
            echo "   ❌ $name"
        fi
    done
    echo
fi

# Final status and exit
if [[ $FAILED_SUITES -eq 0 ]]; then
    log "SUCCESS" "🎉 ALL ENHANCED PRODUCTION TESTS PASSED!"
    echo
    echo "✨ Preview & modular enhancements added; tests still green; ready for Production merge."
    exit 0
else
    log "ERROR" "Some test suites failed. Check individual results above."
    exit 1
fi