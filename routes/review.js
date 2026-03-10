const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError");
const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const {validateReview, isLoggedIn, isReviewAuthor}= require("../middleware.js")

//post route
router.post(
    "/",
    isLoggedIn,
    validateReview,
    wrapAsync(async (req, res) => {
        let listing = await Listing.findById(req.params.id);
        let newReview = new Review(req.body.review);
        newReview.author=req.user._id;
        listing.reviews.push(newReview);
        await newReview.save();
        await listing.save();

        res.redirect(`/listings/${listing._id}`);
    })
);
router.delete(
    "/:reviewId",
    isLoggedIn,
    isReviewAuthor,
    wrapAsync(async (req, res) => {
        const { id, reviewId } = req.params;
        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });// delete the review from listing array
        await Review.findByIdAndDelete(reviewId);// delete the review 
        res.redirect(`/listings/${id}`);
    })
);

module.exports = router;