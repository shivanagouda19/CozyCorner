class AppError extends Error {
    constructor(message, status = 500, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace?.(this, this.constructor);
    }
}

module.exports = AppError;
