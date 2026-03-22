const listingService = require("../services/listingService");
const User = require("../models/user");

const buildWishlistSet = (user) => {
    if (!user || !Array.isArray(user.wishlist)) {
        return new Set();
    }

    return new Set(user.wishlist.map((id) => String(id)));
};

const getSafeBackUrl = (req, fallbackUrl) => {
    const referer = req.get("referer");
    if (!referer) return fallbackUrl;

    try {
        const parsed = new URL(referer);
        const host = req.get("host");
        if (parsed.host !== host) {
            return fallbackUrl;
        }
        return `${parsed.pathname || ""}${parsed.search || ""}` || fallbackUrl;
    } catch (error) {
        return fallbackUrl;
    }
};

const redirectListingError = (req, res, message = "Listing does not exist.") => {
    req.flash("error", message);
    return res.redirect("/listings");
};

module.exports.index = async (req, res) => {
    const sanitizedFilters = listingService.sanitizeIndexFilters(req.query || {});
    const { allListings, mapListings, mapToken, filters, filterMeta } = await listingService.getIndexData(sanitizedFilters);
    const wishlistSet = buildWishlistSet(req.user);

    const listingsWithWishlistState = allListings.map((listing) => ({
        ...listing,
        isWishlisted: wishlistSet.has(String(listing._id)),
    }));

    res.render("listings/index.ejs", {
        allListings: listingsWithWishlistState,
        mapToken,
        mapListings,
        filters,
        filterMeta,
    });
};

module.exports.renderNewForm = (req, res) => {
    const { mapToken, fallbackZoom } = listingService.getNewFormData();
    res.render("listings/new.ejs", {
        mapToken,
        fallbackZoom,
    });
};

module.exports.showListing = async (req, res) => {
    const { id } = req.params;

    try {
        const { listing, nearbyListings, mapToken } = await listingService.getListingDetail(id);

        return res.render("listings/show.ejs", {
            listing,
            nearbyListings,
            mapToken,
            isWishlisted: buildWishlistSet(req.user).has(String(listing._id)),
        });
    } catch (error) {
        return redirectListingError(req, res, error.message);
    }
};

module.exports.createListing = async (req, res) => {
    const { hasMapCoordinates } = await listingService.createListing({
        listingData: req.body.listing,
        files: req.files,
        ownerId: req.user._id,
    });

    if (!hasMapCoordinates) {
        req.flash("err", "We could not verify this address on the map right now. Listing was saved without map coordinates.");
    }

    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

module.exports.getNearbyListings = async (req, res) => {
    const { id } = req.params;
    const payload = await listingService.getNearbyListingsPayload(id);
    res.json(payload);
};

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;

    try {
        const listing = await listingService.getListingForEdit(id);
        return res.render("listings/edit.ejs", { listing });
    } catch (error) {
        return redirectListingError(req, res, error.message);
    }
};

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;

    try {
        await listingService.updateListing({
            listingId: id,
            listingData: req.body.listing,
            files: req.files,
            deleteImages: req.body.deleteImages,
        });
    } catch (error) {
        return redirectListingError(req, res, error.message);
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;

    try {
        await listingService.deleteListing(id);
    } catch (error) {
        return redirectListingError(req, res, error.message);
    }

    req.flash("success", "Listing deleted successfully!");
    res.redirect("/listings");
};

module.exports.toggleListingStatus = async (req, res) => {
    const { id } = req.params;

    try {
        const listing = await listingService.toggleListingStatus(id);
        const statusLabel = listing.status === "active" ? "active" : "inactive";
        req.flash("success", `Listing marked as ${statusLabel}.`);
    } catch (error) {
        return redirectListingError(req, res, error.message);
    }

    return res.redirect(getSafeBackUrl(req, "/profile/listings"));
};

module.exports.toggleWishlist = async (req, res) => {
    const { id } = req.params;

    const listing = await listingService.getListingForEdit(id);
    if (!listing) {
        return redirectListingError(req, res);
    }

    // OWNER GUARD
    if (String(listing.owner) === String(req.user._id)) {
        req.flash("error", "You cannot save your own listing.");
        return res.redirect(getSafeBackUrl(req, `/listings/${id}`));
    }

    const user = await User.findById(req.user._id).select("wishlist");
    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
    }

    const alreadySaved = user.wishlist.includes(listing._id);

    if (alreadySaved) {
        await User.updateOne(
            { _id: req.user._id },
            { $pull: { wishlist: listing._id } }
        );
        req.flash("success", "Removed from wishlist.");
    } else {
        await User.updateOne(
            { _id: req.user._id },
            { $addToSet: { wishlist: listing._id } }
        );
        req.flash("success", "Saved to wishlist.");
    }

    const fallbackUrl = `/listings/${id}`;
    return res.redirect(getSafeBackUrl(req, fallbackUrl));
};