const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;
const userSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        fullName: {
            type: String,
            trim: true,
            default: "",
            maxlength: 80,
        },
        bio: {
            type: String,
            trim: true,
            default: "",
            maxlength: 600,
        },
        location: {
            type: String,
            trim: true,
            default: "",
            maxlength: 120,
        },
        languages: {
            type: [String],
            default: [],
        },
        avatar: {
            url: {
                type: String,
                default: "",
            },
            filename: {
                type: String,
                default: "",
            },
        },
        phoneNumber: {
            type: String,
            trim: true,
            default: "",
            maxlength: 30,
        },
        notificationPreferences: {
            bookingUpdates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false },
            reminders: { type: Boolean, default: true },
            accountAlerts: { type: Boolean, default: true },
        },
        verification: {
            emailVerified: { type: Boolean, default: false },
            phoneVerified: { type: Boolean, default: false },
            governmentIdStatus: {
                type: String,
                enum: ["not_submitted", "pending", "verified", "rejected"],
                default: "not_submitted",
            },
        },
        badges: {
            superhost: { type: Boolean, default: false },
            identityVerified: { type: Boolean, default: false },
        },
        accountStatus: {
            type: String,
            enum: ["active", "suspended", "deleted"],
            default: "active",
        },
        wishlist: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Listing",
                },
            ],
            default: [],
        },
        lastLoginAt: Date,
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

userSchema.virtual("profileCompleteness").get(function () {
    const checks = [
        !!this.fullName,
        !!this.bio,
        !!this.location,
        Array.isArray(this.languages) && this.languages.length > 0,
        !!(this.avatar && this.avatar.url),
        !!this.phoneNumber,
        !!(this.verification && this.verification.emailVerified),
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
});

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);