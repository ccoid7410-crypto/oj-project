// main.js — 동아리 홈페이지의 동적 기능을 담당하는 파일입니다.

// 메뉴(#소개, #활동 등)를 클릭하면 해당 위치로 부드럽게 스크롤합니다.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return; // href="#" 처럼 대상이 없으면 기본 동작 유지
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  });
});

// 나중에 여기에 추가할 수 있는 것들:
// - OJ API와 연동해서 동아리원 랭킹 보여주기 (oj-backend의 external API 활용)
// - 공지사항 영역
// - 활동 사진 갤러리
