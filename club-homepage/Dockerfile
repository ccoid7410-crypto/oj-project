# 동아리 홈페이지(정적 HTML/CSS/JS)를 nginx로 서빙하는 컨테이너.
# 멀티 아키텍처(amd64/arm64) 겸용 — FROM에 --platform을 고정하지 않는다 (HANDOFF.md 참고).
FROM nginx:1.27-alpine
# nginx 기본 설정이 /usr/share/nginx/html을 그대로 서빙하므로 파일만 복사하면 된다.
COPY . /usr/share/nginx/html
EXPOSE 80
