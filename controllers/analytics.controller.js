const analyticsService = require("../services/analytics.service");

module.exports.getHostAnalyticsDashboard = async (req, res) => {
    const analytics = await analyticsService.getHostAnalytics(req.user._id);

    return res.render("profile/analytics.ejs", {
        profileData: {
            analytics,
        },
        activeRoute: "analytics",
    });
};
