const ConflictError = require("./ConflictError");

class BookingConflictError extends ConflictError {
    constructor(message = "Selected dates are no longer available.", details = null) {
        super(message, details);
    }
}

module.exports = BookingConflictError;
