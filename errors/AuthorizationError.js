const AppError = require("./AppError");

class AuthorizationError extends AppError {
    constructor(message = "You are not allowed to perform this action.", details = null) {
        super(message, 403, details);
    }
}

module.exports = AuthorizationError;
