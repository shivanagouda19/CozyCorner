(() => {
  const initShowMap = async () => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    const mapCore = window.WanderlustMapCore;
    if (!mapCore) return;

    const mapConfig = mapCore.parseJsonDataAttribute(mapContainer.dataset.mapData, null);
    if (!mapConfig) return;

    const { mapToken, coordinates, title, location, country, price, imageUrl } = mapConfig;
    if (!mapToken || !mapCore.isValidCoordinates(coordinates)) return;

    try {
      await mapCore.loadMapbox(mapToken);
    } catch (error) {
      console.error("Show map lazy load failed:", error);
      mapContainer.innerHTML = "<p class=\"map-status-text\">Map is temporarily unavailable.</p>";
      return;
    }

    try {
      const map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/streets-v12",
        center: coordinates,
        zoom: 13,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(
        mapCore.buildListingPopup({
          id: mapContainer.dataset.listingId || "",
          title,
          location,
          country,
          price,
          imageUrl,
        })
      );

      const markerEl = mapCore.createPriceMarkerElement(price);
      markerEl.classList.add("map-price-marker--pulse");

      const marker = new mapboxgl.Marker({ element: markerEl })
        .setLngLat(coordinates)
        .setPopup(popup)
        .addTo(map);

      marker.getElement().addEventListener("mouseenter", () => popup.addTo(map));

      map.flyTo({ center: coordinates, zoom: 13, speed: 0.8, curve: 1.1, essential: true });

      const nearbyCards = Array.from(document.querySelectorAll(".nearby-map-trigger[data-nearby-map]"));
      nearbyCards.forEach((card) => {
        const nearbyData = mapCore.parseJsonDataAttribute(card.dataset.nearbyMap, null);
        if (!nearbyData || !mapCore.isValidCoordinates(nearbyData.coordinates)) return;

        card.addEventListener("mouseenter", () => {
          map.flyTo({
            center: nearbyData.coordinates,
            zoom: Math.max(map.getZoom(), 12),
            speed: 0.75,
            curve: 1.15,
            essential: true,
          });

          popup
            .setLngLat(nearbyData.coordinates)
            .setHTML(mapCore.buildListingPopup(nearbyData))
            .addTo(map);
        });

        card.addEventListener("mouseleave", () => {
          map.flyTo({
            center: coordinates,
            zoom: 13,
            speed: 0.65,
            curve: 1.1,
            essential: true,
          });

          popup
            .setLngLat(coordinates)
            .setHTML(
              mapCore.buildListingPopup({
                id: mapContainer.dataset.listingId || "",
                title,
                location,
                country,
                price,
                imageUrl,
              })
            )
            .addTo(map);
        });
      });
    } catch (error) {
      console.error("Show map initialization failed:", error);
      mapContainer.innerHTML = "<p class=\"map-status-text\">Map is temporarily unavailable.</p>";
    }
  };

  document.addEventListener("DOMContentLoaded", initShowMap);
})();
