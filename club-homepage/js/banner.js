async function loadSiteBanner() {
  const container = document.getElementById("site-banner");
  if (!container) return;
  try {
    const res = await fetch("/api/site-banner");
    if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
    const banner = await res.json();
    if (!banner.enabled || !banner.imageUrl) return;

    const img = document.createElement("img");
    img.src = banner.imageUrl;
    img.alt = "배너";
    img.className = "site-banner-img";

    if (banner.linkUrl) {
      const link = document.createElement("a");
      link.href = banner.linkUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.appendChild(img);
      container.appendChild(link);
    } else {
      container.appendChild(img);
    }
  } catch {
    // 배너는 부가 요소이므로 실패해도 조용히 숨긴다.
  }
}

loadSiteBanner();
