const mongoose = require("mongoose");
const Listing = require("../models/listing");
const config = require("../config");
const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");
const { geocodeListingLocation } = require("./mapService");
const { cloudinary } = require("../cloudConfig");

const FALLBACK_ZOOM = 10;
const DEFAULT_MAX_PRICE = 20000;
const FILTER_CATEGORIES = ["villa", "apartment", "farmhouse", "room"];
const ALLOWED_INDEX_FILTER_KEYS = ["minPrice", "maxPrice", "category", "search", "minRating"];
const MONGO_OPERATOR_PATTERN = /\$(?:gt|lt|regex|where|ne)\b/gi;
const MAX_LISTING_IMAGES = 5;
const DEFAULT_LISTING_IMAGE = {
    url: "https://images.unsplash.com/photo-1468824357306-a439d58ccb1c",
    filename: "default-listing-image",
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeImageShape = (image) => {
    if (!image || !image.url) return null;
    return {
        url: String(image.url),
        filename: String(image.filename || ""),
    };
};

const collectListingImages = (listing) => {
    const imagesFromArray = Array.isArray(listing?.images)
        ? listing.images.map(normalizeImageShape).filter(Boolean)
        : [];

    if (imagesFromArray.length) {
        return imagesFromArray;
    }

    const legacyImage = normalizeImageShape(listing?.image);
    if (legacyImage) {
        return [legacyImage];
    }

    return [{ ...DEFAULT_LISTING_IMAGE }];
};

const withPrimaryImage = (listing) => {
    const normalizedImages = collectListingImages(listing);
    return {
        ...listing,
        images: normalizedImages,
        image: normalizedImages[0],
    };
};

const toUploadedImages = (files = []) => {
    if (!Array.isArray(files) || !files.length) return [];
    return files
        .map((file) => ({ url: file.path, filename: file.filename }))
        .filter((image) => image.url && image.filename);
};

const ensureImageLimit = (count) => {
    if (count > MAX_LISTING_IMAGES) {
        throw new ValidationError(`A listing can have up to ${MAX_LISTING_IMAGES} images.`);
    }
};

const normalizeDeleteFilenames = (deleteImages) => {
    if (!deleteImages) return [];
    if (Array.isArray(deleteImages)) return deleteImages.map((name) => String(name));
    return [String(deleteImages)];
};

const destroyCloudinaryAssets = async (filenames = []) => {
    const safeFilenames = filenames
        .map((name) => String(name || ""))
        .filter((name) => name && name !== DEFAULT_LISTING_IMAGE.filename);

    if (!safeFilenames.length) return;

    await Promise.all(
        safeFilenames.map((filename) =>
            cloudinary.uploader.destroy(filename).catch(() => null)
        )
    );
};

const toFiniteNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const pickScalarQueryValue = (value) => {
    if (Array.isArray(value)) {
        return pickScalarQueryValue(value[0]);
    }

    if (["string", "number", "boolean"].includes(typeof value)) {
        return value;
    }

    return "";
};

const stripMongoOperators = (value) => {
    return String(value || "")
        .replace(MONGO_OPERATOR_PATTERN, "")
        .replace(/\$/g, "")
        .trim();
};

const sanitizeIndexFilters = (rawFilters = {}) => {
    const sanitized = {};

    for (const key of ALLOWED_INDEX_FILTER_KEYS) {
        const scalarValue = pickScalarQueryValue(rawFilters[key]);

        if (key === "category" || key === "search") {
            sanitized[key] = stripMongoOperators(scalarValue);
        } else {
            sanitized[key] = scalarValue;
        }
    }

    return sanitized;
};

const normalizeFilters = (rawFilters = {}) => {
    const minPrice = Math.max(0, toFiniteNumber(rawFilters.minPrice, 0));
    const rawMax = toFiniteNumber(rawFilters.maxPrice, DEFAULT_MAX_PRICE);
    const maxPrice = Math.max(minPrice, rawMax);

    const category = FILTER_CATEGORIES.includes(rawFilters.category) ? rawFilters.category : "";
    const minRating = Math.max(0, Math.min(5, toFiniteNumber(rawFilters.minRating, 0)));
    const search = String(rawFilters.search || "").trim().slice(0, 80);

    return {
        minPrice,
        maxPrice,
        category,
        minRating,
        search,
    };
};

const buildListingMatch = (filters) => {
    const match = {
        status: "active",
        price: {
            $gte: filters.minPrice,
            $lte: filters.maxPrice,
        },
    };

    if (filters.minRating > 0) {
        match.ratingAverage = { $gte: filters.minRating };
    }

    if (filters.category) {
        const categoryRegex = new RegExp(`\\b${escapeRegex(filters.category)}\\b`, "i");
        match.$or = [
            { category: filters.category },
            { title: categoryRegex },
        ];
    }

    if (filters.search) {
        const searchRegex = new RegExp(escapeRegex(filters.search), "i");
        const searchClause = {
            $or: [
                { title: searchRegex },
                { location: searchRegex },
            ],
        };

        if (match.$and) {
            match.$and.push(searchClause);
        } else if (match.$or) {
            match.$and = [searchClause];
        } else {
            Object.assign(match, searchClause);
        }
    }

    return match;
};

const parseCoordinates = (coordinates = []) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;

    const lng = Number.parseFloat(coordinates[0]);
    const lat = Number.parseFloat(coordinates[1]);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
};

const buildMapListing = (listing) => {
    const normalized = withPrimaryImage(listing);
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
        imageUrl: normalized.image?.url,
        coordinates,
    };
};

const ensureValidObjectId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError("Invalid listing id.");
    }
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

const getIndexData = async (rawFilters = {}) => {
    const sanitizedFilters = sanitizeIndexFilters(rawFilters);
    const filters = normalizeFilters(sanitizedFilters);
    const match = buildListingMatch(filters);

    const allListings = await Listing.find(match)
        .select("title description image images price category location country geometry owner ratingAverage ratingCount")
        .sort({ _id: -1 })
        .lean();

    const enrichedListings = allListings.map((listing) => {
        const normalized = withPrimaryImage(listing);

        return {
            ...normalized,
            avgRating: Number(listing.ratingAverage || 0),
            reviewsCount: Number(listing.ratingCount || 0),
        };
    });

    const mapListings = enrichedListings.map(buildMapListing).filter(Boolean);

    return {
        allListings: enrichedListings,
        mapListings,
        mapToken: config.integrations.mapboxToken,
        filters,
        filterMeta: {
            categories: FILTER_CATEGORIES,
            maxPriceLimit: DEFAULT_MAX_PRICE,
        },
    };
};

const getNewFormData = () => ({
    mapToken: config.integrations.mapboxToken,
    fallbackZoom: FALLBACK_ZOOM,
});

const getListingDetail = async (listingId) => {
    ensureValidObjectId(listingId);

    const listing = await Listing.findById(listingId)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");

    if (!listing) {
        throw new NotFoundError("Listing does not exist.");
    }

    const listingImages = collectListingImages(listing);
    listing.images = listingImages;
    listing.image = listingImages[0];

    let nearbyListings = [];
    if (listing.geometry?.coordinates?.length === 2) {
        nearbyListings = await findNearbyListings(listing._id, listing.geometry, 5000);
        nearbyListings = nearbyListings.map((nearby) => {
            const nearbyImages = collectListingImages(nearby);
            nearby.images = nearbyImages;
            nearby.image = nearbyImages[0];
            return nearby;
        });
    }

    return {
        listing,
        nearbyListings,
        mapToken: config.integrations.mapboxToken,
    };
};

const createListing = async ({ listingData, files, ownerId }) => {
    const newListing = new Listing(listingData);

    const requestedCoordinates = parseCoordinates(listingData?.geometry?.coordinates);
    if (requestedCoordinates) {
        newListing.geometry = {
            type: "Point",
            coordinates: requestedCoordinates,
        };
    } else {
        const geocodedLocation = await geocodeListingLocation({
            location: listingData?.location,
            country: listingData?.country,
        });

        if (geocodedLocation?.geometry) {
            newListing.geometry = geocodedLocation.geometry;
        }
    }

    const uploadedImages = toUploadedImages(files);

    try {
        ensureImageLimit(uploadedImages.length);

        newListing.images = uploadedImages.length ? uploadedImages : [{ ...DEFAULT_LISTING_IMAGE }];
        newListing.image = newListing.images[0];

        newListing.owner = ownerId;
        await newListing.save();
    } catch (error) {
        await destroyCloudinaryAssets(uploadedImages.map((image) => image.filename));
        throw error;
    }

    return {
        listing: newListing,
        hasMapCoordinates: Array.isArray(newListing.geometry?.coordinates) && newListing.geometry.coordinates.length === 2,
    };
};

const getNearbyListingsPayload = async (listingId) => {
    ensureValidObjectId(listingId);

    const listing = await Listing.findById(listingId).select("geometry");
    if (!listing || !listing.geometry?.coordinates?.length) {
        throw new NotFoundError("Listing coordinates not found.");
    }

    const nearbyListings = await findNearbyListings(listingId, listing.geometry, 5000);
    const listings = nearbyListings.map((nearbyListing) => {
        const normalized = withPrimaryImage(nearbyListing.toObject ? nearbyListing.toObject() : nearbyListing);

        return {
            id: nearbyListing._id,
            title: nearbyListing.title,
            location: nearbyListing.location,
            country: nearbyListing.country,
            price: nearbyListing.price,
            coordinates: nearbyListing.geometry?.coordinates,
            imageUrl: normalized.image?.url,
        };
    });

    return {
        sourceListingId: listingId,
        maxDistanceMeters: 5000,
        sortedByDistance: true,
        listings,
    };
};

const getListingForEdit = async (listingId) => {
    ensureValidObjectId(listingId);

    const listing = await Listing.findById(listingId);
    if (!listing) {
        throw new NotFoundError("Listing does not exist.");
    }

    const normalizedImages = collectListingImages(listing);
    listing.images = normalizedImages;
    listing.image = normalizedImages[0];

    return listing;
};

const updateListing = async ({ listingId, listingData, files, deleteImages }) => {
    ensureValidObjectId(listingId);

    const listing = await Listing.findById(listingId);
    if (!listing) {
        throw new NotFoundError("Listing does not exist.");
    }

    Object.assign(listing, listingData);

    const currentImages = collectListingImages(listing);
    const deleteFilenames = new Set(normalizeDeleteFilenames(deleteImages));
    let retainedImages = currentImages.filter((image) => !deleteFilenames.has(image.filename));
    const newImages = toUploadedImages(files);

    if (newImages.length) {
        retainedImages = retainedImages.filter((image) => image.filename !== DEFAULT_LISTING_IMAGE.filename);
    }

    const nextImages = [...retainedImages, ...newImages];

    try {
        ensureImageLimit(nextImages.length);

        const finalImages = nextImages.length ? nextImages : [{ ...DEFAULT_LISTING_IMAGE }];
        listing.images = finalImages;
        listing.image = finalImages[0];

        await listing.save();

        const removedImages = currentImages
            .filter((image) => deleteFilenames.has(image.filename))
            .map((image) => image.filename);
        await destroyCloudinaryAssets(removedImages);
    } catch (error) {
        await destroyCloudinaryAssets(newImages.map((image) => image.filename));
        throw error;
    }

    return listing;
};

const deleteListing = async (listingId) => {
    ensureValidObjectId(listingId);

    const existingListing = await Listing.findById(listingId).select("images image");
    if (!existingListing) {
        throw new NotFoundError("Listing does not exist.");
    }

    const imageFilenames = collectListingImages(existingListing).map((image) => image.filename);

    await destroyCloudinaryAssets(imageFilenames);

    const deletedListing = await Listing.findByIdAndDelete(listingId);
    if (!deletedListing) {
        throw new NotFoundError("Listing does not exist.");
    }

    return deletedListing;
};

const toggleListingStatus = async (listingId) => {
    ensureValidObjectId(listingId);

    const listing = await Listing.findById(listingId).select("status");
    if (!listing) {
        throw new NotFoundError("Listing does not exist.");
    }

    const nextStatus = listing.status === "inactive" ? "active" : "inactive";
    listing.status = nextStatus;
    await listing.save();

    return listing;
};

module.exports = {
    getIndexData,
    sanitizeIndexFilters,
    getNewFormData,
    getListingDetail,
    createListing,
    getNearbyListingsPayload,
    getListingForEdit,
    updateListing,
    toggleListingStatus,
    deleteListing,
};
