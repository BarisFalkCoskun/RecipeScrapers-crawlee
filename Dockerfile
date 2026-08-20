FROM node:22-bookworm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV CRAWLEE_STORAGE_DIR=/app/data/storage

CMD ["node", "dist/scripts/danish-scheduler.js"]
