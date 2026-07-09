const nodemailer = require("nodemailer");
const config = require("../config");
const logger = require("../utils/logger");
const ExternalServiceError = require("../errors/ExternalServiceError");

const parseFromAddress = (value) => {
    const raw = String(value || "").trim();

    if (!raw) {
        return { email: "no-reply@wanderlust.local", name: "Wanderlust" };
    }

    const angleMatch = raw.match(/^(.*)<([^>]+)>$/);
    if (angleMatch) {
        const name = angleMatch[1].trim().replace(/^['"]|['"]$/g, "");
        const email = angleMatch[2].trim();
        return {
            email,
            name: name || undefined,
        };
    }

    return { email: raw, name: undefined };
};

const sendBrevoEmail = async ({ to, subject, text, html }) => {
    if (!config.email.brevoApiKey) {
        return false;
    }

    const from = parseFromAddress(config.email.from);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            accept: "application/json",
            "api-key": config.email.brevoApiKey,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            sender: from.name ? { name: from.name, email: from.email } : { email: from.email },
            to: [{ email: to }],
            subject,
            textContent: text,
            htmlContent: html,
        }),
    });

    if (!response.ok) {
        const responseText = await response.text();
        throw new ExternalServiceError("Unable to send email through Brevo API.", {
            reason: responseText || `Brevo API responded with ${response.status}`,
        });
    }

    return true;
};

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
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        auth: {
            user: config.email.user,
            pass: config.email.pass,
        },
    });
};

const sendVerificationEmail = async ({ to, username, verificationUrl }) => {
    const subject = "Verify your Wanderlust email";
    const text = [
        `Hello ${username},`,
        "",
        "Verify your email by opening the link below:",
        verificationUrl,
        "",
        "This link expires in 1 hour.",
    ].join("\n");
    const html = `<p>Hello ${username},</p><p>Verify your email by clicking the link below:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 1 hour.</p>`;

    try {
        if (await sendBrevoEmail({ to, subject, text, html })) {
            logger.info("email.verification.sent", {
                to,
                provider: "brevo_api",
            });
            return;
        }
    } catch (error) {
        throw new ExternalServiceError("Unable to send verification email.", {
            reason: error.details?.reason || error.message,
        });
    }

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
        logger.info("email.verification.send.started", {
            to,
            host: config.email.host || null,
            port: config.email.port,
            secure: config.email.secure,
        });

        await transporter.sendMail({
            from: config.email.from,
            to,
            subject,
            text,
            html,
        });

        logger.info("email.verification.sent", {
            to,
            provider: "smtp",
        });
    } catch (error) {
        throw new ExternalServiceError("Unable to send verification email.", {
            reason: error.message,
        });
    }
};

const sendPasswordResetEmail = async ({ to, username, resetUrl }) => {
    const subject = "Reset your Wanderlust password";
    const text = [
        `Hello ${username},`,
        "",
        "You requested a password reset. Open the link below to continue:",
        resetUrl,
        "",
        "This link expires in 30 minutes.",
        "If you did not request this, you can ignore this email.",
    ].join("\n");
    const html = `<p>Hello ${username},</p><p>You requested a password reset. Click the link below to continue:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes.</p><p>If you did not request this, you can ignore this email.</p>`;

    try {
        if (await sendBrevoEmail({ to, subject, text, html })) {
            logger.info("email.passwordReset.sent", {
                to,
                provider: "brevo_api",
            });
            return;
        }
    } catch (error) {
        throw new ExternalServiceError("Unable to send password reset email.", {
            reason: error.details?.reason || error.message,
        });
    }

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
        logger.info("email.passwordReset.send.started", {
            to,
            host: config.email.host || null,
            port: config.email.port,
            secure: config.email.secure,
        });

        await transporter.sendMail({
            from: config.email.from,
            to,
            subject,
            text,
            html,
        });

        logger.info("email.passwordReset.sent", {
            to,
            provider: "smtp",
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
