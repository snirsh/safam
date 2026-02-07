#!/usr/bin/env bash
# Test the cron scrape endpoint locally.
# Usage: ./scripts/test-cron.sh
# Requires: dev server running on localhost:3000 and CRON_SECRET in .env.local

set -euo pipefail

SECRET="${CRON_SECRET:-local-test-secret}"
URL="http://localhost:3000/api/cron/scrape"

echo "Calling $URL ..."
curl -s -w "\nHTTP status: %{http_code}\n" \
  -X GET "$URL" \
  -H "Authorization: Bearer $SECRET" | jq . 2>/dev/null || cat
