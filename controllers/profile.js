const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");
const Payout = require("../models/payout");
const { ACTIVE_BOOKING_STATUSES } = require("../utils/booking");

const safeObjectId = (id) => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;

const syncCompletedBookings = async (query) => {
    const now = new Date();
    await Booking.updateMany(
        {
            ...query,
            status: { $in: ACTIVE_BOOKING_STATUSES },
            checkOut: { $lt: now },
        },
        { $set: { status: "completed" } }
    );
};

const isJsonRequest = (req) => {
    const accept = req.get("accept") || "";
    return accept.includes("application/json") && !accept.includes("text/html");
};

const renderOrJson = (req, res, payload, redirectPath, flashMessage) => {
    if (isJsonRequest(req)) {
        return res.json(payload);
    }

    if (flashMessage) {
        req.flash("success", flashMessage);
    }

    return res.redirect(redirectPath);
};

const mapUserForProfileView = (user) => {
    if (!user) return null;

    const safeLanguages = Array.isArray(user.languages) ? user.languages : [];

    return {
        ...user,
        profile: {
            bio: user.bio || "",
            location: user.location || "",
            languages: safeLanguages,
        },
    };
};

const getBaseUser = async (userId) => {
    const user = await User.findById(userId)
        .select("username email fullName bio location languages avatar phoneNumber verification badges notificationPreferences createdAt profileCompleteness wishlist")
        .lean();

    return mapUserForProfileView(user);
};

const getReviewsReceivedData = async (userId) => {
    const hostListingsWithReviews = await Listing.find({ owner: userId })
        .select("title reviews")
        .populate({ path: "reviews", populate: { path: "author", select: "username fullName" } })
        .lean();

    const reviewsReceived = hostListingsWithReviews
        .flatMap((listing) =>
            (listing.reviews || []).map((review) => ({
                comment: review.comment,
                rating: review.rating,
                createdAt: review.createdAt,
                listingTitle: listing.title,
                authorName: review.author?.fullName || review.author?.username || "Guest",
            }))
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return reviewsReceived;
};

module.exports.getProfile = async (req, res) => {
    const userId = req.user._id;

    await syncCompletedBookings({ guest: userId });

    const [user, listingCount, reviewsReceivedCount, upcomingCount] = await Promise.all([
        getBaseUser(userId),
        Listing.countDocuments({ owner: userId }),
        Review.countDocuments({ listing: { $in: await Listing.find({ owner: userId }).distinct("_id") } }),
        Booking.countDocuments({ guest: userId, status: { $in: ACTIVE_BOOKING_STATUSES }, checkOut: { $gte: new Date() } }),
    ]);

    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
    }

    res.render("profile/index.ejs", {
        profileData: {
            user,
            stats: {
                listingCount,
                reviewsReceivedCount,
                upcomingCount,
            },
        },
        activeRoute: "profile",
    });
};

module.exports.renderEditProfileForm = async (req, res) => {
    const user = await getBaseUser(req.user._id);

    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
    }

    return res.render("profile/edit.ejs", {
        profileData: { user },
        activeRoute: "settings",
    });
};

module.exports.getSettings = async (req, res) => {
    const user = await getBaseUser(req.user._id);

    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
    }

    return res.render("profile/settings.ejs", {
        profileData: { user },
        activeRoute: "settings",
    });
};

module.exports.updateProfile = async (req, res) => {
    const { fullName, bio = "", location = "", languages = [] } = req.body.profile;
    const normalizedLanguages = Array.isArray(languages)
        ? languages.map((item) => String(item).trim()).filter(Boolean)
        : String(languages || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

    const updated = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                bio,
                location,
                languages: normalizedLanguages,
            },
        },
        { new: true, runValidators: true }
    ).select("username email fullName bio location languages avatar phoneNumber verification badges createdAt profileCompleteness");

    return renderOrJson(
        req,
        res,
        { message: "Profile updated", profile: updated },
        "/profile",
        "Profile updated successfully."
    );
};

module.exports.updateAccountSettings = async (req, res) => {
    const { email, phoneNumber = "", notificationPreferences = {} } = req.body.account;
    const updated = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                email,
                phoneNumber,
                notificationPreferences: {
                    bookingUpdates: !!notificationPreferences.bookingUpdates,
                    promotions: !!notificationPreferences.promotions,
                    reminders: !!notificationPreferences.reminders,
                    accountAlerts: !!notificationPreferences.accountAlerts,
                },
            },
        },
        { new: true, runValidators: true }
    ).select("username email phoneNumber notificationPreferences verification");

    return renderOrJson(
        req,
        res,
        { message: "Account settings updated", account: updated },
        "/profile/settings",
        "Account settings updated successfully."
    );
};

module.exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body.password;
    const user = await User.findById(req.user._id);

    if (!user) {
        if (isJsonRequest(req)) return res.status(404).json({ message: "User not found" });
        req.flash("error", "User not found");
        return res.redirect("/profile/settings");
    }

    const isValid = await user.authenticate(currentPassword);
    if (!isValid.user) {
        if (isJsonRequest(req)) return res.status(400).json({ message: "Current password is incorrect" });
        req.flash("error", "Current password is incorrect");
        return res.redirect("/profile/settings");
    }

    await user.setPassword(newPassword);
    await user.save();

    return renderOrJson(
        req,
        res,
        { message: "Password changed successfully" },
        "/profile/settings",
        "Password changed successfully."
    );
};

module.exports.deleteAccount = async (req, res) => {
    const { password } = req.body.account;
    const user = await User.findById(req.user._id);

    if (!user) {
        if (isJsonRequest(req)) return res.status(404).json({ message: "User not found" });
        req.flash("error", "User not found");
        return res.redirect("/profile/settings");
    }

    const authResult = await user.authenticate(password);
    if (!authResult.user) {
        if (isJsonRequest(req)) return res.status(400).json({ message: "Password is incorrect" });
        req.flash("error", "Password is incorrect");
        return res.redirect("/profile/settings");
    }

    await User.findByIdAndUpdate(req.user._id, { $set: { accountStatus: "deleted" } });

    return req.logout((err) => {
        if (err) {
            if (isJsonRequest(req)) {
                return res.status(500).json({ message: "Failed to logout after account deletion." });
            }
            req.flash("error", "Failed to logout after account deletion.");
            return res.redirect("/profile/settings");
        }

        if (isJsonRequest(req)) {
            return res.json({ message: "Account marked as deleted" });
        }

        req.flash("success", "Account marked as deleted.");
        return res.redirect("/login");
    });
};

module.exports.getHostListings = async (req, res) => {
    const [user, listings] = await Promise.all([
        getBaseUser(req.user._id),
        Listing.find({ owner: req.user._id })
        .select("title image price location country status createdAt")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.render("profile/listings.ejs", {
        profileData: { user, listings },
        activeRoute: "listings",
    });
};

module.exports.getBookings = async (req, res) => {
    const now = new Date();
    await syncCompletedBookings({ guest: req.user._id });

    const [user, upcoming, past, cancelled] = await Promise.all([
        getBaseUser(req.user._id),
        Booking.find({ guest: req.user._id, status: { $in: ACTIVE_BOOKING_STATUSES }, checkOut: { $gte: now } })
            .populate("listing", "title image location country")
            .sort({ checkIn: 1 })
            .lean(),
        Booking.find({ guest: req.user._id, $or: [{ status: "completed" }, { checkOut: { $lt: now } }] })
            .populate("listing", "title image location country")
            .sort({ checkIn: -1 })
            .lean(),
        Booking.find({ guest: req.user._id, status: "cancelled" })
            .populate("listing", "title image location country")
            .sort({ updatedAt: -1 })
            .lean(),
    ]);

    return res.render("profile/bookings.ejs", {
        profileData: {
            user,
            bookings: {
                upcoming,
                past,
                cancelled,
            },
        },
        activeRoute: "bookings",
    });
};

module.exports.getWishlist = async (req, res) => {
    const user = await User.findById(req.user._id)
        .select("username email fullName bio location languages avatar phoneNumber verification badges notificationPreferences createdAt profileCompleteness wishlist")
        .lean();

    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
    }

    const wishlistIds = Array.isArray(user.wishlist)
        ? user.wishlist.map((id) => id.toString())
        : [];

    const wishlistListingsRaw = wishlistIds.length
        ? await Listing.find({ _id: { $in: wishlistIds } })
            .select("title image price location country ratingAverage ratingCount")
            .lean()
        : [];

    const listingById = new Map(
        wishlistListingsRaw.map((listing) => [String(listing._id), listing])
    );

    const wishlistListings = wishlistIds
        .map((id) => listingById.get(id))
        .filter(Boolean);

    return res.render("profile/wishlist.ejs", {
        profileData: {
            user,
            wishlistListings,
        },
        activeRoute: "wishlist",
    });
};

module.exports.getReviewsOverview = async (req, res) => {
    const userObjectId = safeObjectId(req.user._id.toString());

    const [user, reviewsGiven, reviewsReceived, hostReviewData] = await Promise.all([
        getBaseUser(req.user._id),
        Review.find({ author: req.user._id })
            .sort({ createdAt: -1 })
            .lean(),
        getReviewsReceivedData(req.user._id),
        Listing.aggregate([
            { $match: { owner: userObjectId } },
            {
                $lookup: {
                    from: "reviews",
                    localField: "reviews",
                    foreignField: "_id",
                    as: "reviewsData",
                },
            },
            { $unwind: { path: "$reviewsData", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: "$reviewsData.rating" },
                    reviewsReceivedCount: {
                        $sum: {
                            $cond: [{ $ifNull: ["$reviewsData._id", false] }, 1, 0],
                        },
                    },
                },
            },
        ]),
    ]);

    const stats = hostReviewData[0] || { averageRating: 0, reviewsReceivedCount: 0 };

    return res.render("profile/reviews.ejs", {
        profileData: {
            user,
            reviewsGiven,
            reviewsReceived,
            stats: {
                reviewsReceivedCount: stats.reviewsReceivedCount,
                averageRating: Number((stats.averageRating || 0).toFixed(2)),
            },
        },
        activeRoute: "reviews",
    });
};

module.exports.getHostPayoutDashboard = async (req, res) => {
    const hostObjectId = safeObjectId(req.user._id.toString());

    const [earnings, monthlyEarnings, payoutHistory] = await Promise.all([
        Payout.aggregate([
            { $match: { host: hostObjectId, status: "paid" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Payout.aggregate([
            { $match: { host: hostObjectId, status: "paid" } },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                    },
                    total: { $sum: "$amount" },
                },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        Payout.find({ host: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20),
    ]);

    res.json({
        totalEarnings: earnings[0] ? earnings[0].total : 0,
        monthlyEarnings,
        payoutHistory,
    });
};

module.exports.getHostBookingsDashboard = async (req, res) => {
    const query = new URLSearchParams(req.query || {}).toString();
    const target = query ? `/bookings/host?${query}` : "/bookings/host";
    return res.redirect(target);
};
