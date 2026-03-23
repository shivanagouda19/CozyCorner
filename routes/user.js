const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { saveRedirectUrl, validateLogin } = require("../middleware.js");
const { validateSignup } = require("../middleware/validateUser");
const userController = require("../controllers/user.js");

router
    .route("/signup")
    .get(userController.renderSignupForm)
    .post(validateSignup, wrapAsync(userController.signup));

router.route("/verify-email/:token").get(wrapAsync(userController.verifyEmail));
router.route("/resend-verification").post(wrapAsync(userController.resendVerificationEmail));
router
    .route("/forgot-password")
    .get(userController.renderForgotPasswordForm)
    .post(wrapAsync(userController.requestPasswordReset));
router
    .route("/reset-password/:token")
    .get(wrapAsync(userController.renderResetPasswordForm))
    .post(wrapAsync(userController.resetPassword));

router
    .route("/login")
    .get(userController.renderLoginForm)
    .post(
        validateLogin,
        saveRedirectUrl,
        userController.login
    );

router.route("/logout").get(userController.logout);

module.exports = router