const nodemailer = require("nodemailer");
const config = require("../config");
const logger = require("../utils/logger");
const ExternalServiceError = require("../errors/ExternalServiceError");

const hasSmtpConfig = () => {
    return Boolean(config.email.host && config.email.user && config.email.pass);
};

const createTransporter = () => {
    if (!hasSmtpConfig()) {
        return null;
    }

    return nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
            user: config.email.user,
            pass: config.email.pass,
        },
    });
};

const sendVerificationEmail = async ({ to, username, verificationUrl }) => {
    const transporter = createTransporter();

    if (!transporter) {
        if (config.app.isProduction) {
            throw new ExternalServiceError("Email service is not configured.");
        }

        logger.warn("email.verification.skipped", {
            reason: "smtp_not_configured",
            to,
            username,
        });
        logger.info("email.verification.link", {
            to,
            verificationUrl,
        });
        return;
    }

    try {
        await transporter.sendMail({
            from: config.email.from,
            to,
            subject: "Verify your Wanderlust email",
            text: [
                `Hello ${username},`,
                "",
                "Verify your email by opening the link below:",
                verificationUrl,
                "",
                "This link expires in 1 hour.",
            ].join("\n"),
            html: `<p>Hello ${username},</p><p>Verify your email by clicking the link below:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 1 hour.</p>`,
        });

        logger.info("email.verification.sent", {
            to,
        });
    } catch (error) {
        throw new ExternalServiceError("Unable to send verification email.", {
            reason: error.message,
        });
    }
};

const sendPasswordResetEmail = async ({ to, username, resetUrl }) => {
    const transporter = createTransporter();

    if (!transporter) {
        if (config.app.isProduction) {
            throw new ExternalServiceError("Email service is not configured.");
        }

        logger.warn("email.passwordReset.skipped", {
            reason: "smtp_not_configured",
            to,
            username,
        });
        logger.info("email.passwordReset.link", {
            to,
            resetUrl,
        });
        return;
    }

    try {
        await transporter.sendMail({
            from: config.email.from,
            to,
            subject: "Reset your Wanderlust password",
            text: [
                `Hello ${username},`,
                "",
                "You requested a password reset. Open the link below to continue:",
                resetUrl,
                "",
                "This link expires in 30 minutes.",
                "If you did not request this, you can ignore this email.",
            ].join("\n"),
            html: `<p>Hello ${username},</p><p>You requested a password reset. Click the link below to continue:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes.</p><p>If you did not request this, you can ignore this email.</p>`,
        });

        logger.info("email.passwordReset.sent", {
            to,
        });
    } catch (error) {
        throw new ExternalServiceError("Unable to send password reset email.", {
            reason: error.message,
        });
    }
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
};
