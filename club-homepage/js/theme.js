(function () {
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    const v = localStorage.getItem("oj_theme");
    return v === "light" || v === "dark" ? v : "system";
  }

  function applyTheme(pref) {
    const dark = pref === "dark" || (pref === "system" && media.matches);
    document.documentElement.classList.toggle("dark", dark);
  }

  applyTheme(storedTheme());
  media.addEventListener("change", () => applyTheme(storedTheme()));

  window.ojTheme = {
    stored: storedTheme,
    set(pref) {
      localStorage.setItem("oj_theme", pref);
      applyTheme(pref);
    },
  };
})();
