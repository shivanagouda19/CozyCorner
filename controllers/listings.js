const Listing = require("../models/listing");
const mongoose = require("mongoose");
const ExpressError = require("../utils/ExpressError");
const { getGeocodingClient } = require("../utils/mapbox");

const FALLBACK_ZOOM = 10;

const parseCoordinates = (coordinates = []) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;

    const lng = Number.parseFloat(coordinates[0]);
    const lat = Number.parseFloat(coordinates[1]);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
};

const buildMapListing = (listing) => {
    const coordinates = listing?.geometry?.coordinates;
    const hasCoordinates =
        Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        coordinates.every((value) => typeof value === "number" && Number.isFinite(value));

    if (!hasCoordinates) return null;

    return {
        id: listing._id,
        title: listing.title,
        location: listing.location,
        country: listing.country,
        price: listing.price,
        imageUrl: listing.image?.url,
        coordinates,
    };
};

const findNearbyListings = async (listingId, geometry, maxDistance = 5000) => {
    return Listing.find({
        _id: { $ne: listingId },
        geometry: {
            $near: {
                $geometry: geometry,
                $maxDistance: maxDistance,
            },
        },
    }).limit(8);
};

const redirectListingNotFound = (req, res) => {
    req.flash("error", "Listing does not exist.");
    return res.redirect("/listings");
};

module.exports.index = async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs", {
        mapToken: process.env.MAPBOX_TOKEN,
        fallbackZoom: FALLBACK_ZOOM,
    });
};

module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const listing = await Listing.findById(id)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");

    if (!listing) {
        return redirectListingNotFound(req, res);
    }

    let nearbyListings = [];
    if (listing.geometry?.coordinates?.length === 2) {
        try {
            nearbyListings = await findNearbyListings(listing._id, listing.geometry, 5000);
        } catch (error) {
            console.error("Nearby listings query failed:", error);
        }
    }

    res.render("listings/show.ejs", {
        listing,
        nearbyListings,
        mapToken: process.env.MAPBOX_TOKEN,
    });
};

module.exports.createListing = async (req, res) => {
    const newListing = new Listing(req.body.listing);

    const requestedCoordinates = parseCoordinates(req.body.listing?.geometry?.coordinates);
    if (requestedCoordinates) {
        newListing.geometry = {
            type: "Point",
            coordinates: requestedCoordinates,
        };
    } else {
        try {
            const geocodingClient = getGeocodingClient();
            const geocodeQuery = `${req.body.listing.location}, ${req.body.listing.country}`;
            const geocodeResponse = await geocodingClient
                .forwardGeocode({
                    query: geocodeQuery,
                    limit: 1,
                })
                .send();

            const geometry = geocodeResponse.body.features?.[0]?.geometry;
            if (!geometry) {
                throw new ExpressError(400, "Please provide a valid location.");
            }

            newListing.geometry = geometry;
        } catch (error) {
            console.error("Create listing geocoding failed:", error);
            if (error instanceof ExpressError) throw error;
            throw new ExpressError(400, "Unable to verify the location right now. Please try again.");
        }
    }

    if (req.file) {
        newListing.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
    } else if (!newListing.image || !newListing.image.url) {
        newListing.image = {
            url: "https://images.unsplash.com/photo-1468824357306-a439d58ccb1c",
            filename: "default-listing-image",
        };
    }
    newListing.owner = req.user._id;
    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

module.exports.getNearbyListings = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ExpressError(400, "Invalid listing id.");
    }

    const listing = await Listing.findById(id).select("geometry");
    if (!listing || !listing.geometry?.coordinates?.length) {
        throw new ExpressError(404, "Listing coordinates not found.");
    }

    const nearbyListings = await findNearbyListings(id, listing.geometry, 5000);
    const nearbyPayload = nearbyListings.map((nearbyListing) => ({
        id: nearbyListing._id,
        title: nearbyListing.title,
        location: nearbyListing.location,
        country: nearbyListing.country,
        price: nearbyListing.price,
        coordinates: nearbyListing.geometry?.coordinates,
        imageUrl: nearbyListing.image?.url,
    }));

    res.json({
        sourceListingId: id,
        maxDistanceMeters: 5000,
        sortedByDistance: true,
        listings: nearbyPayload,
    });
};

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const listing = await Listing.findById(id);
    if (!listing) {
        return redirectListingNotFound(req, res);
    }

    res.render("listings/edit.ejs", { listing });
};

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const updatedListing = await Listing.findByIdAndUpdate(id, { ...req.body.listing }, { new: true });
    if (!updatedListing) {
        return redirectListingNotFound(req, res);
    }

    if (req.file) {
        updatedListing.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
        await updatedListing.save();
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const deletedListing = await Listing.findByIdAndDelete(id);
    if (!deletedListing) {
        return redirectListingNotFound(req, res);
    }

    req.flash("success", "Listing deleted successfully!");
    res.redirect("/listings");
};