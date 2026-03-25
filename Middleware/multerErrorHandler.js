const multer = require("multer");

const resolveRedirectTarget = (req) => {
    const fallbackPath = "/listings";
    const referer = req.get("referer");

    if (!referer) return fallbackPath;

    try {
        const refererUrl = new URL(referer);
        const host = req.get("host");

        if (refererUrl.host !== host) {
            return fallbackPath;
        }

        return `${refererUrl.pathname || ""}${refererUrl.search || ""}` || fallbackPath;
    } catch (error) {
        return fallbackPath;
    }
};

module.exports = (err, req, res, next) => {
    if (!(err instanceof multer.MulterError)) {
        return next(err);
    }

    const isJsonRequest = req.originalUrl.startsWith("/api/") || req.get("accept")?.includes("application/json");
    if (isJsonRequest || typeof req.flash !== "function") {
        return next(err);
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
        req.flash("error", "You can upload maximum 5 images.");
        return res.redirect(resolveRedirectTarget(req));
    }

    if (err.code === "LIMIT_FILE_SIZE") {
        req.flash("error", "Image file size is too large.");
        return res.redirect(resolveRedirectTarget(req));
    }

    return next(err);
};
