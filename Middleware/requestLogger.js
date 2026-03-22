const { randomUUID } = require("node:crypto");
const logger = require("../utils/logger");

module.exports = (req, res, next) => {
    const requestId = req.headers["x-request-id"] || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    const start = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

        logger.info("request.completed", {
            requestId,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip: req.ip,
            userId: req.user?._id?.toString() || null,
        });
    });

    next();
};
