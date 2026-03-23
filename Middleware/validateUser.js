const AppError = require("../errors/AppError");
const { signupSchema } = require("../validators/userValidator");

const formatJoiDetails = (details = []) => {
    return details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
    }));
};

const validateSignup = (req, res, next) => {
    const { error, value } = signupSchema.validate(
        {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            confirmPassword: req.body.confirmPassword,
        },
        {
            abortEarly: false,
            stripUnknown: true,
        }
    );

    if (error) {
        const details = formatJoiDetails(error.details);
        const message = details.map((detail) => detail.message).join(" ");
        return next(new AppError(message, 400, details));
    }

    req.body = {
        ...req.body,
        ...value,
    };

    delete req.body.confirmPassword;

    return next();
};

module.exports = {
    validateSignup,
};
