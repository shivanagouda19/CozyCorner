const Review = require("../models/review.js");
const Listing = require("../models/listing.js");
const mongoose = require("mongoose");
const { recalculateListingRating } = require("../services/ratingService");

module.exports.createReview = async (req, res) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		const listing = await Listing.findById(req.params.id).session(session);
		if (!listing) {
			await session.abortTransaction();
			req.flash("error", "Listing does not exist.");
			return res.redirect("/listings");
		}

		const newReview = new Review(req.body.review);
		newReview.author = req.user._id;

		await newReview.save({ session });
		listing.reviews.push(newReview._id);
		await listing.save({ session });

		await recalculateListingRating({ listingId: listing._id, session });

		await session.commitTransaction();
		req.flash("success", "Review added successfully!");
		return res.redirect(`/listings/${listing._id}`);
	} catch (error) {
		await session.abortTransaction();
		throw error;
	} finally {
		await session.endSession();
	}
};

module.exports.destroyReview = async (req, res) => {
	const { id, reviewId } = req.params;
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } }, { session });
		await Review.findByIdAndDelete(reviewId).session(session);
		await recalculateListingRating({ listingId: id, session });

		await session.commitTransaction();
		req.flash("success", "Review deleted successfully!");
		return res.redirect(`/listings/${id}`);
	} catch (error) {
		await session.abortTransaction();
		throw error;
	} finally {
		await session.endSession();
	}
};
