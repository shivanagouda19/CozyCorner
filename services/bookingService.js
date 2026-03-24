const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Listing = require("../models/listing");
const availabilityService = require("./availability.service");
const config = require("../config");
const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");
const ConflictError = require("../errors/ConflictError");
const BookingConflictError = require("../errors/BookingConflictError");
const AuthorizationError = require("../errors/AuthorizationError");
const {
    ACTIVE_BOOKING_STATUSES,
    calculateBookingPrice,
    calculateNights,
    parseDateInput,
    startOfTodayUtc,
} = require("../utils/booking");

const syncCompletedBookings = async (query) => {
    const now = new Date();
    await Booking.updateMany(
        {
            ...query,
            status: { $in: ACTIVE_BOOKING_STATUSES },
            checkOut: { $lt: now },
        },
        { $set: { status: "completed" } }
    );
};

const reserveListingDatesAtomically = async ({ listingId, guestId, bookingId, checkIn, checkOut }) => {
    const listing = await Listing.findOneAndUpdate(
        {
            _id: listingId,
            owner: { $ne: guestId },
            status: "active",
            blockedDates: {
                $not: {
                    $elemMatch: {
                        start: { $lt: checkOut },
                        end: { $gt: checkIn },
                    },
                },
            },
        },
        {
            $push: {
                blockedDates: {
                    booking: bookingId,
                    start: checkIn,
                    end: checkOut,
                },
            },
        },
        {
            new: true,
            projection: "title price owner status",
        }
    );

    if (listing) {
        if (!listing.price || listing.price <= 0) {
            // Compensating action because price validation happens after date lock.
            await Listing.updateOne(
                { _id: listingId },
                {
                    $pull: {
                        blockedDates: {
                            booking: bookingId,
                            start: checkIn,
                            end: checkOut,
                        },
                    },
                }
            );
            throw new ValidationError("This listing cannot be booked because price is not configured.");
        }

        return listing;
    }

    const failureListing = await Listing.findById(listingId).select("owner status");
    if (!failureListing) {
        throw new NotFoundError("Listing does not exist.");
    }

    if (failureListing.owner && failureListing.owner.equals(guestId)) {
        throw new AuthorizationError("You cannot book your own listing.");
    }

    if (failureListing.status !== "active") {
        throw new ConflictError("Listing is not available for booking.");
    }

    throw new BookingConflictError("Selected dates are no longer available.");
};

const createBooking = async ({ listingId, guestId, bookingInput }) => {
    if (!listingId) {
        throw new ValidationError("Listing id is required to create a booking.");
    }

    const checkIn = parseDateInput(bookingInput?.checkIn);
    const checkOut = parseDateInput(bookingInput?.checkOut);

    if (!checkIn || !checkOut) {
        throw new ValidationError("Please provide valid check-in and check-out dates.");
    }

    const today = startOfTodayUtc();
    if (checkIn < today) {
        throw new ValidationError("Check-in date cannot be in the past.");
    }

    const nights = calculateNights(checkIn, checkOut);
    if (nights < 1) {
        throw new ValidationError("Booking must be at least 1 night.");
    }

    if (nights > config.booking.maxBookableNights) {
        throw new ValidationError(`Booking cannot exceed ${config.booking.maxBookableNights} nights.`);
    }

    const bookingId = new mongoose.Types.ObjectId();

    const listing = await reserveListingDatesAtomically({
        listingId,
        guestId,
        bookingId,
        checkIn,
        checkOut,
    });

    const pricing = calculateBookingPrice({
        nightlyRate: listing.price,
        nights,
        serviceFeeRate: config.booking.serviceFeeRate,
    });

    const booking = new Booking({
        _id: bookingId,
        guest: guestId,
        host: listing.owner,
        listing: listing._id,
        checkIn,
        checkOut,
        guestsCount: bookingInput?.guestsCount || 1,
        nights,
        nightlyRate: listing.price,
        serviceFee: pricing.serviceFee,
        totalPrice: pricing.totalPrice,
        status: "pending",
        currency: "INR",
    });

    try {
        await booking.save();
    } catch (error) {
        // Best-effort rollback for blockedDates when booking persistence fails.
        await Listing.updateOne(
            { _id: listing._id },
            {
                $pull: {
                    blockedDates: {
                        booking: bookingId,
                        start: checkIn,
                        end: checkOut,
                    },
                },
            }
        );
        throw error;
    }

    return {
        booking,
        listingTitle: listing.title,
    };
};

const getListingUnavailableDateRanges = async (listingId) => {
    const payload = await availabilityService.getListingAvailability(listingId);
    return payload.unavailable;
};

const getBookingSuccessPayload = async ({ bookingId, guestId }) => {
    const booking = await Booking.findById(bookingId)
        .populate("listing", "title image location country")
        .lean();

    if (!booking) {
        throw new NotFoundError("Booking not found.");
    }

    if (!booking.guest || booking.guest.toString() !== guestId.toString()) {
        throw new AuthorizationError("You are not allowed to access this booking.");
    }

    return booking;
};

const cancelBooking = async ({ bookingId, cancellationReason }) => {
    const cancelledAt = new Date();

    const booking = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            status: { $in: ["pending", "confirmed"] },
        },
        {
            $set: {
                status: "cancelled",
                cancelledAt,
                cancellationReason: cancellationReason || "Cancelled by guest",
            },
        },
        {
            new: true,
        }
    ).populate("listing", "title");

    if (!booking) {
        const existingBooking = await Booking.findById(bookingId).select("status");
        if (!existingBooking) {
            throw new NotFoundError("Booking not found.");
        }

        if (existingBooking.status === "cancelled") {
            throw new ConflictError("Booking is already cancelled.");
        }

        if (!["pending", "confirmed"].includes(existingBooking.status)) {
            throw new ConflictError("Only pending or confirmed bookings can be cancelled.");
        }

        throw new NotFoundError("Booking not found.");
    }

    await Listing.updateOne(
        { _id: booking.listing?._id || booking.listing },
        {
            $pull: {
                blockedDates: {
                    booking: booking._id,
                },
            },
        }
    );

    return booking;
};

const getUserBookings = async (guestId) => {
    await syncCompletedBookings({ guest: guestId });

    const now = new Date();
    const [pending, confirmed, completed, cancelled, rejected] = await Promise.all([
        Booking.find({
            guest: guestId,
            status: "pending",
            checkOut: { $gte: now },
        })
            .populate("listing", "title image location country")
            .sort({ createdAt: -1 })
            .lean(),
        Booking.find({
            guest: guestId,
            status: "confirmed",
            checkOut: { $gte: now },
        })
            .populate("listing", "title image location country")
            .sort({ checkIn: 1 })
            .lean(),
        Booking.find({ guest: guestId, status: "completed" })
            .populate("listing", "title image location country")
            .sort({ checkOut: -1 })
            .lean(),
        Booking.find({ guest: guestId, status: "cancelled" })
            .populate("listing", "title image location country")
            .sort({ updatedAt: -1 })
            .lean(),
        Booking.find({ guest: guestId, status: "rejected" })
            .populate("listing", "title image location country")
            .sort({ updatedAt: -1 })
            .lean(),
    ]);

    return { pending, confirmed, completed, cancelled, rejected };
};

const getHostBookings = async (hostId, options = {}) => {
    await syncCompletedBookings({ host: hostId });

    const now = new Date();
    const baseMatch = { host: hostId };
    if (options.listingId) {
        baseMatch.listing = options.listingId;
    }

    const [pending, confirmed, completed, cancelled, rejected] = await Promise.all([
        Booking.find({
            ...baseMatch,
            status: "pending",
            checkOut: { $gte: now },
        })
            .populate("listing", "title image location country")
            .populate("guest", "username fullName email")
            .sort({ createdAt: -1 })
            .lean(),
        Booking.find({
            ...baseMatch,
            status: "confirmed",
            checkOut: { $gte: now },
        })
            .populate("listing", "title image location country")
            .populate("guest", "username fullName email")
            .sort({ checkIn: 1 })
            .lean(),
        Booking.find({ ...baseMatch, status: "completed" })
            .populate("listing", "title image location country")
            .populate("guest", "username fullName email")
            .sort({ checkOut: -1 })
            .lean(),
        Booking.find({ ...baseMatch, status: "cancelled" })
            .populate("listing", "title image location country")
            .populate("guest", "username fullName email")
            .sort({ updatedAt: -1 })
            .lean(),
        Booking.find({ ...baseMatch, status: "rejected" })
            .populate("listing", "title image location country")
            .populate("guest", "username fullName email")
            .sort({ updatedAt: -1 })
            .lean(),
    ]);

    return { pending, confirmed, completed, cancelled, rejected };
};

const updateHostBookingStatus = async ({ bookingId, hostId, nextStatus }) => {
    if (!["confirmed", "rejected"].includes(nextStatus)) {
        throw new ValidationError("Invalid booking status transition.");
    }

    const booking = await Booking.findById(bookingId)
        .populate("listing", "title")
        .select("host status checkOut listing");

    if (!booking) {
        throw new NotFoundError("Booking not found.");
    }

    if (!booking.host.equals(hostId)) {
        throw new AuthorizationError("You are not allowed to modify this booking.");
    }

    if (booking.status !== "pending") {
        throw new ConflictError("Only pending bookings can be accepted or rejected.");
    }

    const now = new Date();
    if (booking.checkOut < now) {
        booking.status = "completed";
        await booking.save();
        throw new ConflictError("This booking already ended and has been marked as completed.");
    }

    booking.status = nextStatus;
    await booking.save();

    return booking;
};

module.exports = {
    createBooking,
    cancelBooking,
    getListingUnavailableDateRanges,
    getBookingSuccessPayload,
    getUserBookings,
    getHostBookings,
    updateHostBookingStatus,
};
