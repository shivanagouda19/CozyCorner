(() => {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarNav = document.getElementById("sidebarNav");
  const progressBar = document.querySelector(".profile-progress-bar");

  if (progressBar) {
    const rawValue = Number(progressBar.getAttribute("data-progress"));
    const normalized = Number.isFinite(rawValue) ? Math.min(100, Math.max(0, rawValue)) : 0;
    progressBar.style.width = `${normalized}%`;
  }

  if (sidebarToggle && sidebarNav) {
    sidebarToggle.addEventListener("click", () => {
      sidebarNav.classList.toggle("open");
    });
  }
})();
