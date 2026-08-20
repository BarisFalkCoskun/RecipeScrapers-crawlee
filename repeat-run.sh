#!/usr/bin/env bash
# Second uncapped run of a source, then compare its keys and normalized content
# to the stored records: same keys and one document per key means the upsert is
# idempotent rather than duplicating.
set -u
SRC="$1"; DB="$2"
SP=/tmp/claude-1000/-home-scraper-scripts-RecipeScrapers-crawlee/4666e5ed-f703-4158-8b57-ec1ef9ebdb60/scratchpad
node /tmp/dump.js "$DB" "$SRC" - "$SP/scrapy/$SRC-before.json" >/dev/null
rm -rf "$SP/lanes/storage-rpt-$SRC"; mkdir -p "$SP/lanes/storage-rpt-$SRC"
CRAWLEE_STORAGE_DIR="$SP/lanes/storage-rpt-$SRC" CRAWLEE_MEMORY_MBYTES=1024 \
MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="$DB" \
  timeout 1800 npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$SRC" --force \
  --json-out "evidence/repeat-$SRC.json" > "evidence/repeat-$SRC.log" 2>&1
node /tmp/dump.js "$DB" "$SRC" - "$SP/scrapy/$SRC-after.json" >/dev/null
node -e '
const fs=require("fs"), sp=process.argv[1], s=process.argv[2];
const a=JSON.parse(fs.readFileSync(sp+"/scrapy/"+s+"-before.json","utf8"));
const b=JSON.parse(fs.readFileSync(sp+"/scrapy/"+s+"-after.json","utf8"));
const ka=a.map(r=>r.sourceRecipeKey).sort(), kb=b.map(r=>r.sourceRecipeKey).sort();
const dup=new Set(kb).size!==kb.length;
const na=new Map(a.map(r=>[r.sourceRecipeKey,JSON.stringify(r.normalized)]));
let same=0; for(const r of b) if(na.get(r.sourceRecipeKey)===JSON.stringify(r.normalized)) same++;
console.log(s.padEnd(18), "docs "+a.length+"->"+b.length,
  "keysIdentical="+(JSON.stringify(ka)===JSON.stringify(kb)),
  "duplicateKeys="+dup, "normalizedIdentical="+same+"/"+b.length);
' "$SP" "$SRC"
