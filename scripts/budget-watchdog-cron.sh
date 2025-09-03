#!/bin/bash

# Budget Watchdog Cron Job
# Runs daily at 08:00 CET/CEST (accounts for DST)
# This script calls the budget-watchdog Netlify function

FUNCTION_URL="${NETLIFY_FUNCTION_URL:-https://schnittwerk-your-style.netlify.app/.netlify/functions}/budget-watchdog"
LOG_FILE="/tmp/budget-watchdog.log"

echo "$(date): Starting budget watchdog check..." >> "$LOG_FILE"

# Make the API call
response=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -w "%{http_code}")

http_code="${response: -3}"
response_body="${response%???}"

if [ "$http_code" -eq 200 ]; then
    echo "$(date): Budget watchdog completed successfully" >> "$LOG_FILE"
    echo "$response_body" >> "$LOG_FILE"
else
    echo "$(date): Budget watchdog failed with HTTP $http_code" >> "$LOG_FILE"
    echo "$response_body" >> "$LOG_FILE"
    
    # Could send alert to admin here
    # curl -X POST "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
    #   -H "Content-Type: application/json" \
    #   -d "{\"text\":\"Budget watchdog failed with HTTP $http_code: $response_body\"}"
fi

echo "$(date): Budget watchdog check completed" >> "$LOG_FILE"