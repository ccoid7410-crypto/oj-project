# amd64/arm64 겸용. FROM에 --platform을 고정하지 않으면 Docker가 빌드 중인 호스트 아키텍처에
# 맞는 이미지를 알아서 고른다(node:20-bookworm-slim은 amd64/arm64 둘 다 공식 지원).
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# bookworm-slim에는 openssl이 안 들어있어서 Prisma가 libssl 버전을 감지하지 못하고
# openssl-1.1.x로 잘못 추측한다(경고 메시지 발생). 쿼리 엔진 바이너리를 올바르게 고르도록 설치해준다.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=builder /app/prisma ./prisma
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

EXPOSE 3000
USER node
# docker-compose에서 api는 dist/main.js, worker는 dist/main-worker.js 로 command 오버라이드
CMD ["node", "dist/main.js"]
