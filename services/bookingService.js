const Booking = require("../models/booking");
const Listing = require("../models/listing");
const availabilityService = require("./availability.service");
const config = require("../config");
const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");
const ConflictError = require("../errors/ConflictError");
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

const createBooking = async ({ listingId, guestId, bookingInput }) => {
    if (!listingId) {
        throw new ValidationError("Listing id is required to create a booking.");
    }

    const listing = await Listing.findById(listingId).select("title price owner status");
    if (!listing) {
        throw new NotFoundError("Listing does not exist.");
    }

    if (!listing.price || listing.price <= 0) {
        throw new ValidationError("This listing cannot be booked because price is not configured.");
    }

    if (listing.owner && listing.owner.equals(guestId)) {
        throw new AuthorizationError("You cannot book your own listing.");
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

    const isRangeAvailable = await availabilityService.isDateRangeAvailable(listingId, checkIn, checkOut);
    if (!isRangeAvailable) {
        throw new ValidationError("Listing not available for selected dates");
    }

    const pricing = calculateBookingPrice({
        nightlyRate: listing.price,
        nights,
        serviceFeeRate: config.booking.serviceFeeRate,
    });

    const booking = new Booking({
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

    await booking.save();

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
    const booking = await Booking.findById(bookingId).populate("listing", "title");
    if (!booking) {
        throw new NotFoundError("Booking not found.");
    }

    if (booking.status === "cancelled") {
        throw new ConflictError("Booking is already cancelled.");
    }

    if (booking.status === "completed") {
        throw new ConflictError("Completed booking cannot be cancelled.");
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancellationReason || "Cancelled by guest";
    await booking.save();

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
