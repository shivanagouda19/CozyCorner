const Joi = require("joi");

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

const signupSchema = Joi.object({
    username: Joi.string()
        .trim()
        .alphanum()
        .min(3)
        .max(30)
        .required()
        .messages({
            "string.empty": "Username is required.",
            "string.alphanum": "Username must contain only letters and numbers.",
            "string.min": "Username must be at least 3 characters long.",
            "string.max": "Username must be at most 30 characters long.",
            "any.required": "Username is required.",
        }),
    email: Joi.string()
        .trim()
        .lowercase()
        .email({ tlds: { allow: false } })
        .required()
        .messages({
            "string.empty": "Email is required.",
            "string.email": "Please provide a valid email address.",
            "any.required": "Email is required.",
        }),
    password: Joi.string()
        .min(10)
        .max(128)
        .pattern(PASSWORD_PATTERN)
        .required()
        .messages({
            "string.empty": "Password is required.",
            "string.min": "Password must be at least 10 characters long.",
            "string.max": "Password must not exceed 128 characters.",
            "string.pattern.base": "Password must contain uppercase, lowercase, number, special character and be at least 10 chars",
            "any.required": "Password is required.",
        }),
    confirmPassword: Joi.string()
        .required()
        .valid(Joi.ref("password"))
        .messages({
            "string.empty": "Confirm password is required.",
            "any.only": "Confirm password must match password.",
            "any.required": "Confirm password is required.",
        }),
});

module.exports = {
    signupSchema,
};
