const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const geocodeCache = new Map();

const getGeocodingClient = () => {
    const mapToken = process.env.MAPBOX_TOKEN;

    if (!mapToken) {
        throw new Error("MAPBOX_TOKEN is missing. Add it to your environment variables.");
    }

    return mbxGeocoding({ accessToken: mapToken });
};

const buildLocationCacheKey = ({ location = "", country = "" } = {}) => {
    return `${String(location).trim().toLowerCase()}::${String(country).trim().toLowerCase()}`;
};

const getCachedGeocode = (cacheKey) => {
    const cached = geocodeCache.get(cacheKey);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > GEO_CACHE_TTL_MS) {
        geocodeCache.delete(cacheKey);
        return null;
    }

    return cached.geometry;
};

const setCachedGeocode = (cacheKey, geometry) => {
    if (!cacheKey || !geometry) return;
    geocodeCache.set(cacheKey, {
        geometry,
        timestamp: Date.now(),
    });
};

const geocodeListingLocation = async ({ location = "", country = "" } = {}) => {
    const hasLocationParts = String(location).trim() && String(country).trim();
    if (!hasLocationParts) return null;

    if (!process.env.MAPBOX_TOKEN) {
        return null;
    }

    const cacheKey = buildLocationCacheKey({ location, country });
    const cachedGeometry = getCachedGeocode(cacheKey);
    if (cachedGeometry) {
        return { geometry: cachedGeometry, source: "cache" };
    }

    try {
        const geocodingClient = getGeocodingClient();
        const query = `${location}, ${country}`;
        const response = await geocodingClient
            .forwardGeocode({
                query,
                limit: 1,
            })
            .send();

        const geometry = response.body.features?.[0]?.geometry;
        if (!geometry) return null;

        setCachedGeocode(cacheKey, geometry);
        return { geometry, source: "api" };
    } catch (error) {
        console.error("Mapbox geocoding error:", error);
        return null;
    }
};

module.exports = { getGeocodingClient, geocodeListingLocation };
