const User = require("../models/user.js");
const config = require("../config");

module.exports.renderSignupForm = (req, res) => {
	res.render("users/signup");
};

module.exports.signup = async (req, res, next) => {
	try {
		const { username, email, password } = req.body;
		const safeUsername = username?.trim();
		const safeEmail = email?.trim().toLowerCase();
		const newUser = new User({ email: safeEmail, username: safeUsername });
		const registeredUser = await User.register(newUser, password);

		req.login(registeredUser, (err) => {
			if (err) {
				return next(err);
			}
			req.flash("success", "Welcome to Wanderlust!");
			res.redirect("/listings");
		});
	} catch (e) {
		req.flash("error", e.message);
		res.redirect("/signup");
	}
};

module.exports.renderLoginForm = (req, res) => {
	res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
	const redirectUrl = res.locals.redirectUrl || "/listings";
	const authenticatedUser = req.user;

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
