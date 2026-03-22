const AppError = require("./AppError");

class NotFoundError extends AppError {
    constructor(message = "Resource not found.", details = null) {
        super(message, 404, details);
    }
}

module.exports = NotFoundError;
