// 일정 캘린더는 로그인/부원 여부와 상관없이 완전히 공개한다.
// CSP(script-src 'self')가 인라인 스크립트를 막기 때문에 별도 파일로 분리해뒀다 -
// calendar.html에 직접 <script>로 값을 넣으면 브라우저가 조용히 실행을 차단해서
// 이 플래그가 항상 undefined로 남고, gate.js는 여전히 로그인을 요구하게 된다.
window.GATE_REQUIRE_MEMBER = false;
window.GATE_REQUIRE_LOGIN = false;
