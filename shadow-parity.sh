#!/usr/bin/env bash
# Run one source's legacy Scrapy spider in isolation and compare its output to
# the stored Crawlee records for the same source. Scrapy writes to a temporary
# file with item pipelines disabled, so no production write happens.
set -u
SRC="$1"; DB="${2:-crawlee_danish_jsonld_wprm_20260820}"
SP=/tmp/claude-1000/-home-scraper-scripts-RecipeScrapers-crawlee/4666e5ed-f703-4158-8b57-ec1ef9ebdb60/scratchpad
mkdir -p "$SP/scrapy"
cd /home/scraper/scripts/RecipeScrapers
timeout 2400 .venv/bin/scrapy crawl "$SRC" \
  -O "$SP/scrapy/$SRC.json" \
  -s ITEM_PIPELINES='{}' -s RECIPE_FEED_EXPORT_ENABLED=0 -s LOG_LEVEL=ERROR \
  > "$SP/scrapy/$SRC.scrapy.log" 2>&1
echo "scrapy exit=$? for $SRC"
cd /home/scraper/scripts/RecipeScrapers-crawlee
node /tmp/dump.js "$DB" "$SRC" - "$SP/scrapy/$SRC-crawlee.json" >/dev/null
echo "--- $SRC ---"
node /tmp/cmp2.js "$SP/scrapy/$SRC.json" "$SP/scrapy/$SRC-crawlee.json"
