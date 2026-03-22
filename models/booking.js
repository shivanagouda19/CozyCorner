const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
    {
        guest: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        host: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        listing: {
            type: Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
            index: true,
        },
        checkIn: {
            type: Date,
            required: true,
        },
        checkOut: {
            type: Date,
            required: true,
        },
        guestsCount: {
            type: Number,
            min: 1,
            default: 1,
        },
        nights: {
            type: Number,
            min: 1,
            required: true,
        },
        nightlyRate: {
            type: Number,
            min: 0,
            required: true,
        },
        serviceFee: {
            type: Number,
            min: 0,
            default: 0,
        },
        totalPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: "USD",
            uppercase: true,
            minlength: 3,
            maxlength: 3,
        },
        status: {
            type: String,
            enum: ["pending", "confirmed", "rejected", "cancelled", "completed"],
            default: "pending",
            index: true,
        },
        cancelledAt: Date,
        cancellationReason: {
            type: String,
            trim: true,
            maxlength: 500,
        },
    },
    {
        timestamps: true,
    }
);

bookingSchema.index({ guest: 1, status: 1, checkIn: 1 });
bookingSchema.index({ host: 1, status: 1, checkIn: 1 });
bookingSchema.index({ listing: 1, checkIn: 1, checkOut: 1 });

bookingSchema.pre("validate", function () {
    if (this.checkIn && this.checkOut && this.checkOut <= this.checkIn) {
        throw new Error("checkOut must be later than checkIn");
    }
});

module.exports = mongoose.model("Booking", bookingSchema);
