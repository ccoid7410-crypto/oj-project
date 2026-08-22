// 홈페이지는 비로그인 방문자도 모두 열람 가능. 여기서는 로그인한 경우에만
// 부원 프로필(닉네임 등 헤더 표시용)을 가져오고, 실패하거나 로그인 안 했으면
// null을 반환해서 main.js가 비로그인 상태로 헤더를 그린다.
window.clubProfileReady = (async () => {
  const token = localStorage.getItem("oj_token");
  if (!token) return null;
  try {
    const res = await fetch("/api/users/me/club-profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
})();
