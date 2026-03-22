const availabilityService = require("../services/availability.service");

module.exports.getListingAvailability = async (req, res) => {
    const { id: listingId } = req.params;
    const payload = await availabilityService.getListingAvailability(listingId);
    return res.json(payload);
};

module.exports.blockListingDates = async (req, res) => {
    const { id: listingId } = req.params;
    const startDate = req.body?.block?.startDate || req.body?.startDate;
    const endDate = req.body?.block?.endDate || req.body?.endDate;

    const payload = await availabilityService.blockListingDates(
        req.user._id,
        listingId,
        startDate,
        endDate
    );

    req.flash("success", "Listing dates blocked successfully.");

    if ((req.get("accept") || "").includes("application/json")) {
        return res.json(payload);
    }

    return res.redirect(`/listings/${listingId}/calendar`);
};

module.exports.renderHostCalendar = async (req, res) => {
    const { id: listingId } = req.params;
    const availability = await availabilityService.getListingAvailability(listingId);

    return res.render("listings/calendar.ejs", {
        listingId,
        availability,
    });
};
