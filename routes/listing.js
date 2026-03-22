const express = require("express");
const router = express.Router();
const multer = require("multer");
const csrf = require("@dr.pogodin/csurf");
const path = require("path");
const wrapAsync = require("../utils/wrapAsync.js");
const {isLoggedIn, isOwner, validateListing} = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const availabilityController = require("../controllers/availability.controller");
const { storage } = require("../cloudConfig.js");

const multipartCsrfProtection = csrf();

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const ALLOWED_FILE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024,
		files: 5,
		fields: 20,
		fieldNameSize: 100,
		fieldSize: 100 * 1024,
	},
	fileFilter: (req, file, cb) => {
		const extension = path.extname(file.originalname || "").toLowerCase();
		const hasSafeExtension = ALLOWED_FILE_EXTENSIONS.has(extension);
		const hasSafeMimeType = ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype);

		if ((file.originalname || "").length > 120) {
			const longNameError = new Error("Image filename is too long.");
			longNameError.status = 400;
			return cb(longNameError);
		}

		if (hasSafeMimeType && hasSafeExtension) {
			return cb(null, true);
		}

		const invalidTypeError = new Error("Only valid PNG, JPG, JPEG, and WEBP image files are allowed.");
		invalidTypeError.status = 400;
		return cb(invalidTypeError);
	},
});



router
	.route("/")
	.get(wrapAsync(listingController.index))
	.post(
		isLoggedIn,
		upload.array("listingImages", 5),
		multipartCsrfProtection,
		validateListing,
		wrapAsync(listingController.createListing)
	);

//new route
router.get("/new", isLoggedIn, listingController.renderNewForm);

//edit route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));
router.get("/:id/nearby", wrapAsync(listingController.getNearbyListings));
router.get("/:id/availability", wrapAsync(availabilityController.getListingAvailability));
router.get("/:id/calendar", isLoggedIn, isOwner, wrapAsync(availabilityController.renderHostCalendar));
router.post("/:id/block-dates", isLoggedIn, isOwner, wrapAsync(availabilityController.blockListingDates));
router.post("/:id/wishlist", isLoggedIn, wrapAsync(listingController.toggleWishlist));
router.patch("/:id/status", isLoggedIn, isOwner, wrapAsync(listingController.toggleListingStatus));

router
	.route("/:id")
	.get(wrapAsync(listingController.showListing))
	.put(
		isLoggedIn,
		isOwner,
		upload.array("listingImages", 5),
		multipartCsrfProtection,
		validateListing,
		wrapAsync(listingController.updateListing)
	)
	.delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

module.exports = router;