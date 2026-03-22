const config = require("../config");
const bookingService = require("../services/bookingService");
const {
    enqueueBookingConfirmationEmail,
    enqueueHostBookingNotification,
} = require("../jobs/bookingJobs");

module.exports.createBooking = async (req, res) => {
    const { id: listingId } = req.params;

    try {
        const { booking, listingTitle } = await bookingService.createBooking({
            listingId,
            guestId: req.user._id,
            bookingInput: req.body.booking,
        });

        enqueueBookingConfirmationEmail({
            bookingId: booking._id.toString(),
            guestEmail: req.user.email,
            listingTitle,
        });

        enqueueHostBookingNotification({
            bookingId: booking._id.toString(),
            hostId: booking.host?.toString(),
            listingId: booking.listing?.toString(),
        });

        req.flash("success", `Booking placed for ${listingTitle}.`);
        return res.redirect(`/bookings/${booking._id}/success`);
    } catch (error) {
        req.flash("error", error.message || "Unable to create booking right now.");
        return res.redirect(listingId ? `/listings/${listingId}` : "/listings");
    }
};

module.exports.getListingAvailability = async (req, res) => {
    const { id: listingId } = req.params;
    const unavailable = await bookingService.getListingUnavailableDateRanges(listingId);

    return res.json({
        listingId,
        unavailable,
    });
};

module.exports.getBookingSuccess = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await bookingService.getBookingSuccessPayload({
        bookingId,
        guestId: req.user._id,
    });

    return res.render("bookings/success.ejs", { booking });
};

module.exports.cancelBooking = async (req, res) => {
    const { bookingId } = req.params;
    try {
        const booking = await bookingService.cancelBooking({
            bookingId,
            cancellationReason: req.body.booking?.cancellationReason,
        });

        req.flash("success", `Booking cancelled for ${booking.listing?.title || "listing"}.`);
        return res.redirect("/bookings/my");
    } catch (error) {
        req.flash("error", error.message || "Unable to cancel booking right now.");
        return res.redirect("/bookings/my");
    }
};

module.exports.getUserBookings = async (req, res) => {
    const { pending, confirmed, completed, cancelled, rejected } = await bookingService.getUserBookings(req.user._id);

    res.render("bookings/user.ejs", {
        bookingData: {
            pending,
            confirmed,
            completed,
            cancelled,
            rejected,
            serviceFeeRatePercent: config.booking.serviceFeeRate * 100,
        },
    });
};

module.exports.getHostBookings = async (req, res) => {
    const { pending, confirmed, completed, cancelled, rejected } = await bookingService.getHostBookings(
        req.user._id,
        { listingId: req.query.listingId }
    );

    res.render("bookings/host.ejs", {
        bookingData: {
            pending,
            confirmed,
            completed,
            cancelled,
            rejected,
        },
    });
};

module.exports.updateHostBookingStatus = async (req, res) => {
    const { id } = req.params;
    const nextStatus = req.body.booking?.status;

    try {
        const booking = await bookingService.updateHostBookingStatus({
            bookingId: id,
            hostId: req.user._id,
            nextStatus,
        });

        const actionLabel = booking.status === "confirmed" ? "accepted" : "rejected";
        req.flash("success", `Booking ${actionLabel} successfully.`);
    } catch (error) {
        req.flash("error", error.message || "Unable to update booking status.");
    }

    return res.redirect("/profile/bookings/host");
};
