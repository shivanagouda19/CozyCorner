(() => {
  const bookingForm = document.getElementById("bookingForm");
  if (!bookingForm) return;

  const checkInInput = document.getElementById("booking-check-in");
  const checkOutInput = document.getElementById("booking-check-out");
  const subtotalEl = document.getElementById("booking-subtotal");
  const serviceFeeEl = document.getElementById("booking-service-fee");
  const totalEl = document.getElementById("booking-total");
  const nightsTextEl = document.getElementById("booking-nights-text");
  const unavailableNoteEl = document.getElementById("booking-unavailable-note");
  const summaryDatesEl = document.getElementById("booking-summary-dates");
  const summaryGuestsEl = document.getElementById("booking-summary-guests");
  const summaryTotalEl = document.getElementById("booking-summary-total");
  const submitBtn = document.getElementById("booking-submit-btn");
  const guestsInput = document.getElementById("booking-guests-count");
  const unavailableListEl = document.getElementById("booking-unavailable-list");
  const confirmModalEl = document.getElementById("bookingConfirmModal");
  const confirmDatesEl = document.getElementById("booking-modal-dates");
  const confirmGuestsEl = document.getElementById("booking-modal-guests");
  const confirmTotalEl = document.getElementById("booking-modal-total");
  const confirmActionBtn = document.getElementById("booking-confirm-action");
  const estimateCard = bookingForm.querySelector(".booking-estimate-card");

  if (!checkInInput || !checkOutInput || !estimateCard) return;

  const nightlyRate = Number(estimateCard.dataset.nightlyRate || 0);
  const serviceFeeRate = Number(estimateCard.dataset.serviceFeeRate || 0.12);
  const availabilityUrl = bookingForm.dataset.availabilityUrl;
  let unavailableRanges = [];
  let isConfirmedSubmit = false;

  const formatCurrency = (value) => `INR ${Math.max(0, Number(value) || 0).toLocaleString("en-IN")}`;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const minDate = `${yyyy}-${mm}-${dd}`;

  checkInInput.min = minDate;
  checkOutInput.min = minDate;

  const parseDate = (value) => {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toDateKey = (date) => {
    if (!(date instanceof Date)) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateLabel = (date) => {
    if (!(date instanceof Date)) return "-";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const setButtonLoading = (button, isLoading) => {
    if (!button) return;
    const label = button.querySelector(".booking-cta-label");
    const loading = button.querySelector(".booking-cta-loading");
    if (label) label.classList.toggle("d-none", isLoading);
    if (loading) loading.classList.toggle("d-none", !isLoading);
    button.disabled = isLoading;
  };

  const renderUnavailableRanges = () => {
    if (!unavailableListEl) return;
    unavailableListEl.innerHTML = "";

    if (!unavailableRanges.length) return;

    unavailableRanges.slice(0, 4).forEach((range) => {
      const checkIn = parseDate(range.checkIn);
      const checkOut = parseDate(range.checkOut);
      if (!checkIn || !checkOut) return;

      const chip = document.createElement("span");
      chip.className = "booking-unavailable-chip";
      chip.textContent = `${formatDateLabel(checkIn)} - ${formatDateLabel(checkOut)}`;
      unavailableListEl.appendChild(chip);
    });
  };

  const hasOverlap = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return false;

    return unavailableRanges.some((range) => {
      const blockedIn = parseDate(range.checkIn);
      const blockedOut = parseDate(range.checkOut);
      if (!blockedIn || !blockedOut) return false;
      return checkIn < blockedOut && checkOut > blockedIn;
    });
  };

  const setAvailabilityError = (message = "") => {
    checkInInput.setCustomValidity(message);
    checkOutInput.setCustomValidity(message);
    if (unavailableNoteEl) {
      unavailableNoteEl.textContent = message || "Dates are available.";
      unavailableNoteEl.classList.toggle("is-error", Boolean(message));
      unavailableNoteEl.classList.toggle("is-success", !message);
    }
    const summaryCard = document.getElementById("booking-summary-card");
    if (summaryCard) {
      summaryCard.classList.toggle("is-conflict", Boolean(message));
    }
    if (submitBtn) submitBtn.disabled = Boolean(message);
  };

  const calculateNights = () => {
    const checkIn = parseDate(checkInInput.value);
    const checkOut = parseDate(checkOutInput.value);

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      return 0;
    }

    const diff = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const refreshEstimate = () => {
    const checkIn = parseDate(checkInInput.value);
    const checkOut = parseDate(checkOutInput.value);
    const nights = calculateNights();
    const guests = Math.max(1, Number.parseInt(guestsInput?.value || "1", 10));

    if (summaryGuestsEl) summaryGuestsEl.textContent = `Guests: ${guests}`;
    if (summaryDatesEl) summaryDatesEl.textContent = `Dates: ${formatDateLabel(checkIn)} - ${formatDateLabel(checkOut)}`;
    if (confirmDatesEl) confirmDatesEl.textContent = `Dates: ${formatDateLabel(checkIn)} - ${formatDateLabel(checkOut)}`;
    if (confirmGuestsEl) confirmGuestsEl.textContent = `Guests: ${guests}`;

    if (nights <= 0) {
      subtotalEl.textContent = formatCurrency(0);
      serviceFeeEl.textContent = formatCurrency(0);
      totalEl.textContent = formatCurrency(0);
      nightsTextEl.textContent = "Select valid dates to calculate total.";
      if (summaryTotalEl) summaryTotalEl.textContent = "Total: INR 0";
      if (confirmTotalEl) confirmTotalEl.textContent = "Total: INR 0";
      setAvailabilityError("");
      return;
    }

    if (hasOverlap(checkIn, checkOut)) {
      setAvailabilityError("These dates are unavailable. Please choose different dates.");
    } else {
      setAvailabilityError("");
    }

    const subtotal = nightlyRate * nights;
    const serviceFee = Number((subtotal * serviceFeeRate).toFixed(2));
    const total = Number((subtotal + serviceFee).toFixed(2));

    subtotalEl.textContent = formatCurrency(subtotal);
    serviceFeeEl.textContent = formatCurrency(serviceFee);
    totalEl.textContent = formatCurrency(total);
    nightsTextEl.textContent = `${nights} night${nights > 1 ? "s" : ""} at INR ${nightlyRate.toLocaleString("en-IN")} per night.`;
    if (summaryTotalEl) summaryTotalEl.textContent = `Total: ${formatCurrency(total)}`;
    if (confirmTotalEl) confirmTotalEl.textContent = `Total: ${formatCurrency(total)}`;
  };

  const loadAvailability = async () => {
    if (!availabilityUrl) {
      if (unavailableNoteEl) unavailableNoteEl.textContent = "Availability will be checked on booking confirmation.";
      return;
    }

    try {
      const response = await fetch(availabilityUrl, { method: "GET" });
      if (!response.ok) throw new Error("Failed to fetch availability");

      const payload = await response.json();
      unavailableRanges = Array.isArray(payload.unavailable) ? payload.unavailable : [];
      renderUnavailableRanges();

      if (unavailableNoteEl) {
        unavailableNoteEl.textContent = unavailableRanges.length
          ? `${unavailableRanges.length} unavailable date range(s) loaded.`
          : "No blocked dates found. You can choose any upcoming range.";
        unavailableNoteEl.classList.toggle("is-error", false);
        unavailableNoteEl.classList.toggle("is-success", true);
      }
    } catch (error) {
      unavailableRanges = [];
      renderUnavailableRanges();
      if (unavailableNoteEl) unavailableNoteEl.textContent = "Could not load unavailable dates right now.";
    }
  };

  const openModal = () => {
    if (!confirmModalEl) return;
    confirmModalEl.classList.add("is-open");
    confirmModalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("booking-modal-open");
  };

  const closeModal = () => {
    if (!confirmModalEl) return;
    confirmModalEl.classList.remove("is-open");
    confirmModalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("booking-modal-open");
  };

  checkInInput.addEventListener("change", () => {
    if (checkOutInput.value && checkOutInput.value <= checkInInput.value) {
      checkOutInput.value = "";
    }

    if (checkInInput.value) {
      checkOutInput.min = checkInInput.value;
    }

    refreshEstimate();
  });

  checkOutInput.addEventListener("change", refreshEstimate);
  bookingForm.addEventListener("input", refreshEstimate);

  bookingForm.addEventListener("submit", (event) => {
    if (!isConfirmedSubmit) {
      event.preventDefault();
      refreshEstimate();

      if (!bookingForm.reportValidity()) return;
      if (submitBtn?.disabled) return;

      openModal();
      return;
    }

    setButtonLoading(submitBtn, true);
    setButtonLoading(confirmActionBtn, true);
  });

  if (confirmModalEl) {
    confirmModalEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.bookingModalClose === "true") {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && confirmModalEl.classList.contains("is-open")) {
        closeModal();
      }
    });
  }

  if (confirmActionBtn) {
    confirmActionBtn.addEventListener("click", () => {
      if (submitBtn?.disabled) return;
      isConfirmedSubmit = true;
      closeModal();
      bookingForm.requestSubmit();
    });
  }

  bookingForm.addEventListener("input", () => {
    isConfirmedSubmit = false;
  });

  loadAvailability().finally(refreshEstimate);
})();
