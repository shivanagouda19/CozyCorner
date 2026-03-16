const Joi = require('joi');
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
        image: Joi.object({
            url: Joi.string().allow("", null),
            filename: Joi.string().allow("", null),
        }).allow(null),
    }).required()
});


module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required(),
});

module.exports.profileUpdateSchema = Joi.object({
    profile: Joi.object({
        fullName: Joi.string().trim().min(2).max(80).required(),
        bio: Joi.string().trim().allow("").max(600),
        location: Joi.string().trim().allow("").max(120),
        languages: Joi.array().items(Joi.string().trim().max(40)).max(12),
    }).required(),
});

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
});

module.exports.passwordChangeSchema = Joi.object({
    password: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).max(128).required(),
        confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required(),
    }).required(),
});

module.exports.deleteAccountSchema = Joi.object({
    account: Joi.object({
        password: Joi.string().required(),
        confirmationText: Joi.string().valid("DELETE").required(),
    }).required(),
});