const InMemoryQueue = require("./inMemoryQueue");
const logger = require("../utils/logger");

const bookingQueue = new InMemoryQueue("booking-events", { delayMs: 90 });

const enqueueBookingConfirmationEmail = (payload) => {
    bookingQueue.addWithHandler("booking.confirmation.email", payload, async (jobPayload) => {
        logger.info("job.booking.confirmation.sent", {
            bookingId: jobPayload.bookingId,
            guestEmail: jobPayload.guestEmail,
            listingTitle: jobPayload.listingTitle,
        });
    });
};

const enqueueHostBookingNotification = (payload) => {
    bookingQueue.addWithHandler("booking.host.notification", payload, async (jobPayload) => {
        logger.info("job.booking.host.notified", {
            bookingId: jobPayload.bookingId,
            hostId: jobPayload.hostId,
            listingId: jobPayload.listingId,
        });
    });
};

module.exports = {
    enqueueBookingConfirmationEmail,
    enqueueHostBookingNotification,
};
