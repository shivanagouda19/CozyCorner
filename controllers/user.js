const User = require("../models/user.js");
const config = require("../config");
const passport = require("passport");
const logger = require("../utils/logger");
const crypto = require("crypto");
const ConflictError = require("../errors/ConflictError");
const {
	signupWithVerification,
	resendVerificationForIdentifier,
	requestPasswordResetByEmail,
	verifyEmailToken,
} = require("../services/authService");

module.exports.renderSignupForm = (req, res) => {
	res.render("users/signup");
};

module.exports.signup = async (req, res, next) => {
	try {
		const { username, email, password } = req.body;
		await signupWithVerification({
			username,
			email,
			password,
			requestMeta: {
				requestId: req.requestId || null,
				ip: req.ip,
			},
		});

		req.flash("success", "Account created. Please verify your email to continue.");
		return res.redirect("/login");
	} catch (e) {
		if (e instanceof ConflictError) {
			req.flash("error", e.message);
			return res.redirect("/signup");
		}

		return next(e);
	}
};

module.exports.verifyEmail = async (req, res, next) => {
	try {
		const result = await verifyEmailToken({
			token: req.params.token,
			requestMeta: {
				requestId: req.requestId || null,
				ip: req.ip,
			},
		});

		if (result.status === "already_verified") {
			req.flash("success", "Account already verified.");
			return res.redirect("/login");
		}

		if (result.status === "invalid_or_expired") {
			req.flash("error", "Verification link expired or invalid.");
			return res.redirect("/login");
		}

		req.flash("success", "Email verified successfully. You can now login.");
		return res.redirect("/login");

	} catch (err) {
		return next(err);
	}
};

module.exports.resendVerificationEmail = async (req, res, next) => {
	try {
		const genericMessage = "If your account exists, verification email has been sent";

		await resendVerificationForIdentifier({
			identifier: req.body.identifier || req.body.username || req.body.email,
			requestMeta: {
				requestId: req.requestId || null,
				ip: req.ip,
			},
		});

		req.flash("success", genericMessage);
		return res.redirect("/login");
	} catch (err) {
		return next(err);
	}
};

module.exports.renderLoginForm = (req, res) => {
	res.render("users/login.ejs");
};

module.exports.renderForgotPasswordForm = (req, res) => {
	res.render("users/forgot-password.ejs");
};

module.exports.requestPasswordReset = async (req, res, next) => {
	try {
		const genericMessage = "If your account exists, password reset email has been sent";

		await requestPasswordResetByEmail({
			email: req.body.email,
			requestMeta: {
				requestId: req.requestId || null,
				ip: req.ip,
			},
		});

		req.flash("success", genericMessage);
		return res.redirect("/forgot-password");
	} catch (err) {
		return next(err);
	}
};

module.exports.renderResetPasswordForm = async (req, res, next) => {
	try {
		const token = String(req.params.token || "").trim();
		if (!token) {
			req.flash("error", "Reset link is invalid or expired.");
			return res.redirect("/forgot-password");
		}

		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
		const user = await User.findOne({
			resetPasswordToken: tokenHash,
			resetPasswordExpires: { $gt: new Date() },
		}).select("_id");

		if (!user) {
			req.flash("error", "Reset link is invalid or expired.");
			return res.redirect("/forgot-password");
		}

		return res.render("users/reset-password.ejs", { token });
	} catch (err) {
		return next(err);
	}
};

module.exports.resetPassword = async (req, res, next) => {
	try {
		const token = String(req.params.token || "").trim();
		const password = String(req.body.password || "");
		const confirmPassword = String(req.body.confirmPassword || "");

		if (!token) {
			req.flash("error", "Reset link is invalid or expired.");
			return res.redirect("/forgot-password");
		}

		const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;
		if (!passwordPolicy.test(password)) {
			req.flash("error", "Password must contain uppercase, lowercase, number, special character and be at least 10 chars");
			return res.redirect(`/reset-password/${token}`);
		}

		if (password !== confirmPassword) {
			req.flash("error", "Confirm password must match password.");
			return res.redirect(`/reset-password/${token}`);
		}

		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
		const user = await User.findOne({
			resetPasswordToken: tokenHash,
			resetPasswordExpires: { $gt: new Date() },
		});

		if (!user) {
			req.flash("error", "Reset link is invalid or expired.");
			return res.redirect("/forgot-password");
		}

		await user.setPassword(password);
		user.resetPasswordToken = null;
		user.resetPasswordExpires = null;
		await user.save({ validateBeforeSave: false });

		logger.info("security.passwordReset.completed", {
			requestId: req.requestId || null,
			userId: String(user._id),
			ip: req.ip,
		});

		req.flash("success", "Password reset successful. Please log in.");
		return res.redirect("/login");
	} catch (err) {
		return next(err);
	}
};

module.exports.login = async (req, res, next) => {
	try {
		const attemptedUsername = String(req.body.username || "").trim();
		const genericLoginFailureMessage = "Invalid username or password";
		const user = await User.findOne({ username: attemptedUsername }).select("loginAttempts lockUntil username isVerified");

		// Auto-unlock expired lockouts before any password validation attempt.
		if (user?.lockUntil && user.lockUntil <= new Date()) {
			await user.resetLoginAttempts();

			logger.info("security.login.autoUnlocked", {
				requestId: req.requestId || null,
				username: attemptedUsername,
				userId: String(user._id),
				ip: req.ip,
			});
		}

		if (user?.isAccountLocked()) {
			logger.warn("security.login.locked", {
				requestId: req.requestId || null,
				username: attemptedUsername,
				userId: String(user._id),
				lockUntil: user.lockUntil,
				ip: req.ip,
			});

			req.flash("error", genericLoginFailureMessage);
			return res.redirect("/login");
		}

		if (user && !user.isVerified) {
			logger.warn("security.login.unverified", {
				requestId: req.requestId || null,
				username: attemptedUsername,
				userId: String(user._id),
				ip: req.ip,
			});

			req.flash("error", genericLoginFailureMessage);
			return res.redirect("/login");
		}

		return passport.authenticate("local", (authErr, authenticatedUser) => {
			if (authErr) {
				return next(authErr);
			}

			(async () => {
				if (!authenticatedUser) {
					if (user) {
						await user.incrementLoginAttempts();

						logger.warn("security.login.failed", {
							requestId: req.requestId || null,
							username: attemptedUsername,
							userId: String(user._id),
							attempts: user.loginAttempts,
							locked: user.isAccountLocked(),
							ip: req.ip,
						});

						if (user.isAccountLocked()) {
							logger.warn("security.login.accountLocked", {
								requestId: req.requestId || null,
								username: attemptedUsername,
								userId: String(user._id),
								lockUntil: user.lockUntil,
								ip: req.ip,
							});
						}
					} else {
						logger.warn("security.login.failed", {
							requestId: req.requestId || null,
							username: attemptedUsername,
							userId: null,
							attempts: null,
							locked: false,
							ip: req.ip,
						});
					}

					req.flash("error", genericLoginFailureMessage);
					return res.redirect("/login");
				}

				await authenticatedUser.resetLoginAttempts();

				const redirectUrl = res.locals.redirectUrl || "/listings";

				req.session.regenerate((sessionError) => {
					if (sessionError) {
						req.flash("error", "We could not refresh your session. Please try again.");
						return res.redirect("/login");
					}

					req.login(authenticatedUser, (loginError) => {
						if (loginError) {
							req.flash("error", "Login session could not be established. Please try again.");
							return res.redirect("/login");
						}

						req.flash("success", "Welcome back to Wanderlust!");
						return res.redirect(redirectUrl);
					});
				});
			})().catch((callbackError) => next(callbackError));
		})(req, res, next);
	} catch (err) {
		return next(err);
	}
};

module.exports.logout = (req, res, next) => {
	req.logout((err) => {
		if (err) {
			return next(err);
		}

		req.session.regenerate((sessionError) => {
			if (sessionError) {
				return next(sessionError);
			}

			res.clearCookie(config.session.name);
			req.flash("success", "you are logged out!");
			return res.redirect("/listings");
		});
	});
};
