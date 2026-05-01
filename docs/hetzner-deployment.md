# Hetzner Server Deployment

## 1. Provision the server

A CX21 (2 vCPU, 4 GB RAM) is sufficient. MongoDB and Playwright Chromium together need ~2 GB RAM.

## 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # should be >=18
```

## 3. Install MongoDB

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod
```

## 4. Install Playwright system dependencies

```bash
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2
```

## 5. Clone and install

```bash
git clone <your-repo-url>
cd RecipeScrapers-crawlee
npm install
npx playwright install chromium
```

## 6. Configure environment

```bash
cp .env.example .env
# Defaults work as-is: mongodb://localhost:27017, crawlee
```

If migrating an existing local MongoDB from the old `danishRecipes` database:

```bash
mongosh --quiet --eval '
const renames = [
  ["danishRecipes.pages", "crawlee.pages"],
  ["danishRecipes.recipes", "crawlee.recipes"],
  ["danishRecipes.crawl_runs", "crawlee.crawl_runs"],
];
for (const [from, to] of renames) {
  const [fromDb, fromCollection] = from.split(".");
  if (!db.getSiblingDB(fromDb).getCollectionNames().includes(fromCollection)) {
    print(`skip missing ${from}`);
    continue;
  }
  print(`rename ${from} -> ${to}`);
  db.adminCommand({ renameCollection: from, to });
}
'
```

## 7. Run

**One-off:**
```bash
npm start
```

**With auto-restart via PM2 (recommended):**
```bash
sudo npm install -g pm2
pm2 start "npm start" --name recipe-crawler
pm2 save
pm2 startup  # run the printed command to enable on reboot
```

**View logs:**
```bash
pm2 logs recipe-crawler
```

## 8. Monitor MongoDB

```bash
mongosh crawlee --eval "db.pages.countDocuments(); db.recipes.countDocuments()"
```

## Notes

- No build step needed — the project uses `tsx` to run TypeScript directly. `npm run build` only type-checks.
- Crawlee writes its request queue to `./storage/` in the working directory. Ensure the process has write access there.
- Playwright runs headless automatically on servers (no `DISPLAY` required).
