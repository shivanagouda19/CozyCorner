const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const ValidationError = require("../errors/ValidationError");

const REVENUE_STATUSES = ["confirmed", "completed"];
const ANALYTICS_BOOKING_STATUSES = ["pending", "confirmed", "completed", "rejected", "cancelled"];

const toObjectId = (hostId) => {
    if (!mongoose.Types.ObjectId.isValid(hostId)) {
        throw new ValidationError("Invalid host id.");
    }

    return new mongoose.Types.ObjectId(hostId);
};

const getHostAnalytics = async (hostId) => {
    const hostObjectId = toObjectId(hostId);

    const [bookingAgg, listingAgg] = await Promise.all([
        Booking.aggregate([
            { $match: { host: hostObjectId } },
            {
                $facet: {
                    revenue: [
                        { $match: { status: { $in: REVENUE_STATUSES } } },
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { $sum: { $ifNull: ["$totalPrice", 0] } },
                            },
                        },
                    ],
                    occupiedCount: [
                        { $match: { status: { $in: REVENUE_STATUSES } } },
                        { $count: "count" },
                    ],
                    mostBookedListing: [
                        { $match: { status: { $in: ANALYTICS_BOOKING_STATUSES } } },
                        {
                            $group: {
                                _id: "$listing",
                                bookingCount: { $sum: 1 },
                            },
                        },
                        { $sort: { bookingCount: -1, _id: 1 } },
                        { $limit: 1 },
                        {
                            $lookup: {
                                from: "listings",
                                localField: "_id",
                                foreignField: "_id",
                                as: "listing",
                            },
                        },
                        { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 0,
                                title: { $ifNull: ["$listing.title", "Listing unavailable"] },
                                bookingCount: 1,
                            },
                        },
                    ],
                },
            },
        ]),
        Listing.aggregate([
            { $match: { owner: hostObjectId } },
            {
                $facet: {
                    listingCount: [{ $count: "count" }],
                    avgRating: [
                        {
                            $group: {
                                _id: null,
                                value: { $avg: { $ifNull: ["$ratingAverage", 0] } },
                            },
                        },
                    ],
                },
            },
        ]),
    ]);

    const bookingData = bookingAgg[0] || {};
    const listingData = listingAgg[0] || {};

    const totalRevenue = Number(bookingData.revenue?.[0]?.totalRevenue || 0);
    const occupiedBookings = Number(bookingData.occupiedCount?.[0]?.count || 0);
    const totalListings = Number(listingData.listingCount?.[0]?.count || 0);
    const occupancyRate = totalListings > 0
        ? Number((occupiedBookings / totalListings).toFixed(2))
        : 0;

    const mostBookedListing = bookingData.mostBookedListing?.[0]
        ? {
            title: bookingData.mostBookedListing[0].title,
            bookingCount: Number(bookingData.mostBookedListing[0].bookingCount || 0),
        }
        : null;

    const avgRating = Number(Number(listingData.avgRating?.[0]?.value || 0).toFixed(2));

    return {
        totalRevenue,
        occupancyRate,
        mostBookedListing,
        avgRating,
    };
};

module.exports = {
    getHostAnalytics,
};
