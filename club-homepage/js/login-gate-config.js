// 로그인만 하면 볼 수 있는 페이지에서 gate.js보다 먼저 불러온다(부원이 아니어도 됨).
// 공개 게시판, 명예의 전당, 알림이 여기에 해당한다.
//
// CSP(script-src 'self')가 인라인 스크립트를 막기 때문에 별도 파일로 분리해뒀다 -
// HTML에 직접 <script>로 값을 넣으면 브라우저가 조용히 실행을 차단해서
// 이 플래그가 항상 undefined로 남는다.
//
// GATE_REQUIRE_LOGIN은 기본값(true)을 그대로 두고 부원 조건만 끈다.
window.GATE_REQUIRE_MEMBER = false;
