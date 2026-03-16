const express = require("express");
const router = express.Router();
const multer = require("multer");
const wrapAsync = require("../utils/wrapAsync.js");
const {isLoggedIn, isOwner, validateListing} = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const { storage } = require("../cloudConfig.js");

const upload = multer({ storage });



router
	.route("/")
	.get(wrapAsync(listingController.index))
	.post(
		isLoggedIn,
		upload.single("listingImage"),
		validateListing,
		wrapAsync(listingController.createListing)
	);

//new route
router.get("/new", isLoggedIn, listingController.renderNewForm);

//edit route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));
router.get("/:id/nearby", wrapAsync(listingController.getNearbyListings));

router
	.route("/:id")
	.get(wrapAsync(listingController.showListing))
	.put(
		isLoggedIn,
		isOwner,
		upload.single("listingImage"),
		validateListing,
		wrapAsync(listingController.updateListing)
	)
	.delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

module.exports = router;