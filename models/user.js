const mongoose = require("mongoose");
const crypto = require("crypto");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;
const RESET_PASSWORD_TTL_MS = 30 * 60 * 1000;

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
        isVerified: {
            type: Boolean,
            default: false,
            index: true,
        },
        emailVerificationToken: {
            type: String,
            default: null,
            index: true,
        },
        emailVerificationExpires: {
            type: Date,
            default: null,
        },
        resetPasswordToken: {
            type: String,
            default: null,
            index: true,
        },
        resetPasswordExpires: {
            type: Date,
            default: null,
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
        loginAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        lockUntil: {
            type: Date,
            default: null,
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

userSchema.methods.isAccountLocked = function () {
    return Boolean(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.generateEmailVerificationToken = function () {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    this.emailVerificationToken = tokenHash;
    this.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    this.isVerified = false;

    return token;
};

userSchema.methods.generatePasswordResetToken = function () {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    this.resetPasswordToken = tokenHash;
    this.resetPasswordExpires = new Date(Date.now() + RESET_PASSWORD_TTL_MS);

    return token;
};

userSchema.methods.incrementLoginAttempts = async function () {
    const freshUser = await this.constructor.incrementLoginAttemptsById(this._id);

    this.loginAttempts = freshUser?.loginAttempts ?? this.loginAttempts;
    this.lockUntil = freshUser?.lockUntil ?? this.lockUntil;

    return this;
};

userSchema.methods.resetLoginAttempts = async function () {
    await this.constructor.updateOne(
        { _id: this._id },
        {
            $set: {
                loginAttempts: 0,
                lockUntil: null,
            },
        }
    );

    this.loginAttempts = 0;
    this.lockUntil = null;
    return this;
};

userSchema.statics.incrementLoginAttemptsById = async function (userId) {
    const now = new Date();
    const lockUntilValue = new Date(now.getTime() + LOGIN_LOCK_DURATION_MS);

    return this.findOneAndUpdate(
        { _id: userId },
        [
            {
                $set: {
                    _isLockedNow: { $gt: ["$lockUntil", now] },
                    _nextAttempts: {
                        $cond: [
                            { $gt: ["$lockUntil", now] },
                            { $ifNull: ["$loginAttempts", 0] },
                            { $add: [{ $ifNull: ["$loginAttempts", 0] }, 1] },
                        ],
                    },
                },
            },
            {
                $set: {
                    loginAttempts: "$_nextAttempts",
                    lockUntil: {
                        $cond: [
                            "$_isLockedNow",
                            "$lockUntil",
                            {
                                $cond: [
                                    { $gte: ["$_nextAttempts", MAX_LOGIN_ATTEMPTS] },
                                    lockUntilValue,
                                    null,
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $unset: ["_isLockedNow", "_nextAttempts"],
            },
        ],
        {
            new: true,
            projection: { loginAttempts: 1, lockUntil: 1 },
            updatePipeline: true 
        }
    );
};

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);