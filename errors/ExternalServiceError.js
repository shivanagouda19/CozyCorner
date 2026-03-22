const AppError = require("./AppError");

class ExternalServiceError extends AppError {
    constructor(message = "External service unavailable.", details = null) {
        super(message, 503, details);
    }
}

module.exports = ExternalServiceError;
