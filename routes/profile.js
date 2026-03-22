const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const profileController = require("../controllers/profile");
const analyticsController = require("../controllers/analytics.controller");
const {
    isLoggedIn,
    normalizeProfileLanguages,
    validateProfileUpdate,
    validateAccountSettings,
    validatePasswordChange,
    validateDeleteAccount,
} = require("../middleware");

router.get("/profile", isLoggedIn, wrapAsync(profileController.getProfile));
router.get("/profile/edit", isLoggedIn, wrapAsync(profileController.renderEditProfileForm));
router.get("/profile/settings", isLoggedIn, wrapAsync(profileController.getSettings));
router.patch("/profile", isLoggedIn, normalizeProfileLanguages, validateProfileUpdate, wrapAsync(profileController.updateProfile));
router.patch("/profile/account", isLoggedIn, validateAccountSettings, wrapAsync(profileController.updateAccountSettings));
router.patch("/profile/password", isLoggedIn, validatePasswordChange, wrapAsync(profileController.changePassword));
router.delete("/profile", isLoggedIn, validateDeleteAccount, wrapAsync(profileController.deleteAccount));

router.get("/profile/listings", isLoggedIn, wrapAsync(profileController.getHostListings));
router.get("/profile/bookings", isLoggedIn, wrapAsync(profileController.getBookings));
router.get("/profile/bookings/host", isLoggedIn, wrapAsync(profileController.getHostBookingsDashboard));
router.get("/profile/reviews", isLoggedIn, wrapAsync(profileController.getReviewsOverview));
router.get("/profile/wishlist", isLoggedIn, wrapAsync(profileController.getWishlist));
router.get("/profile/analytics", isLoggedIn, wrapAsync(analyticsController.getHostAnalyticsDashboard));
router.get("/profile/payouts", isLoggedIn, wrapAsync(profileController.getHostPayoutDashboard));

module.exports = router;
