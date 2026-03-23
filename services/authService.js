const User = require("../models/user");
const config = require("../config");
const logger = require("../utils/logger");
const crypto = require("crypto");
const ConflictError = require("../errors/ConflictError");
const { sendVerificationEmail, sendPasswordResetEmail } = require("./emailService");

const buildAppUrl = (pathname) => {
    return new URL(pathname, config.app.baseUrl).toString();
};

const signupWithVerification = async ({ username, email, password, requestMeta = {} }) => {
    const safeUsername = String(username || "").trim();
    const safeEmail = String(email || "").trim().toLowerCase();

    try {
        const newUser = new User({ email: safeEmail, username: safeUsername });
        const registeredUser = await User.register(newUser, password);
        const verificationToken = registeredUser.generateEmailVerificationToken();

        await registeredUser.save({ validateBeforeSave: false });

        const verificationUrl = buildAppUrl(`/verify-email/${encodeURIComponent(verificationToken)}`);
        await sendVerificationEmail({
            to: registeredUser.email,
            username: registeredUser.username,
            verificationUrl,
        });

        logger.info("security.verification.signupEmailSent", {
            requestId: requestMeta.requestId || null,
            userId: String(registeredUser._id),
            username: registeredUser.username,
            ip: requestMeta.ip || null,
        });

        return { userId: String(registeredUser._id) };
    } catch (error) {
        if (error?.name === "UserExistsError") {
            throw new ConflictError("Username is already taken.");
        }

        if (error?.code === 11000) {
            throw new ConflictError("An account with this email already exists.");
        }

        throw error;
    }
};

const resendVerificationForIdentifier = async ({ identifier, requestMeta = {} }) => {
    const rawIdentifier = String(identifier || "").trim();
    const normalizedEmail = rawIdentifier.toLowerCase();

    if (!rawIdentifier) {
        return { delivered: false };
    }

    const user = await User.findOne({
        $or: [
            { username: rawIdentifier },
            { email: normalizedEmail },
        ],
    }).select("_id username email isVerified");

    if (!user) {
        logger.info("security.verification.resend.request", {
            requestId: requestMeta.requestId || null,
            identifier: rawIdentifier,
            userId: null,
            status: "no_user",
            ip: requestMeta.ip || null,
        });
        return { delivered: false };
    }

    if (user.isVerified) {
        logger.info("security.verification.resend.request", {
            requestId: requestMeta.requestId || null,
            identifier: rawIdentifier,
            userId: String(user._id),
            status: "already_verified",
            ip: requestMeta.ip || null,
        });
        return { delivered: false };
    }

    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = buildAppUrl(`/verify-email/${encodeURIComponent(verificationToken)}`);
    await sendVerificationEmail({
        to: user.email,
        username: user.username,
        verificationUrl,
    });

    logger.info("security.verification.resend.request", {
        requestId: requestMeta.requestId || null,
        identifier: rawIdentifier,
        userId: String(user._id),
        status: "resent",
        ip: requestMeta.ip || null,
    });

    return { delivered: true };
};

const requestPasswordResetByEmail = async ({ email, requestMeta = {} }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
        return { delivered: false };
    }

    const user = await User.findOne({ email: normalizedEmail }).select("_id username email");

    if (!user) {
        logger.info("security.passwordReset.request", {
            requestId: requestMeta.requestId || null,
            email: normalizedEmail,
            userId: null,
            status: "no_user",
            ip: requestMeta.ip || null,
        });
        return { delivered: false };
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = buildAppUrl(`/reset-password/${encodeURIComponent(resetToken)}`);
    await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        resetUrl,
    });

    logger.info("security.passwordReset.request", {
        requestId: requestMeta.requestId || null,
        userId: String(user._id),
        email: user.email,
        status: "sent",
        ip: requestMeta.ip || null,
    });

    return { delivered: true };
};

const verifyEmailToken = async ({ token, requestMeta = {} }) => {
    const rawToken = String(token || "").trim();

    if (!rawToken) {
        return { status: "invalid_or_expired" };
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const now = Date.now();

    const user = await User.findOne({ emailVerificationToken: tokenHash }).select(
        "_id username isVerified emailVerificationExpires verification"
    );

    if (!user) {
        logger.info("security.verification.confirm", {
            requestId: requestMeta.requestId || null,
            userId: null,
            status: "invalid_or_expired",
            ip: requestMeta.ip || null,
        });
        return { status: "invalid_or_expired" };
    }

    if (user.isVerified) {
        logger.info("security.verification.confirm", {
            requestId: requestMeta.requestId || null,
            userId: String(user._id),
            status: "already_verified",
            ip: requestMeta.ip || null,
        });
        return { status: "already_verified" };
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() <= now) {
        logger.info("security.verification.confirm", {
            requestId: requestMeta.requestId || null,
            userId: String(user._id),
            status: "invalid_or_expired",
            ip: requestMeta.ip || null,
        });
        return { status: "invalid_or_expired" };
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    if (user.verification) {
        user.verification.emailVerified = true;
    }
    await user.save({ validateBeforeSave: false });

    logger.info("security.verification.confirm", {
        requestId: requestMeta.requestId || null,
        userId: String(user._id),
        status: "verified",
        ip: requestMeta.ip || null,
    });

    return { status: "verified" };
};

module.exports = {
    signupWithVerification,
    resendVerificationForIdentifier,
    requestPasswordResetByEmail,
    verifyEmailToken,
    buildAppUrl,
};
