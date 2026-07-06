#!/usr/bin/env bash
# 새 리눅스 머신(amd64/arm64 무관)에서 이 프로젝트를 처음 세팅할 때 실행하는 스크립트.
# - .env 파일들을 .env.example로부터 만들고
# - 이 머신에서의 실제 절대경로(HOST_JUDGE_TMP_DIR)를 자동으로 채워 넣고
# - JWT_SECRET을 무작위로 생성해준다.
#
# 이 값들은 머신마다 달라서 저장소에 커밋된 예시 값을 그대로 쓰면 안 되고,
# 그렇다고 손으로 매번 절대경로를 계산해서 채우는 건 실수하기 쉽다
# (실제로 이 프로젝트에서 Windows 개발 중 겪었던 버그의 원인이 이 값의 경로 불일치였다).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> 프로젝트 루트: $ROOT_DIR"

# 1. .env 파일 생성 (이미 있으면 건드리지 않음)
if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
  echo "==> 루트 .env 생성됨"
else
  echo "==> 루트 .env 이미 존재, 건너뜀"
fi

if [ ! -f "oj-backend/.env" ]; then
  cp "oj-backend/.env.example" "oj-backend/.env"
  echo "==> oj-backend/.env 생성됨"
else
  echo "==> oj-backend/.env 이미 존재, 건너뜀"
fi

# 2. judge-tmp 디렉토리 생성 + 이 머신에서의 절대경로 계산
JUDGE_TMP_HOST_PATH="$ROOT_DIR/oj-backend/judge-tmp"
mkdir -p "$JUDGE_TMP_HOST_PATH"
echo "==> judge-tmp 디렉토리: $JUDGE_TMP_HOST_PATH"

set_env_var() {
  # set_env_var <file> <key> <value>  -- 없으면 추가, 있으면 교체
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file"; then
    # '|' 를 구분자로 써서 경로에 슬래시가 있어도 안전하게 치환
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

set_env_var ".env" "HOST_JUDGE_TMP_DIR" "$JUDGE_TMP_HOST_PATH"
set_env_var "oj-backend/.env" "HOST_JUDGE_TMP_DIR" "$JUDGE_TMP_HOST_PATH"
echo "==> HOST_JUDGE_TMP_DIR을 두 .env 파일에 채워 넣었다"

# 3. JWT_SECRET이 예시 값 그대로면 무작위로 생성
current_secret="$(grep '^JWT_SECRET=' "oj-backend/.env" | head -n1 | cut -d= -f2- | tr -d '"')"
if [ -z "$current_secret" ] || [ "$current_secret" = "changeme-run-setup-sh" ]; then
  new_secret="$(openssl rand -hex 48)"
  set_env_var "oj-backend/.env" "JWT_SECRET" "\"$new_secret\""
  echo "==> JWT_SECRET을 무작위로 새로 생성했다"
else
  echo "==> JWT_SECRET이 이미 설정되어 있어 건너뜀"
fi

cat <<'EOF'

==> 세팅 완료. 다음 단계:
    1. oj-backend/.env 를 열어서 SIGNUP_EMAIL_DOMAIN, CORS_ORIGIN, FRONTEND_URL,
       그리고 필요하다면 SMTP_* 값을 이 배포 환경에 맞게 확인/수정한다.
    2. 외부에서 접속할 도메인/포트가 다르다면 .env(루트)의 VITE_API_URL,
       API_PORT, FRONTEND_PORT도 맞게 수정한다.
    3. docker compose build
    4. docker compose up -d
       (api 컨테이너가 기동 시 자동으로 prisma migrate deploy를 실행한다)
EOF
