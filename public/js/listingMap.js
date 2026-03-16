(() => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    let mapConfig = window.listingMapData;
    if (!mapConfig && mapContainer.dataset.mapData) {
        try {
            mapConfig = JSON.parse(mapContainer.dataset.mapData);
        } catch (error) {
            console.error("Failed to parse show map data:", error);
        }
    }

    if (!mapConfig) return;

    const { mapToken, coordinates, title, location, country, price } = mapConfig;
    const hasValidCoordinates =
        Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        coordinates.every((value) => typeof value === "number");

    if (!mapToken || !hasValidCoordinates || typeof mapboxgl === "undefined") {
        console.error("Show map initialization blocked due to missing token, coordinates, or mapboxgl.");
        return;
    }

    mapboxgl.accessToken = mapToken;

    try {
        const map = new mapboxgl.Map({
            container: "map",
            style: "mapbox://styles/mapbox/streets-v12",
            center: coordinates,
            zoom: 13,
        });

        const popupHtml = `
            <div class="map-popup">
                <h6>${title || "Listing"}</h6>
                <p>${location || ""}${country ? `, ${country}` : ""}</p>
                <strong>INR ${typeof price === "number" ? price.toLocaleString("en-IN") : "Price not set"} / night</strong>
            </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml);

        const marker = new mapboxgl.Marker({ color: "#fe424d" })
            .setLngLat(coordinates)
            .setPopup(popup)
            .addTo(map);

        marker.getElement().addEventListener("click", () => {
            popup.addTo(map);
        });
    } catch (error) {
        console.error("Show map failed:", error);
        mapContainer.innerHTML = "<p class=\"map-status-text\">Map is temporarily unavailable.</p>";
    }
})();
