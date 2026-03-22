const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");
const AuthorizationError = require("../errors/AuthorizationError");
const ConflictError = require("../errors/ConflictError");
const { parseDateInput, startOfTodayUtc } = require("../utils/booking");

const BLOCKING_BOOKING_STATUSES = ["confirmed", "completed"];

const toObjectId = (value, fieldName) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ValidationError(`Invalid ${fieldName}.`);
    }

    return new mongoose.Types.ObjectId(value);
};

const normalizeDateValue = (value) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }

    if (typeof value === "string") {
        const parsedFromDateInput = parseDateInput(value);
        if (parsedFromDateInput) {
            return parsedFromDateInput;
        }

        const parsed = new Date(value);
        if (Number.isFinite(parsed.getTime())) {
            return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
        }
    }

    return null;
};

const normalizeRange = (startDate, endDate) => {
    const start = normalizeDateValue(startDate);
    const end = normalizeDateValue(endDate);

    if (!start || !end) {
        throw new ValidationError("Please provide valid start and end dates.");
    }

    if (start >= end) {
        throw new ValidationError("Start date must be before end date.");
    }

    const today = startOfTodayUtc();
    if (start < today) {
        throw new ValidationError("Date ranges in the past are not allowed.");
    }

    return { start, end };
};

const getListingAvailability = async (listingId) => {
    const listingObjectId = toObjectId(listingId, "listing id");

    const [listing, bookingRanges] = await Promise.all([
        Listing.findById(listingObjectId)
            .select("blockedDates")
            .lean(),
        Booking.find({
            listing: listingObjectId,
            status: { $in: BLOCKING_BOOKING_STATUSES },
        })
            .select("checkIn checkOut status")
            .sort({ checkIn: 1 })
            .lean(),
    ]);

    if (!listing) {
        throw new NotFoundError("Listing does not exist.");
    }

    const manualBlockedRanges = Array.isArray(listing.blockedDates)
        ? listing.blockedDates.map((range) => ({
            checkIn: range.start,
            checkOut: range.end,
            status: "blocked",
            source: "manual_block",
        }))
        : [];

    const bookingBlockedRanges = bookingRanges.map((booking) => ({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status,
        source: "booking",
    }));

    const unavailable = [...bookingBlockedRanges, ...manualBlockedRanges].sort(
        (a, b) => new Date(a.checkIn) - new Date(b.checkIn)
    );

    return {
        listingId: listingObjectId,
        unavailable,
    };
};

const isDateRangeAvailable = async (listingId, startDate, endDate) => {
    const listingObjectId = toObjectId(listingId, "listing id");
    const { start, end } = normalizeRange(startDate, endDate);

    const listingExists = await Listing.exists({ _id: listingObjectId });
    if (!listingExists) {
        throw new NotFoundError("Listing does not exist.");
    }

    const [manualOverlap, bookingOverlap] = await Promise.all([
        Listing.exists({
            _id: listingObjectId,
            blockedDates: {
                $elemMatch: {
                    start: { $lt: end },
                    end: { $gt: start },
                },
            },
        }),
        Booking.exists({
            listing: listingObjectId,
            status: { $in: BLOCKING_BOOKING_STATUSES },
            checkIn: { $lt: end },
            checkOut: { $gt: start },
        }),
    ]);

    return !manualOverlap && !bookingOverlap;
};

const blockListingDates = async (hostId, listingId, startDate, endDate) => {
    const hostObjectId = toObjectId(hostId, "host id");
    const listingObjectId = toObjectId(listingId, "listing id");
    const { start, end } = normalizeRange(startDate, endDate);

    const listing = await Listing.findById(listingObjectId).select("owner blockedDates");
    if (!listing) {
        throw new NotFoundError("Listing does not exist.");
    }

    if (!listing.owner || !listing.owner.equals(hostObjectId)) {
        throw new AuthorizationError("You are not allowed to block dates for this listing.");
    }

    const [manualOverlap, bookingOverlap] = await Promise.all([
        Listing.exists({
            _id: listingObjectId,
            blockedDates: {
                $elemMatch: {
                    start: { $lt: end },
                    end: { $gt: start },
                },
            },
        }),
        Booking.exists({
            listing: listingObjectId,
            status: { $in: BLOCKING_BOOKING_STATUSES },
            checkIn: { $lt: end },
            checkOut: { $gt: start },
        }),
    ]);

    if (manualOverlap) {
        throw new ConflictError("Date range overlaps with existing blocked dates.");
    }

    if (bookingOverlap) {
        throw new ConflictError("Date range overlaps with an existing booking.");
    }

    listing.blockedDates.push({ start, end });
    await listing.save();

    return {
        listingId: listing._id,
        blockedRange: { start, end },
    };
};

module.exports = {
    getListingAvailability,
    blockListingDates,
    isDateRangeAvailable,
};
