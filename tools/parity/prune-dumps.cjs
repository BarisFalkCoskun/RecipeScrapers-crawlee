#!/usr/bin/env node
// Removes the parity dumps of sources that have already reached shadow_passed.
//
// Every comparison leaves a legacy dump, a crawlee dump and a scrapy log behind,
// and nothing was clearing them. Two days of rounds grew /tmp/danish-parity to
// 13 GB and filled the disk, which stopped MongoDB accepting connections and
// left the harness unable to write its own output. The dumps of a promoted
// source are not needed again - its evidence is in the registry, and a fresh
// comparison would re-crawl anyway - so they are the right thing to drop.
//
// Sources still being worked keep theirs. Run it before starting a pool.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const dir = process.env.PARITY_OUT_DIR || `${process.env.TMPDIR || "/tmp"}/danish-parity`;
if (!fs.existsSync(dir)) { console.log(`prune: ${dir} does not exist`); process.exit(0); }

const raw = execFileSync("npm", ["run", "--silent", "migration:status", "--", "--format", "json"],
  { cwd: path.join(__dirname, "..", ".."), maxBuffer: 1 << 28 }).toString();
const report = JSON.parse(raw.slice(raw.search(/[[{]/u)));
const done = new Set(report.sources.filter((s) => s.crawleeState === "shadow_passed").map((s) => s.source));

let files = 0;
let bytes = 0;
for (const name of fs.readdirSync(dir)) {
  const id = name.replace(/-crawlee\.json$|\.scrapy\.log$|\.json$/u, "");
  if (!done.has(id)) continue;
  const full = path.join(dir, name);
  try {
    bytes += fs.statSync(full).size;
    fs.unlinkSync(full);
    files += 1;
  } catch { /* already gone */ }
}
console.log(`prune: removed ${files} dumps for promoted sources, ${(bytes / 1e9).toFixed(2)} GB`);
