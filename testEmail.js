require("dotenv").config();
const nodemailer = require("nodemailer");

const requiredEnvVars = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM",
];

const getMissingEnvVars = () => {
    return requiredEnvVars.filter((key) => !process.env[key]);
};

const parseSmtpPort = (value) => {
    const port = Number(value);
    return Number.isFinite(port) ? port : null;
};

const buildTransporter = () => {
    const smtpPort = parseSmtpPort(process.env.SMTP_PORT);

    if (!smtpPort) {
        throw new Error("SMTP_PORT must be a valid number.");
    }

    const isSecure = smtpPort === 465;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: isSecure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

const sendTestEmail = async (transporter) => {
    const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.SMTP_USER,
        subject: "SMTP Test Email",
        text: "SMTP configuration is working successfully.",
    });

    return info;
};

const main = async () => {
    const missingEnvVars = getMissingEnvVars();

    if (missingEnvVars.length > 0) {
        console.error("SMTP test failed: Missing required environment variables:");
        for (const key of missingEnvVars) {
            console.error(`- ${key}`);
        }
        process.exitCode = 1;
        return;
    }

    try {
        const transporter = buildTransporter();

        console.log("Checking SMTP connection...");
        await transporter.verify();
        console.log("SMTP verify successful.");

        console.log("Sending test email...");
        const info = await sendTestEmail(transporter);
        console.log("Test email sent successfully.");
        console.log(`Message ID: ${info.messageId}`);

        process.exitCode = 0;
    } catch (error) {
        console.error("SMTP test failed.");
        console.error(error && error.message ? error.message : error);
        process.exitCode = 1;
    }
};

main();
