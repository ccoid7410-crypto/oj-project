// 마이페이지는 OJ 사용자 페이지에 통합됐다. 기수/권한/가입일/색상 설정 등
// 여기서만 보여주던 정보는 전부 OJ 프로필 페이지(본인 조회 시)로 옮겼으므로,
// 이 페이지는 로그인 확인 후 그 프로필로 즉시 이동만 시킨다.
window.clubProfileReady.then((profile) => {
  if (!profile) return; // gate.js가 이미 로그인/부원 안내 화면을 띄운 상태
  window.location.replace(`/users/${encodeURIComponent(profile.username)}`);
});
