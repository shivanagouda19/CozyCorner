const Joi = require('joi');

const passwordPolicy = Joi.string()
    .min(10)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/)
    .messages({
        "string.pattern.base": "Password must include uppercase, lowercase, number, and special character.",
    });

module.exports.authSignupSchema = Joi.object({
    username: Joi.string().trim().min(3).max(40).required(),
    email: Joi.string().trim().email().required(),
    password: passwordPolicy.required(),
}).unknown(true);

module.exports.authLoginSchema = Joi.object({
    username: Joi.string().trim().required(),
    password: Joi.string().required(),
}).unknown(true);

module.exports.listingSchema = Joi.object({
    listing:Joi.object({
        title : Joi.string().required(),
        description : Joi.string().required(),
        location:Joi.string().required(),
        country:Joi.string().required(),
        price:Joi.number().required().min(0),
        geometry: Joi.object({
            type: Joi.string().valid("Point").optional(),
            coordinates: Joi.array().items(Joi.number()).length(2).optional(),
        }).optional(),
        category: Joi.string()
            .valid("villa", "apartment", "farmhouse", "room", "hotel")
            .required(),
        image: Joi.object({
            url: Joi.string().allow("", null),
            filename: Joi.string().allow("", null),
        }).allow(null),
    }).required()
    }).unknown(true);


module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required(),
    }).unknown(true);

module.exports.profileUpdateSchema = Joi.object({
    profile: Joi.object({
        fullName: Joi.string().trim().min(2).max(80).required(),
        bio: Joi.string().trim().allow("").max(600),
        location: Joi.string().trim().allow("").max(120),
        languages: Joi.array().items(Joi.string().trim().max(40)).max(12),
    }).required(),
    }).unknown(true);

module.exports.accountSettingsSchema = Joi.object({
    account: Joi.object({
        email: Joi.string().email().required(),
        phoneNumber: Joi.string().trim().allow("").max(30),
        notificationPreferences: Joi.object({
            bookingUpdates: Joi.boolean(),
            promotions: Joi.boolean(),
            reminders: Joi.boolean(),
            accountAlerts: Joi.boolean(),
        }).default({}),
    }).required(),
    }).unknown(true);

module.exports.passwordChangeSchema = Joi.object({
    password: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: passwordPolicy.required(),
        confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required(),
    }).required(),
    }).unknown(true);

module.exports.deleteAccountSchema = Joi.object({
    account: Joi.object({
        password: Joi.string().required(),
        confirmationText: Joi.string().valid("DELETE").required(),
    }).required(),
    }).unknown(true);

module.exports.bookingCreateSchema = Joi.object({
    booking: Joi.object({
        checkIn: Joi.date().required(),
        checkOut: Joi.date().greater(Joi.ref("checkIn")).required(),
        guestsCount: Joi.number().integer().min(1).max(16).default(1),
    }).required(),
    }).unknown(true);

module.exports.bookingCancelSchema = Joi.object({
    booking: Joi.object({
        cancellationReason: Joi.string().trim().allow("").max(500),
    }).default({}),
    }).unknown(true);

module.exports.bookingStatusUpdateSchema = Joi.object({
    booking: Joi.object({
        status: Joi.string().valid("confirmed", "rejected").required(),
    }).required(),
}).unknown(true);