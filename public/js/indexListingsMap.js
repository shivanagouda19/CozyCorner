(() => {
    const config = window.indexListingsMapData;
    const mapContainer = document.getElementById("listings-map");
    const statusEl = document.getElementById("index-map-status");

    if (!config || !mapContainer) return;

    const updateStatus = (message) => {
        if (statusEl) statusEl.textContent = message;
    };

    const mapListings = Array.isArray(config.listings) ? config.listings : [];
    const validListings = mapListings.filter(
        (listing) =>
            Array.isArray(listing.coordinates) &&
            listing.coordinates.length === 2 &&
            listing.coordinates.every((value) => typeof value === "number")
    );

    if (!config.mapToken || typeof mapboxgl === "undefined") {
        updateStatus("Map is unavailable at the moment.");
        console.error("Index map unavailable: missing token or mapboxgl.");
        return;
    }

    if (!validListings.length) {
        updateStatus("No coordinates found for listings yet.");
    }

    mapboxgl.accessToken = config.mapToken;

    let map;
    const markersByListingId = new Map();

    const buildPopupHtml = (listing) => {
        return `
            <div class="map-popup">
                <h6>${listing.title || "Listing"}</h6>
                <p>${listing.location || ""}${listing.country ? `, ${listing.country}` : ""}</p>
                <strong>INR ${typeof listing.price === "number" ? listing.price.toLocaleString("en-IN") : "Price not set"} / night</strong>
                <div class="mt-2"><a href="/listings/${listing.id}">View listing</a></div>
            </div>
        `;
    };

    try {
        map = new mapboxgl.Map({
            container: "listings-map",
            style: "mapbox://styles/mapbox/streets-v12",
            center: validListings[0]?.coordinates || [78.9629, 20.5937],
            zoom: validListings.length ? 6 : 3,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
    } catch (error) {
        updateStatus("Map could not be loaded.");
        console.error("Index map initialization failed:", error);
        return;
    }

    const bounds = new mapboxgl.LngLatBounds();

    validListings.forEach((listing) => {
        const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(buildPopupHtml(listing));
        const marker = new mapboxgl.Marker({ color: "#fe424d" })
            .setLngLat(listing.coordinates)
            .setPopup(popup)
            .addTo(map);

        const markerEl = marker.getElement();
        markerEl.dataset.listingId = String(listing.id);

        markerEl.addEventListener("click", () => {
            window.location.href = `/listings/${listing.id}`;
        });

        markersByListingId.set(String(listing.id), { marker, popup, markerEl });
        bounds.extend(listing.coordinates);
    });

    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    }

    const listingCards = document.querySelectorAll(".index-listing-card[data-listing-id]");

    listingCards.forEach((card) => {
        const listingId = card.getAttribute("data-listing-id");
        const markerData = markersByListingId.get(String(listingId));
        if (!markerData) return;

        card.addEventListener("mouseenter", () => {
            card.classList.add("is-active");
            markerData.markerEl.classList.add("marker-highlight");
            markerData.popup.addTo(map);
        });

        card.addEventListener("mouseleave", () => {
            card.classList.remove("is-active");
            markerData.markerEl.classList.remove("marker-highlight");
        });
    });
})();