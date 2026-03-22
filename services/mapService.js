const config = require("../config");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const ExternalServiceError = require("../errors/ExternalServiceError");

const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const geocodeCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = (promise, timeoutMs = 3000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new ExternalServiceError("Map service timed out.")), timeoutMs);
        }),
    ]);
};

const getGeocodingClient = () => {
    const token = config.integrations.mapboxToken;
    if (!token) {
        throw new ExternalServiceError("Mapbox token is missing.");
    }

    return mbxGeocoding({ accessToken: token });
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
    if (!hasLocationParts || !config.integrations.mapboxToken) return null;

    const cacheKey = buildLocationCacheKey({ location, country });
    const cachedGeometry = getCachedGeocode(cacheKey);
    if (cachedGeometry) return { geometry: cachedGeometry, source: "cache" };

    const geocodingClient = getGeocodingClient();
    const query = `${location}, ${country}`;

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await withTimeout(
                geocodingClient.forwardGeocode({ query, limit: 1 }).send(),
                3500
            );

            const geometry = response.body.features?.[0]?.geometry;
            if (!geometry) return null;

            setCachedGeocode(cacheKey, geometry);
            return { geometry, source: attempt === 1 ? "api" : "api-retry" };
        } catch (error) {
            if (attempt === maxAttempts) {
                return null;
            }
            await sleep(200 * attempt);
        }
    }

    return null;
};

module.exports = {
    geocodeListingLocation,
    getGeocodingClient,
};
