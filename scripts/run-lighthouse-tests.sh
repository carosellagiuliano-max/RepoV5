#!/bin/bash

# Lighthouse & Core Web Vitals Test Script
# Automated performance, accessibility, SEO, and best practices audit
# 
# This script is part of the production E2E test suite for Issue #48
# and specifically addresses requirement #8: SEO/PWA/Performance validation

set -e

# Configuration
PRODUCTION_URL="${PRODUCTION_URL:-https://your-site.netlify.app}"
RESULTS_DIR="${RESULTS_DIR:-./test-results}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LIGHTHOUSE_OUTPUT_DIR="$RESULTS_DIR/lighthouse-$TIMESTAMP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Lighthouse & Core Web Vitals Analysis${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""
echo "Production URL: $PRODUCTION_URL"
echo "Results Directory: $LIGHTHOUSE_OUTPUT_DIR"
echo ""

# Create results directory
mkdir -p "$LIGHTHOUSE_OUTPUT_DIR"

# Check if Lighthouse is installed
if ! command -v lighthouse &> /dev/null; then
    echo -e "${YELLOW}⚠️  Lighthouse not found. Installing...${NC}"
    if command -v npm &> /dev/null; then
        npm install -g lighthouse
    else
        echo -e "${RED}❌ npm not found. Please install Node.js and npm first.${NC}"
        exit 1
    fi
fi

# Function to run Lighthouse audit
run_lighthouse_audit() {
    local url="$1"
    local output_name="$2"
    local device="$3"
    
    echo -e "${BLUE}Running Lighthouse audit for $device...${NC}"
    
    local lighthouse_cmd="lighthouse '$url' \
        --output html,json \
        --output-path '$LIGHTHOUSE_OUTPUT_DIR/$output_name' \
        --chrome-flags='--headless --no-sandbox --disable-gpu' \
        --quiet"
    
    if [ "$device" = "mobile" ]; then
        lighthouse_cmd="$lighthouse_cmd --preset=perf --form-factor=mobile --throttling-method=devtools"
    else
        lighthouse_cmd="$lighthouse_cmd --preset=perf --form-factor=desktop --throttling-method=devtools"
    fi
    
    eval "$lighthouse_cmd"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Lighthouse audit completed for $device${NC}"
        return 0
    else
        echo -e "${RED}❌ Lighthouse audit failed for $device${NC}"
        return 1
    fi
}

# Function to extract and validate scores
validate_lighthouse_scores() {
    local json_file="$1"
    local device="$2"
    
    if [ ! -f "$json_file" ]; then
        echo -e "${RED}❌ Lighthouse JSON report not found: $json_file${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Analyzing Lighthouse scores for $device...${NC}"
    
    # Extract scores using jq
    local performance_score=$(jq -r '.categories.performance.score * 100' "$json_file" 2>/dev/null || echo "0")
    local accessibility_score=$(jq -r '.categories.accessibility.score * 100' "$json_file" 2>/dev/null || echo "0")
    local best_practices_score=$(jq -r '.categories["best-practices"].score * 100' "$json_file" 2>/dev/null || echo "0")
    local seo_score=$(jq -r '.categories.seo.score * 100' "$json_file" 2>/dev/null || echo "0")
    local pwa_score=$(jq -r '.categories.pwa.score * 100' "$json_file" 2>/dev/null || echo "0")
    
    # Extract Core Web Vitals
    local lcp=$(jq -r '.audits["largest-contentful-paint"].numericValue' "$json_file" 2>/dev/null || echo "0")
    local inp=$(jq -r '.audits["interaction-to-next-paint"].numericValue' "$json_file" 2>/dev/null || echo "0")
    local cls=$(jq -r '.audits["cumulative-layout-shift"].numericValue' "$json_file" 2>/dev/null || echo "0")
    local fcp=$(jq -r '.audits["first-contentful-paint"].numericValue' "$json_file" 2>/dev/null || echo "0")
    local speed_index=$(jq -r '.audits["speed-index"].numericValue' "$json_file" 2>/dev/null || echo "0")
    
    # Convert milliseconds to seconds for readability
    lcp=$(echo "scale=2; $lcp / 1000" | bc -l 2>/dev/null || echo "$lcp")
    inp=$(echo "scale=0; $inp" | bc -l 2>/dev/null || echo "$inp")
    fcp=$(echo "scale=2; $fcp / 1000" | bc -l 2>/dev/null || echo "$fcp")
    speed_index=$(echo "scale=2; $speed_index / 1000" | bc -l 2>/dev/null || echo "$speed_index")
    
    echo ""
    echo -e "${BLUE}Lighthouse Scores ($device):${NC}"
    echo "========================="
    
    # Performance Score
    if (( $(echo "$performance_score >= 90" | bc -l) )); then
        echo -e "Performance: ${GREEN}${performance_score}% ✅${NC}"
    elif (( $(echo "$performance_score >= 50" | bc -l) )); then
        echo -e "Performance: ${YELLOW}${performance_score}% ⚠️${NC}"
    else
        echo -e "Performance: ${RED}${performance_score}% ❌${NC}"
    fi
    
    # Accessibility Score
    if (( $(echo "$accessibility_score >= 90" | bc -l) )); then
        echo -e "Accessibility: ${GREEN}${accessibility_score}% ✅${NC}"
    elif (( $(echo "$accessibility_score >= 50" | bc -l) )); then
        echo -e "Accessibility: ${YELLOW}${accessibility_score}% ⚠️${NC}"
    else
        echo -e "Accessibility: ${RED}${accessibility_score}% ❌${NC}"
    fi
    
    # Best Practices Score
    if (( $(echo "$best_practices_score >= 90" | bc -l) )); then
        echo -e "Best Practices: ${GREEN}${best_practices_score}% ✅${NC}"
    elif (( $(echo "$best_practices_score >= 50" | bc -l) )); then
        echo -e "Best Practices: ${YELLOW}${best_practices_score}% ⚠️${NC}"
    else
        echo -e "Best Practices: ${RED}${best_practices_score}% ❌${NC}"
    fi
    
    # SEO Score
    if (( $(echo "$seo_score >= 90" | bc -l) )); then
        echo -e "SEO: ${GREEN}${seo_score}% ✅${NC}"
    elif (( $(echo "$seo_score >= 50" | bc -l) )); then
        echo -e "SEO: ${YELLOW}${seo_score}% ⚠️${NC}"
    else
        echo -e "SEO: ${RED}${seo_score}% ❌${NC}"
    fi
    
    # PWA Score
    if (( $(echo "$pwa_score >= 90" | bc -l) )); then
        echo -e "PWA: ${GREEN}${pwa_score}% ✅${NC}"
    elif (( $(echo "$pwa_score >= 50" | bc -l) )); then
        echo -e "PWA: ${YELLOW}${pwa_score}% ⚠️${NC}"
    else
        echo -e "PWA: ${RED}${pwa_score}% ❌${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Core Web Vitals ($device):${NC}"
    echo "======================="
    
    # Largest Contentful Paint (LCP)
    if (( $(echo "$lcp <= 2.5" | bc -l) )); then
        echo -e "LCP (Largest Contentful Paint): ${GREEN}${lcp}s ✅${NC}"
    elif (( $(echo "$lcp <= 4.0" | bc -l) )); then
        echo -e "LCP (Largest Contentful Paint): ${YELLOW}${lcp}s ⚠️${NC}"
    else
        echo -e "LCP (Largest Contentful Paint): ${RED}${lcp}s ❌${NC}"
    fi
    
    # Interaction to Next Paint (INP)
    if (( $(echo "$inp <= 200" | bc -l) )); then
        echo -e "INP (Interaction to Next Paint): ${GREEN}${inp}ms ✅${NC}"
    elif (( $(echo "$inp <= 500" | bc -l) )); then
        echo -e "INP (Interaction to Next Paint): ${YELLOW}${inp}ms ⚠️${NC}"
    else
        echo -e "INP (Interaction to Next Paint): ${RED}${inp}ms ❌${NC}"
    fi
    
    # Cumulative Layout Shift (CLS)
    if (( $(echo "$cls <= 0.1" | bc -l) )); then
        echo -e "CLS (Cumulative Layout Shift): ${GREEN}${cls} ✅${NC}"
    elif (( $(echo "$cls <= 0.25" | bc -l) )); then
        echo -e "CLS (Cumulative Layout Shift): ${YELLOW}${cls} ⚠️${NC}"
    else
        echo -e "CLS (Cumulative Layout Shift): ${RED}${cls} ❌${NC}"
    fi
    
    # Additional metrics
    echo ""
    echo -e "${BLUE}Additional Metrics ($device):${NC}"
    echo "========================="
    echo -e "First Contentful Paint: ${fcp}s"
    echo -e "Speed Index: ${speed_index}s"
    
    # Create summary object for JSON report
    cat > "$LIGHTHOUSE_OUTPUT_DIR/summary-$device.json" << EOF
{
  "device": "$device",
  "timestamp": "$(date -Iseconds)",
  "url": "$PRODUCTION_URL",
  "scores": {
    "performance": $performance_score,
    "accessibility": $accessibility_score,
    "bestPractices": $best_practices_score,
    "seo": $seo_score,
    "pwa": $pwa_score
  },
  "coreWebVitals": {
    "lcp": $lcp,
    "inp": $inp,
    "cls": $cls,
    "fcp": $fcp,
    "speedIndex": $speed_index
  },
  "thresholds": {
    "performance": { "good": 90, "needsImprovement": 50 },
    "accessibility": { "good": 90, "needsImprovement": 50 },
    "bestPractices": { "good": 90, "needsImprovement": 50 },
    "seo": { "good": 90, "needsImprovement": 50 },
    "pwa": { "good": 90, "needsImprovement": 50 },
    "lcp": { "good": 2.5, "needsImprovement": 4.0 },
    "inp": { "good": 200, "needsImprovement": 500 },
    "cls": { "good": 0.1, "needsImprovement": 0.25 }
  }
}
EOF
    
    echo ""
}

# Function to generate comprehensive report
generate_lighthouse_report() {
    local report_file="$LIGHTHOUSE_OUTPUT_DIR/lighthouse-comprehensive-report.html"
    
    echo -e "${BLUE}Generating comprehensive Lighthouse report...${NC}"
    
    cat > "$report_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lighthouse Comprehensive Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #4285f4; color: white; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .score-good { color: #0f9d58; font-weight: bold; }
        .score-average { color: #ff9800; font-weight: bold; }
        .score-poor { color: #f44336; font-weight: bold; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .device-section { margin: 20px 0; }
        .links { margin: 20px 0; }
        .links a { display: inline-block; margin: 10px; padding: 10px 20px; 
                   background: #4285f4; color: white; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Lighthouse Performance Report</h1>
        <p>Production End-to-End Test Suite - Performance Validation</p>
        <p><strong>URL:</strong> Production Site</p>
        <p><strong>Generated:</strong> $(date)</p>
    </div>
    
    <div class="section">
        <h2>📊 Test Overview</h2>
        <p>This report analyzes the production website's performance, accessibility, best practices, SEO, and PWA capabilities across both mobile and desktop devices.</p>
        
        <h3>🎯 Success Criteria</h3>
        <ul>
            <li><strong>Performance:</strong> ≥90% (Good), ≥50% (Needs Improvement)</li>
            <li><strong>Accessibility:</strong> ≥90% (Good), ≥50% (Needs Improvement)</li>
            <li><strong>Best Practices:</strong> ≥90% (Good), ≥50% (Needs Improvement)</li>
            <li><strong>SEO:</strong> ≥90% (Good), ≥50% (Needs Improvement)</li>
            <li><strong>PWA:</strong> ≥90% (Good), ≥50% (Needs Improvement)</li>
        </ul>
        
        <h3>🚀 Core Web Vitals Thresholds</h3>
        <ul>
            <li><strong>LCP (Largest Contentful Paint):</strong> ≤2.5s (Good), ≤4.0s (Needs Improvement)</li>
            <li><strong>INP (Interaction to Next Paint):</strong> ≤200ms (Good), ≤500ms (Needs Improvement)</li>
            <li><strong>CLS (Cumulative Layout Shift):</strong> ≤0.1 (Good), ≤0.25 (Needs Improvement)</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>📱 Mobile Results</h2>
        <div id="mobile-results">
            <p><em>Mobile results will be populated after Lighthouse audit completion.</em></p>
        </div>
    </div>
    
    <div class="section">
        <h2>🖥️ Desktop Results</h2>
        <div id="desktop-results">
            <p><em>Desktop results will be populated after Lighthouse audit completion.</em></p>
        </div>
    </div>
    
    <div class="section">
        <h2>🔗 Detailed Reports</h2>
        <div class="links">
            <a href="./mobile-report.html" target="_blank">📱 Mobile Detailed Report</a>
            <a href="./desktop-report.html" target="_blank">🖥️ Desktop Detailed Report</a>
        </div>
    </div>
    
    <div class="section">
        <h2>📝 Recommendations</h2>
        <h3>Performance Optimization</h3>
        <ul>
            <li>Optimize images and use modern formats (WebP, AVIF)</li>
            <li>Implement code splitting and lazy loading</li>
            <li>Minimize main thread work</li>
            <li>Optimize Cumulative Layout Shift</li>
        </ul>
        
        <h3>Accessibility Improvements</h3>
        <ul>
            <li>Ensure sufficient color contrast</li>
            <li>Add proper ARIA labels and descriptions</li>
            <li>Implement keyboard navigation</li>
            <li>Provide alt text for images</li>
        </ul>
        
        <h3>SEO Enhancements</h3>
        <ul>
            <li>Optimize meta descriptions and titles</li>
            <li>Implement structured data</li>
            <li>Ensure mobile-friendly design</li>
            <li>Optimize Core Web Vitals</li>
        </ul>
    </div>
</body>
</html>
EOF
    
    echo -e "${GREEN}✅ Comprehensive report generated: $report_file${NC}"
}

# Main execution
echo -e "${BLUE}Starting Lighthouse analysis...${NC}"

# Install bc for calculations if not available
if ! command -v bc &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installing bc for calculations...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y bc
    elif command -v brew &> /dev/null; then
        brew install bc
    fi
fi

# Run audits for both mobile and desktop
echo ""
echo -e "${BLUE}📱 Running Mobile Audit${NC}"
echo "====================="
if run_lighthouse_audit "$PRODUCTION_URL" "mobile-report" "mobile"; then
    validate_lighthouse_scores "$LIGHTHOUSE_OUTPUT_DIR/mobile-report.json" "mobile"
fi

echo ""
echo -e "${BLUE}🖥️  Running Desktop Audit${NC}"
echo "======================="
if run_lighthouse_audit "$PRODUCTION_URL" "desktop-report" "desktop"; then
    validate_lighthouse_scores "$LIGHTHOUSE_OUTPUT_DIR/desktop-report.json" "desktop"
fi

# Generate comprehensive report
echo ""
generate_lighthouse_report

# Create final summary
echo ""
echo -e "${BLUE}📋 Final Summary${NC}"
echo "==============="

if [ -f "$LIGHTHOUSE_OUTPUT_DIR/mobile-report.html" ] || [ -f "$LIGHTHOUSE_OUTPUT_DIR/desktop-report.html" ]; then
    echo -e "${GREEN}✅ Lighthouse analysis completed successfully${NC}"
    echo ""
    echo "Generated Reports:"
    echo "📱 Mobile Report: $LIGHTHOUSE_OUTPUT_DIR/mobile-report.html"
    echo "🖥️  Desktop Report: $LIGHTHOUSE_OUTPUT_DIR/desktop-report.html"
    echo "📊 Comprehensive Report: $LIGHTHOUSE_OUTPUT_DIR/lighthouse-comprehensive-report.html"
    echo ""
    echo "JSON Data:"
    echo "📱 Mobile Summary: $LIGHTHOUSE_OUTPUT_DIR/summary-mobile.json"
    echo "🖥️  Desktop Summary: $LIGHTHOUSE_OUTPUT_DIR/summary-desktop.json"
    echo ""
    echo -e "${GREEN}🎉 Performance validation completed. Review reports for detailed insights.${NC}"
else
    echo -e "${RED}❌ Lighthouse analysis failed. Check the error messages above.${NC}"
    exit 1
fi