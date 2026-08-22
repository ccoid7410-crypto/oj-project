/**
 * 학교 계정(cbsh#####@cbsh.hs.kr)에서만 기수를 뽑는다.
 * 학번 5자리의 앞 2자리가 기수다. (예: cbsh38001@cbsh.hs.kr → "38")
 *
 * 개인 이메일(gmail 등)은 기수를 알 수 없으므로 null이다. 예전에는 이메일 아이디에서
 * 처음 나오는 두 자리 숫자를 썼는데, 그러면 kim2005@gmail.com 같은 주소가 "20기"로
 * 잘못 잡혀서 형식 검사로 바꿨다.
 */
const SCHOOL_EMAIL = /^cbsh(\d{5})@cbsh\.hs\.kr$/i;

export function generationFromEmail(email: string): string | null {
  const match = SCHOOL_EMAIL.exec(email.trim());
  return match ? match[1].slice(0, 2) : null;
}
