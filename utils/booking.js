const SERVICE_FEE_RATE = 0.12;
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

const parseDateInput = (value) => {
    if (!value || typeof value !== "string") return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfTodayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const calculateNights = (checkIn, checkOut) => {
    if (!(checkIn instanceof Date) || !(checkOut instanceof Date)) return 0;
    const ms = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const calculateBookingPrice = ({ nightlyRate, nights, serviceFeeRate = SERVICE_FEE_RATE }) => {
    const safeNightlyRate = Number(nightlyRate) || 0;
    const safeNights = Number(nights) || 0;

    const subtotal = safeNightlyRate * safeNights;
    const serviceFee = Number((subtotal * serviceFeeRate).toFixed(2));
    const totalPrice = Number((subtotal + serviceFee).toFixed(2));

    return {
        subtotal,
        serviceFee,
        totalPrice,
        serviceFeeRate,
    };
};

const getOverlapQuery = ({ listingId, checkIn, checkOut }) => ({
    listing: listingId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
});

module.exports = {
    ACTIVE_BOOKING_STATUSES,
    SERVICE_FEE_RATE,
    calculateBookingPrice,
    calculateNights,
    getOverlapQuery,
    parseDateInput,
    startOfTodayUtc,
};
