(() => {
  const initListingFilterForm = () => {
    const filterForm = document.getElementById("listingFilterForm");
    const applyBtn = document.getElementById("applyFiltersBtn");
    if (!filterForm || !applyBtn) return;

    filterForm.addEventListener("submit", () => {
      const label = applyBtn.querySelector(".filter-btn-label");
      const loading = applyBtn.querySelector(".filter-btn-loading");
      if (label) label.classList.add("d-none");
      if (loading) loading.classList.remove("d-none");
      applyBtn.setAttribute("disabled", "true");
    });
  };

  document.addEventListener("DOMContentLoaded", initListingFilterForm);
})();
