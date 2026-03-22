const logger = require("../utils/logger");
const AppError = require("../errors/AppError");
const config = require("../config");

module.exports = (err, req, res, next) => {
    if (err.code === "EBADCSRFTOKEN") {
        err = new AppError("Invalid or missing CSRF token. Please refresh and try again.", 403);
    }

    if (err.name === "MulterError") {
        err = new AppError(err.message || "Invalid file upload request.", 400);
    }

    if (err.name === "SyntaxError" && "body" in err) {
        err = new AppError("Invalid JSON payload.", 400);
    }

    const status = err.status || 500;
    const isOperational = err instanceof AppError || Boolean(err.isOperational);
    const shouldExpose = !config.app.isProduction || status < 500 || isOperational;
    const message = shouldExpose
        ? (err.message || "Something went wrong!")
        : "Something went wrong. Please try again later.";

    logger.error("request.failed", {
        requestId: req.requestId || null,
        method: req.method,
        path: req.originalUrl,
        status,
        message,
        stack: err.stack,
        details: err.details || null,
    });

    const acceptsJson = req.originalUrl.startsWith("/api/") || req.get("accept")?.includes("application/json");

    if (acceptsJson) {
        return res.status(status).json({
            error: {
                message,
                status,
                requestId: req.requestId || null,
                details: shouldExpose ? (err.details || null) : null,
            },
        });
    }

    return res.status(status).render("error.ejs", {
        err: {
            status,
            message,
        },
    });
};
