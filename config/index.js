const VALID_ENVS = new Set(["development", "test", "production"]);
const env = process.env.NODE_ENV || "development";

if (!VALID_ENVS.has(env)) {
    throw new Error(`Invalid NODE_ENV value: ${env}. Use development, test, or production.`);
}

const isProduction = env === "production";

const getRequired = (key) => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
};

const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toSameSite = (value, fallback = "lax") => {
    const normalized = String(value || fallback).trim().toLowerCase();
    if (["strict", "lax", "none"].includes(normalized)) {
        return normalized;
    }
    return fallback;
};

const mongoUrl = getRequired("ATLASDB");
const sessionSecret = process.env.SESSION_SECRET || process.env.SECRET;

if (!sessionSecret) {
    throw new Error("Missing required environment variable: SESSION_SECRET (or legacy SECRET)");
}

if (isProduction) {
    const productionRequired = ["CLOUD_NAME", "CLOUD_API_KEY", "CLOUD_API_SECRET", "MAPBOX_TOKEN"];
    const missingProdVars = productionRequired.filter((key) => !process.env[key]);
    if (missingProdVars.length) {
        throw new Error(`Missing required production environment variable(s): ${missingProdVars.join(", ")}`);
    }
}

const config = {
    app: {
        env,
        isProduction,
        port: toNumber(process.env.PORT, 8080),
        baseUrl: process.env.APP_BASE_URL || `http://localhost:${toNumber(process.env.PORT, 8080)}`,
    },
    db: {
        mongoUrl,
    },
    session: {
        secret: sessionSecret,
        name: process.env.SESSION_NAME || "wl.sid",
        maxAgeMs: toNumber(process.env.SESSION_MAX_AGE_MS, 1000 * 60 * 60 * 24 * 3),
        sameSite: toSameSite(process.env.SESSION_SAME_SITE, "lax"),
        secureCookies: isProduction,
    },
    security: {
        rateLimitWindowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        rateLimitMax: toNumber(process.env.RATE_LIMIT_MAX, isProduction ? 180 : 300),
        authRateLimitMax: toNumber(process.env.AUTH_RATE_LIMIT_MAX, 15),
    },
    integrations: {
        mapboxToken: process.env.MAPBOX_TOKEN || "",
        cloudinary: {
            cloudName: process.env.CLOUD_NAME || "",
            apiKey: process.env.CLOUD_API_KEY || "",
            apiSecret: process.env.CLOUD_API_SECRET || "",
        },
    },
    booking: {
        serviceFeeRate: 0.12,
        maxBookableNights: 60,
    },
    logging: {
        level: process.env.LOG_LEVEL || "info",
    },
    email: {
        from: process.env.EMAIL_FROM || "no-reply@wanderlust.local",
        host: process.env.SMTP_HOST || "",
        port: toNumber(process.env.SMTP_PORT, 587),
        secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
    },
};

module.exports = config;
