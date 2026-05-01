# New Server Scraper Setup

This guide sets up a fresh Ubuntu server for `RecipeScrapers-crawlee`.
It assumes Ubuntu 24.04 LTS, a server with at least 8 GB RAM, and MongoDB running locally on the same machine.

`valdemarsro.dk` is intentionally not in the active seed list because it has already been scraped separately.

## 1. Connect To The Server

From your local machine:

```bash
ssh root@YOUR_SERVER_IP
```

Update the base system:

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg git build-essential screen htop
```

If the upgrade installs a new kernel, reboot before continuing:

```bash
sudo reboot
```

Reconnect after the reboot.

## 2. Install Node.js 22

Install Node.js from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs
```

Verify:

```bash
node -v
npm -v
```

Expected: Node should be `v22.x`.

## 3. Install MongoDB 8

Confirm the Ubuntu codename:

```bash
. /etc/os-release
echo "$VERSION_CODENAME"
```

Expected for Ubuntu 24.04: `noble`.

Install MongoDB Community Edition:

```bash
sudo apt-get install -y gnupg curl

curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg \
  --dearmor

. /etc/os-release
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod
```

Verify MongoDB:

```bash
sudo systemctl status mongod --no-pager
mongosh --quiet --eval 'db.runCommand({ ping: 1 })'
```

Expected: `ok: 1`.

Do not expose MongoDB publicly. The scraper expects local MongoDB at `mongodb://localhost:27017`.

## 4. Clone The Repo

Choose where the repo should live. The examples below use `/root/RecipeScrapers-crawlee`.

```bash
cd /root
git clone YOUR_REPO_URL RecipeScrapers-crawlee
cd /root/RecipeScrapers-crawlee
```

If the repo already exists:

```bash
cd /root/RecipeScrapers-crawlee
git pull
```

Verify the code version:

```bash
git log -1 --oneline
```

## 5. Verify Valdemarsro Is Disabled

The active seed list should not include `valdemarsro.dk`.

```bash
if grep -n 'valdemarsro' src/discovery/seeds.ts; then
  echo "ERROR: valdemarsro.dk is still active in seeds.ts"
  exit 1
else
  echo "OK: valdemarsro.dk is not an active seed"
fi
```

## 6. Install Project Dependencies

```bash
npm ci
npx playwright install --with-deps chromium
```

The project also has a `postinstall` hook for Playwright, but running the Playwright install command explicitly makes the setup state obvious.

Verify Playwright:

```bash
npx playwright --version
```

## 7. Configure Environment

Create `.env`:

```bash
cp .env.example .env
```

Open it:

```bash
nano .env
```

Use these defaults unless you have a reason to change them:

```bash
MONGODB_URI=mongodb://localhost:27017
DB_NAME=crawlee
```

For the first run on the new server, leave `CRAWLEE_MEMORY_MBYTES` unset. We want Crawlee and the diagnostic logs to show the natural memory behavior on the new machine.

## 8. Build And Test

Run the full local verification:

```bash
npm run build
npm test
npm run smoke:crawl
```

Expected:

- TypeScript build passes.
- Unit tests pass.
- Smoke crawl passes against the local fixture site.

## 9. Run The First Real Crawl With Diagnostics

Use `screen` so the crawl keeps running if SSH disconnects:

```bash
screen -S recipe-crawler
```

Inside the screen session:

```bash
cd /root/RecipeScrapers-crawlee
mkdir -p logs
RUN_ID=$(date -u +%Y%m%d-%H%M%S)

(
  echo "=== crawl run $RUN_ID ==="
  date -Is
  git rev-parse HEAD
  node -v
  npm -v
  free -h
  df -h
  env | sort | grep -E '^(CRAWL|CHEERIO|PLAYWRIGHT|CRAWLEE|MONGODB|DB_NAME|NODE_OPTIONS)=' || true

  PLAYWRIGHT_MEMORY_DIAGNOSTICS_INTERVAL=25 npm start
  STATUS=$?

  echo "=== crawl exit status: $STATUS ==="
  date -Is
  free -h

  mongosh --quiet crawlee --eval '
    printjson({
      pages: db.pages.countDocuments(),
      recipes: db.recipes.countDocuments(),
      crawlRuns: db.crawl_runs.countDocuments(),
      recipeLanguages: db.recipes.aggregate([
        {$group: {_id: "$language", count: {$sum: 1}}},
        {$sort: {count: -1}}
      ]).toArray(),
      latestRun: db.crawl_runs.findOne({}, {sort: {finishedAt: -1}})
    })
  '

  exit $STATUS
) 2>&1 | tee "logs/full-crawl-$RUN_ID.log"
```

Detach from screen without stopping the crawl:

```text
Ctrl-a d
```

Reattach later:

```bash
screen -r recipe-crawler
```

## 10. Monitor While It Runs

In another SSH session:

```bash
cd /root/RecipeScrapers-crawlee
tail -f logs/full-crawl-*.log
```

Check MongoDB counts:

```bash
mongosh --quiet crawlee --eval '
printjson({
  pages: db.pages.countDocuments(),
  recipes: db.recipes.countDocuments(),
  crawlRuns: db.crawl_runs.countDocuments(),
  languages: db.recipes.aggregate([
    {$group: {_id: "$language", count: {$sum: 1}}},
    {$sort: {count: -1}}
  ]).toArray()
})
'
```

Check memory:

```bash
free -h
ps -eo pid,ppid,comm,rss,%cpu --sort=-rss | head -25
```

The log lines named `Playwright memory diagnostics` are the most useful for diagnosing whether memory is stable.

## 11. After The Run

Keep the log file. It contains the crawler output, memory diagnostics, and final MongoDB counts.

Send back:

- `logs/full-crawl-<RUN_ID>.log`
- The final `git log -1 --oneline`
- The final output of:

```bash
mongosh --quiet crawlee --eval '
printjson({
  pages: db.pages.countDocuments(),
  recipes: db.recipes.countDocuments(),
  crawlRuns: db.crawl_runs.countDocuments(),
  recipeLanguages: db.recipes.aggregate([
    {$group: {_id: "$language", count: {$sum: 1}}},
    {$sort: {count: -1}}
  ]).toArray()
})
'
```

## Optional: Run With PM2 Later

For the first diagnostic crawl, `screen` plus `tee` is easier to reason about.
After the setup is proven, PM2 is useful for auto-restart:

```bash
sudo npm install -g pm2
pm2 start "npm start" --name recipe-crawler
pm2 save
pm2 startup
```

Use the exact command printed by `pm2 startup`.

## References

- MongoDB official Ubuntu install guide: https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-ubuntu/
- NodeSource Node.js distributions: https://github.com/nodesource/distributions/blob/master/DEV_README.md
- Playwright CLI browser install options: https://playwright.dev/docs/test-cli
