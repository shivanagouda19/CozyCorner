const express = require("express");
const router = express.Router({ mergeParams: true });

const wrapAsync = require("../utils/wrapAsync");
const bookingController = require("../controllers/bookings");
const {
    isLoggedIn,
    isBookingOwner,
    isBookingHost,
    validateBookingCreate,
    validateBookingCancel,
    validateBookingStatusUpdate,
} = require("../middleware");

router.post("/", isLoggedIn, validateBookingCreate, wrapAsync(bookingController.createBooking));
router.get("/availability", wrapAsync(bookingController.getListingAvailability));

router.get("/my", isLoggedIn, wrapAsync(bookingController.getUserBookings));
router.get("/host", isLoggedIn, wrapAsync(bookingController.getHostBookings));
router.get("/:bookingId/success", isLoggedIn, wrapAsync(bookingController.getBookingSuccess));

router.patch(
    "/:bookingId/cancel",
    isLoggedIn,
    validateBookingCancel,
    isBookingOwner,
    wrapAsync(bookingController.cancelBooking)
);

router.patch(
    "/:id/status",
    isLoggedIn,
    validateBookingStatusUpdate,
    isBookingHost,
    wrapAsync(bookingController.updateHostBookingStatus)
);

module.exports = router;
