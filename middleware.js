const Listing = require("./models/listing.js");
const Review = require("./models/review.js");
const Booking = require("./models/booking.js");
const ExpressError = require("./utils/ExpressError");
const {
    authSignupSchema,
    authLoginSchema,
    listingSchema,
    reviewSchema,
    profileUpdateSchema,
    accountSettingsSchema,
    passwordChangeSchema,
    deleteAccountSchema,
    bookingCreateSchema,
    bookingCancelSchema,
    bookingStatusUpdateSchema,
} = require("./schema.js");

const throwJoiError = (error) => {
    if (!error) return;
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
};

const validateSchema = (schema, payload) => {
    const { error } = schema.validate(payload, {
        abortEarly: false,
        stripUnknown: false,
    });
    throwJoiError(error);
};

const normalizeCommaSeparatedString = (value) => {
    return String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {  //req.isAuthenticated() is provided by passort to check is uder is logined
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "you must be logged in to create listing!");
        return res.redirect("/login");
    }
    next();
}

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing does not exist.");
        return res.redirect("/listings");
    }

    if (!res.locals.currUser || !listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error", "You don't have permission to edit");
        return res.redirect(`/listings/${id}`);
    }

    next();
}

module.exports.validateListing = (req, res, next)=>{
    validateSchema(listingSchema, { listing: req.body.listing });
    next();
}

module.exports.validateSignup = (req, res, next) => {
    validateSchema(authSignupSchema, {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
    });
    next();
};

module.exports.validateLogin = (req, res, next) => {
    validateSchema(authLoginSchema, {
        username: req.body.username,
        password: req.body.password,
    });
    next();
};

module.exports.validateReview = (req, res, next) => {
    validateSchema(reviewSchema, { review: req.body.review });
    next();
};

module.exports.isReviewAuthor = async (req, res, next) =>{
    let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if (!review.author.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the author of this review");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateProfileUpdate = (req, res, next) => {
    validateSchema(profileUpdateSchema, { profile: req.body.profile });
    next();
};

module.exports.normalizeProfileLanguages = (req, res, next) => {
    const profile = req.body?.profile;

    if (!profile || typeof profile !== "object") {
        return next();
    }

    if (typeof profile.languages === "string") {
        profile.languages = normalizeCommaSeparatedString(profile.languages);
    }

    return next();
};

module.exports.validateAccountSettings = (req, res, next) => {
    validateSchema(accountSettingsSchema, { account: req.body.account });
    next();
};

module.exports.validatePasswordChange = (req, res, next) => {
    validateSchema(passwordChangeSchema, { password: req.body.password });
    next();
};

module.exports.validateDeleteAccount = (req, res, next) => {
    validateSchema(deleteAccountSchema, { account: req.body.account });
    next();
};

module.exports.validateBookingCreate = (req, res, next) => {
    validateSchema(bookingCreateSchema, { booking: req.body.booking });
    next();
};

module.exports.validateBookingCancel = (req, res, next) => {
    validateSchema(bookingCancelSchema, { booking: req.body.booking });
    next();
};

module.exports.validateBookingStatusUpdate = (req, res, next) => {
    validateSchema(bookingStatusUpdateSchema, { booking: req.body.booking });
    next();
};

module.exports.isBookingOwner = async (req, res, next) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).select("guest listing");

    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect("/bookings/my");
    }

    if (!res.locals.currUser || !booking.guest.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not allowed to modify this booking.");
        return res.redirect("/bookings/my");
    }

    res.locals.currentBooking = booking;
    next();
};

module.exports.isBookingHost = async (req, res, next) => {
    const bookingId = req.params.id || req.params.bookingId;
    const booking = await Booking.findById(bookingId).select("host listing status");

    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect("/bookings/host");
    }

    if (!res.locals.currUser || !booking.host.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not allowed to modify this booking.");
        return res.redirect("/bookings/host");
    }

    res.locals.currentHostBooking = booking;
    next();
};