# amd64/arm64 겸용 (oj-backend와 동일한 베이스).
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# 프로토콜 동기화 검사(scripts/check-protocol-sync.js)는 oj-backend 디렉토리가 함께 있어야 하는데
# 이 빌드 컨텍스트에는 없다. 그래서 도커 빌드에서는 nest build만 돌리고, 동기화 검사는
# 로컬 `npm run build`에서 강제한다.
RUN npx nest build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 4000 4001
USER node
CMD ["node", "dist/main.js"]
