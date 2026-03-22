(() => {
  const initIndexMap = async () => {
    const mapContainer = document.getElementById("listings-map");
    if (!mapContainer) return;
    if (mapContainer.dataset.mapInitialized === "true") return;
    mapContainer.dataset.mapInitialized = "true";

    const mapCore = window.WanderlustMapCore;
    if (!mapCore) return;

    const mapConfig = mapCore.parseJsonDataAttribute(mapContainer.dataset.mapConfig, {});
    const mapListings = mapCore.parseJsonDataAttribute(mapContainer.dataset.mapListings, []);
    const statusEl = document.getElementById("index-map-status");

    const updateStatus = (message) => {
      if (statusEl) statusEl.textContent = message;
    };

    const validListings = mapListings.filter((listing) => mapCore.isValidCoordinates(listing.coordinates));

    if (!mapConfig?.mapToken) {
      updateStatus("Map is unavailable right now.");
      return;
    }

    if (!validListings.length) {
      updateStatus("No listings with map coordinates yet.");
      return;
    }

    try {
      await mapCore.loadMapbox(mapConfig.mapToken);
    } catch (error) {
      updateStatus("Map failed to load. Please refresh.");
      console.error("Mapbox lazy load failed:", error);
      return;
    }

    const map = new mapboxgl.Map({
      container: "listings-map",
      style: "mapbox://styles/mapbox/light-v11",
      center: validListings[0].coordinates,
      zoom: 5,
      pitchWithRotate: false,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const listingsById = new Map(validListings.map((listing) => [String(listing.id), listing]));
    const listingCards = Array.from(document.querySelectorAll(".index-listing-card[data-listing-id]"));

    const featureCollection = {
      type: "FeatureCollection",
      features: validListings.map((listing, index) => ({
        type: "Feature",
        id: index,
        geometry: {
          type: "Point",
          coordinates: listing.coordinates,
        },
        properties: {
          listingId: String(listing.id),
          title: listing.title || "Listing",
          location: listing.location || "",
          country: listing.country || "",
          price: listing.price,
          imageUrl: listing.imageUrl || "",
          priceLabel: typeof listing.price === "number" ? `INR ${listing.price.toLocaleString("en-IN")}` : "Stay",
        },
      })),
    };

    const listingFeatureIdMap = new Map(
      featureCollection.features.map((feature) => [String(feature.properties.listingId), feature.id])
    );

    let hoveredFeatureId = null;
    let selectedListingId = null;
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 16 });

    const setHoveredFeature = (featureId) => {
      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: "listings", id: hoveredFeatureId }, { hover: false });
      }

      hoveredFeatureId = featureId;

      if (hoveredFeatureId !== null) {
        map.setFeatureState({ source: "listings", id: hoveredFeatureId }, { hover: true });
      }
    };

    const flyToListing = (listing) => {
      if (!listing || !mapCore.isValidCoordinates(listing.coordinates)) return;

      map.flyTo({
        center: listing.coordinates,
        zoom: Math.max(map.getZoom(), 11),
        speed: 0.7,
        curve: 1.2,
        essential: true,
      });
    };

    const openPopupForListing = (listing) => {
      if (!listing || !mapCore.isValidCoordinates(listing.coordinates)) return;

      popup
        .setLngLat(listing.coordinates)
        .setHTML(mapCore.buildListingPopup(listing))
        .addTo(map);
    };

    const syncVisibleCards = mapCore.debounce(() => {
      const renderedFeatures = map.queryRenderedFeatures({ layers: ["unclustered-circles"] });
      const visibleIds = new Set(renderedFeatures.map((feature) => feature.properties?.listingId));

      listingCards.forEach((card) => {
        const id = card.getAttribute("data-listing-id");
        card.classList.toggle("is-out-of-view", !visibleIds.has(id));
      });
    }, 140);

    map.on("load", () => {
      map.addSource("listings", {
        type: "geojson",
        data: featureCollection,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 48,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#ff5a73",
            20,
            "#ff385c",
            60,
            "#d71c48",
          ],
          "circle-radius": ["step", ["get", "point_count"], 20, 20, 28, 60, 34],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "unclustered-circles",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["case", ["boolean", ["feature-state", "hover"], false], "#e11d48", "#ff385c"],
          "circle-radius": ["case", ["boolean", ["feature-state", "hover"], false], 18, 15],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "unclustered-price-labels",
        type: "symbol",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "priceLabel"],
          "text-size": 10,
          "text-offset": [0, 2.2],
          "text-anchor": "top",
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "#ffffff",
          "text-halo-width": 0.8,
        },
      });

      const bounds = new mapboxgl.LngLatBounds();
      validListings.forEach((listing) => bounds.extend(listing.coordinates));
      map.fitBounds(bounds, { padding: { top: 60, right: 60, bottom: 60, left: 60 }, maxZoom: 12, duration: 700 });

      syncVisibleCards();
    });

    map.on("click", "clusters", (event) => {
      const clusterFeature = event.features?.[0];
      if (!clusterFeature) return;

      const clusterId = clusterFeature.properties.cluster_id;
      map.getSource("listings").getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error) return;
        map.easeTo({
          center: clusterFeature.geometry.coordinates,
          zoom,
          duration: 450,
        });
      });
    });

    map.on("mouseenter", "clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "clusters", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("mouseenter", "unclustered-circles", (event) => {
      map.getCanvas().style.cursor = "pointer";

      const feature = event.features?.[0];
      if (!feature) return;

      const listingId = feature.properties?.listingId;
      const listing = listingsById.get(String(listingId));

      setHoveredFeature(feature.id);
      openPopupForListing(listing);

      listingCards.forEach((card) => {
        card.classList.toggle("is-active", card.getAttribute("data-listing-id") === String(listingId));
      });
    });

    map.on("mouseleave", "unclustered-circles", () => {
      map.getCanvas().style.cursor = "";
      if (!selectedListingId) {
        popup.remove();
      }
      setHoveredFeature(null);
      listingCards.forEach((card) => card.classList.remove("is-active"));
    });

    map.on("click", "unclustered-circles", (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const listingId = String(feature.properties?.listingId);
      selectedListingId = listingId;

      const listing = listingsById.get(listingId);
      if (!listing) return;

      flyToListing(listing);
      openPopupForListing(listing);
    });

    map.on("move", syncVisibleCards);
    map.on("zoomend", syncVisibleCards);

    listingCards.forEach((card) => {
      const listingId = card.getAttribute("data-listing-id");
      const listing = listingsById.get(String(listingId));
      if (!listing) return;

      card.addEventListener("mouseenter", () => {
        card.classList.add("is-active");
        selectedListingId = String(listingId);

        const featureId = listingFeatureIdMap.get(String(listingId));
        if (featureId !== undefined && featureId !== null) setHoveredFeature(featureId);

        flyToListing(listing);
        openPopupForListing(listing);
      });

      card.addEventListener("mouseleave", () => {
        card.classList.remove("is-active");
        selectedListingId = null;
        popup.remove();
        setHoveredFeature(null);
      });
    });
  };

  document.addEventListener("DOMContentLoaded", initIndexMap);
})();
