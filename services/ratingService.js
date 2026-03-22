const Review = require("../models/review");
const Listing = require("../models/listing");

const roundToSingleDecimal = (value) => Math.round((value + Number.EPSILON) * 10) / 10;

const recalculateListingRating = async ({ listingId, session } = {}) => {
    const listing = await Listing.findById(listingId).select("reviews ratingAverage ratingCount").session(session || null);
    if (!listing) return null;

    if (!Array.isArray(listing.reviews) || !listing.reviews.length) {
        listing.ratingAverage = 0;
        listing.ratingCount = 0;
        await listing.save({ session });
        return listing;
    }

    const ratingRows = await Review.find({ _id: { $in: listing.reviews } })
        .select("rating")
        .lean()
        .session(session || null);

    const ratingCount = ratingRows.length;
    const ratingAverage = ratingCount
        ? roundToSingleDecimal(ratingRows.reduce((sum, row) => sum + (Number(row.rating) || 0), 0) / ratingCount)
        : 0;

    listing.ratingAverage = ratingAverage;
    listing.ratingCount = ratingCount;

    await listing.save({ session });
    return listing;
};

const recalculateAllListingsRatings = async ({ session } = {}) => {
    const listings = await Listing.find({}).select("_id").lean().session(session || null);

    for (const listing of listings) {
        await recalculateListingRating({ listingId: listing._id, session });
    }

    return listings.length;
};

module.exports = {
    recalculateListingRating,
    recalculateAllListingsRatings,
};
