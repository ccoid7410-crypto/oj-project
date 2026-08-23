# 멀티 아키텍처(amd64/arm64) 겸용. FROM에 --platform을 고정하지 않으면
# Docker가 빌드 중인 호스트(또는 buildx 타겟)의 아키텍처에 맞는 이미지를 자동으로 고른다.
# 빌드 컨텍스트는 저장소 루트다. 편집기 본체(club-homepage/js/markdown-editor.js)를
# OJ와 홈페이지가 함께 쓰기 때문에, 저장소와 같은 구조로 두 폴더를 모두 넣는다.
FROM node:20-bookworm-slim AS builder
WORKDIR /app/oj-frontend
COPY oj-frontend/package*.json ./
RUN npm ci
COPY club-homepage/js/markdown-editor.js /app/club-homepage/js/markdown-editor.js
COPY club-homepage/css/markdown-editor.css /app/club-homepage/css/markdown-editor.css
COPY oj-frontend ./

# API 서버 주소는 Vite가 빌드 시점에 정적 파일 안에 박아 넣는다(런타임에 바꿀 수 없음).
# 그래서 배포 대상 도메인이 바뀌면 이 이미지를 다시 빌드해야 한다 (README/HANDOFF 참고).
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/oj-frontend/dist /usr/share/nginx/html
COPY oj-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
