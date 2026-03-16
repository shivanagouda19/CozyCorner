(() => {
    const config = window.createListingMapData;
    const mapContainer = document.getElementById("create-listing-map");
    const statusEl = document.getElementById("create-map-status");
    const locationInput = document.getElementById("listing-location");
    const countryInput = document.getElementById("listing-country");
    const lngInput = document.getElementById("listing-lng");
    const latInput = document.getElementById("listing-lat");

    if (!config || !mapContainer || !locationInput || !countryInput || !lngInput || !latInput) return;

    const updateStatus = (message) => {
        if (statusEl) statusEl.textContent = message;
    };

    if (!config.mapToken || typeof mapboxgl === "undefined") {
        updateStatus("Map preview unavailable: Mapbox is not configured.");
        console.error("Create map unavailable: missing map token or mapboxgl.");
        return;
    }

    mapboxgl.accessToken = config.mapToken;

    let map;
    let marker;
    let geocodeTimer;

    const getZoomByPlaceType = (placeType = []) => {
        const normalized = placeType.map((item) => String(item).toLowerCase());
        if (normalized.includes("country")) return 4;
        if (normalized.includes("address") || normalized.includes("poi") || normalized.includes("neighborhood")) return 13;
        if (normalized.includes("place") || normalized.includes("locality") || normalized.includes("district")) return 10;
        return typeof config.fallbackZoom === "number" ? config.fallbackZoom : 10;
    };

    const setHiddenCoordinates = (coordinates = []) => {
        lngInput.value = coordinates[0] ?? "";
        latInput.value = coordinates[1] ?? "";
    };

    const renderMarker = (coordinates) => {
        if (marker) marker.remove();
        marker = new mapboxgl.Marker({ color: "#fe424d" }).setLngLat(coordinates).addTo(map);
    };

    try {
        map = new mapboxgl.Map({
            container: "create-listing-map",
            style: "mapbox://styles/mapbox/streets-v12",
            center: [78.9629, 20.5937],
            zoom: 3,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
    } catch (error) {
        updateStatus("Map preview could not be loaded.");
        console.error("Create map initialization failed:", error);
        return;
    }

    const geocodeLocation = async () => {
        const location = locationInput.value.trim();
        const country = countryInput.value.trim();

        if (!location || !country) {
            setHiddenCoordinates();
            updateStatus("Enter both location and country to preview coordinates.");
            return;
        }

        updateStatus("Finding location on map...");
        const query = encodeURIComponent(`${location}, ${country}`);

        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${config.mapToken}&limit=1`,
                { method: "GET" }
            );

            if (!response.ok) {
                throw new Error(`Geocoding request failed with status ${response.status}`);
            }

            const data = await response.json();
            const feature = data.features?.[0];
            const coordinates = feature?.center;

            if (!Array.isArray(coordinates) || coordinates.length !== 2) {
                setHiddenCoordinates();
                updateStatus("Location not found. Please check spelling and try again.");
                return;
            }

            setHiddenCoordinates(coordinates);
            renderMarker(coordinates);
            map.flyTo({
                center: coordinates,
                zoom: getZoomByPlaceType(feature.place_type || []),
                essential: true,
            });
            updateStatus("Map updated. Coordinates saved for this listing.");
        } catch (error) {
            setHiddenCoordinates();
            updateStatus("Unable to fetch location now. You can still submit and server will retry geocoding.");
            console.error("Create listing geocoding failed:", error);
        }
    };

    const queueGeocode = () => {
        window.clearTimeout(geocodeTimer);
        geocodeTimer = window.setTimeout(geocodeLocation, 450);
    };

    locationInput.addEventListener("input", queueGeocode);
    countryInput.addEventListener("input", queueGeocode);
})();