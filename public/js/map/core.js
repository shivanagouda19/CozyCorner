(() => {
  const MAPBOX_SCRIPT_ID = "mapbox-gl-script";
  const MAPBOX_STYLE_ID = "mapbox-gl-style";

  const loadMapbox = (accessToken) => {
    if (!accessToken) {
      return Promise.reject(new Error("Missing Mapbox access token."));
    }

    if (window.mapboxgl) {
      window.mapboxgl.accessToken = accessToken;
      return Promise.resolve(window.mapboxgl);
    }

    const pending = window.__wanderlustMapboxLoader;
    if (pending) {
      return pending.then((mapboxgl) => {
        mapboxgl.accessToken = accessToken;
        return mapboxgl;
      });
    }

    window.__wanderlustMapboxLoader = new Promise((resolve, reject) => {
      if (!document.getElementById(MAPBOX_STYLE_ID)) {
        const styleLink = document.createElement("link");
        styleLink.id = MAPBOX_STYLE_ID;
        styleLink.rel = "stylesheet";
        styleLink.href = "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css";
        document.head.appendChild(styleLink);
      }

      const script = document.createElement("script");
      script.id = MAPBOX_SCRIPT_ID;
      script.src = "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js";
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (!window.mapboxgl) {
          reject(new Error("Mapbox GL script loaded but mapboxgl is unavailable."));
          return;
        }

        window.mapboxgl.accessToken = accessToken;
        resolve(window.mapboxgl);
      };

      script.onerror = () => reject(new Error("Failed to load Mapbox GL script."));

      const existingScript = document.getElementById(MAPBOX_SCRIPT_ID);
      if (!existingScript) {
        document.head.appendChild(script);
      }
    });

    return window.__wanderlustMapboxLoader;
  };

  const parseJsonDataAttribute = (rawValue, fallback = null) => {
    if (!rawValue) return fallback;

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      console.error("Failed to parse map JSON data attribute:", error);
      return fallback;
    }
  };

  const formatPrice = (price) => {
    if (typeof price !== "number" || Number.isNaN(price)) {
      return "Price not set";
    }

    return `INR ${price.toLocaleString("en-IN")}`;
  };

  const debounce = (fn, wait = 120) => {
    let timer;

    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  };

  const isValidCoordinates = (coordinates) => {
    return (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      coordinates.every((value) => typeof value === "number" && Number.isFinite(value))
    );
  };

  const createPriceMarkerElement = (price) => {
    const markerEl = document.createElement("button");
    markerEl.type = "button";
    markerEl.className = "map-price-marker";
    markerEl.textContent = typeof price === "number" ? `INR ${price.toLocaleString("en-IN")}` : "Stay";
    return markerEl;
  };

  const buildListingPopup = (listing) => {
    const imageUrl = listing.imageUrl || "https://images.unsplash.com/photo-1468824357306-a439d58ccb1c";

    return `
      <article class="map-popup-card">
        <a class="map-popup-media" href="/listings/${listing.id}">
          <img src="${imageUrl}" alt="${listing.title || "Listing"}">
        </a>
        <div class="map-popup-body">
          <h6>${listing.title || "Listing"}</h6>
          <p>${listing.location || ""}${listing.country ? `, ${listing.country}` : ""}</p>
          <div class="map-popup-row">
            <strong>${formatPrice(listing.price)} / night</strong>
            <a href="/listings/${listing.id}">View</a>
          </div>
        </div>
      </article>
    `;
  };

  window.WanderlustMapCore = {
    buildListingPopup,
    createPriceMarkerElement,
    debounce,
    formatPrice,
    isValidCoordinates,
    loadMapbox,
    parseJsonDataAttribute,
  };
})();
