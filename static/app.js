
/* =========================================================
   JANASETU - DIGITAL CITIZEN FEEDBACK SYSTEM
   Complete Frontend JavaScript

   Features:
   - Citizen and Admin authentication
   - Password visibility
   - Optional feedback name
   - GPS current location
   - OpenStreetMap and Leaflet
   - Area and place autocomplete
   - Feedback submission and photo preview
   - Public tracking
   - Admin dashboard
   - Status updates and deletion
   - Session and logout management
   - Full-page app-style navigation
   - Responsive web application + PWA
   - ONLY LIGHT AND DARK THEMES
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

const appPanel = document.getElementById("panel");
const toastEl = document.getElementById("toast");

const statuses = [
  "Submitted",
  "Under Review",
  "In Progress",
  "Resolved"
];

let currentView = "home";
let currentUser = null;
let adminItems = [];
let activePhotoURL = null;

let feedbackMap = null;
let feedbackMarker = null;

let selectedLatitude = null;
let selectedLongitude = null;

let autocompleteTimer = null;
let autocompleteRequestId = 0;
let lastSearchTime = 0;
let locationRequestActive = false;

/* =========================================================
   COMMON FUNCTIONS
   ========================================================= */

function toast(message) {
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.classList.add("show");

  clearTimeout(toastEl.toastTimer);

  toastEl.toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3200);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function safeImageURL(value) {
  const url = String(value || "").trim();

  if (
    url.startsWith("/") ||
    url.startsWith("./") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  ) {
    return escapeHTML(url);
  }

  return "";
}

async function api(url, options = {}) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  let response;

  try {
    response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers
    });
  } catch {
    throw new Error(
      "Unable to connect. Please check your internet connection."
    );
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Something went wrong. Please try again."
    );
  }

  return data;
}

function setLoading(button, loading, originalText = "Submit") {
  if (!button) return;

  button.disabled = loading;
  button.textContent = loading
    ? "Please wait..."
    : originalText;
}

function releasePhotoPreview() {
  if (activePhotoURL) {
    URL.revokeObjectURL(activePhotoURL);
    activePhotoURL = null;
  }
}

function scrollPageToTop() {
  window.scrollTo({
    top: 0,
    behavior: "auto"
  });
}

/* =========================================================
   AUTHENTICATION UI
   ========================================================= */

function updateAuthUI() {
  const headerLogout = document.getElementById("logoutButton");

  if (headerLogout) {
    headerLogout.hidden = !(
      currentUser && currentUser.loggedIn
    );
  }
}

/* =========================================================
   FULL-PAGE APP LAYOUT
   ========================================================= */

function setPageLayout(showInnerPage) {
  const homeSections = [
    document.getElementById("home"),
    document.querySelector(".services-heading"),
    document.querySelector(".service-grid"),
    document.querySelector(".civic-features-section"),
    document.querySelector(".process-section"),
    document.querySelector(".citizen-help-section")
  ].filter(Boolean);

  homeSections.forEach(section => {
    section.hidden = showInnerPage;
    section.style.display = showInnerPage ? "none" : "";
  });

  const footer = document.querySelector(".government-footer");

  if (footer) {
    footer.hidden = showInnerPage;
    footer.style.display = showInnerPage ? "none" : "";
  }

  if (appPanel) {
    appPanel.hidden = !showInnerPage;
    appPanel.style.display = showInnerPage ? "" : "none";
  }

  document.body.classList.toggle(
    "inner-page-active",
    showInnerPage
  );

  document.body.classList.toggle(
    "app-screen-active",
    showInnerPage
  );
}

/* =========================================================
   PAGE SHELL
   ========================================================= */

function shell(title, lead, body, wide = false) {
  if (!appPanel) return;

  destroyFeedbackMap();

  setPageLayout(true);

  appPanel.innerHTML = `
    <div class="panel ${wide ? "wide" : ""}">

      <button
        type="button"
        class="back"
        data-view="home"
      >
        <span aria-hidden="true">←</span>
        Back to home
      </button>

      <h2>${escapeHTML(title)}</h2>

      <p class="lead">
        ${escapeHTML(lead)}
      </p>

      ${body}

    </div>
  `;

  scrollPageToTop();
}

/* =========================================================
   FORM FIELD GENERATOR
   ========================================================= */

function formField(label, name, type = "text", required = true) {
  const safeLabel = escapeHTML(label);
  const safeName = escapeHTML(name);
  const safeType = escapeHTML(type);

  if (type === "password") {
    return `
      <label class="form-field">

        <span>${safeLabel}</span>

        <div class="password-field">

          <input
            type="password"
            name="${safeName}"
            autocomplete="current-password"
            ${required ? "required" : ""}
          >

          <button
            type="button"
            class="password-toggle"
            aria-label="Show password"
            aria-pressed="false"
            title="Show password"
          >
            <svg
              viewBox="0 0 24 24"
              width="21"
              height="21"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

        </div>

      </label>
    `;
  }

  const autocomplete = type === "email"
    ? 'autocomplete="email"'
    : 'autocomplete="off"';

  return `
    <label class="form-field">

      <span>${safeLabel}</span>

      <input
        type="${safeType}"
        name="${safeName}"
        ${autocomplete}
        ${required ? "required" : ""}
      >

    </label>
  `;
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function statusBadge(status) {
  return `
    <span class="status-badge">
      ${escapeHTML(status)}
    </span>
  `;
}

/* =========================================================
   PASSWORD VISIBILITY
   ========================================================= */

document.addEventListener("click", event => {
  const toggle = event.target.closest(".password-toggle");

  if (!toggle) return;

  const wrapper = toggle.closest(".password-field");
  const input = wrapper?.querySelector("input");

  if (!input) return;

  const showing = input.type === "password";

  input.type = showing ? "text" : "password";

  toggle.setAttribute(
    "aria-label",
    showing ? "Hide password" : "Show password"
  );

  toggle.setAttribute(
    "aria-pressed",
    String(showing)
  );

  toggle.title = showing ? "Hide password" : "Show password";

  toggle.innerHTML = showing
    ? `
      <svg
        viewBox="0 0 24 24"
        width="21"
        height="21"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3l18 18"/>
        <path d="M10.6 10.6a2 2 0 002.8 2.8"/>
        <path d="M9.9 5.2A10.8 10.8 0 0112 5c6.4 0 10 7 10 7s-3.6 7-10 7-10-7-10-7 1.5-4 4.2-5.8"/>
      </svg>
    `
    : `
      <svg
        viewBox="0 0 24 24"
        width="21"
        height="21"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
});

/* =========================================================
   NAVIGATION
   ========================================================= */

function closeMenu() {
  const menu = document.getElementById("navMenu");
  const toggle = document.getElementById("menuToggle");

  if (menu) {
    menu.hidden = true;
  }

  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");
  }
}

function view(name) {
  releasePhotoPreview();
  currentView = name;

  closeMenu();

  const views = {
    home: homeView,
    submit: submitView,
    login: loginView,
    register: registerView,
    "admin-login": adminLoginView,
    track: trackView,
    admin: adminView
  };

  (views[name] || homeView)();
}

/* Navigation buttons */

document.addEventListener("click", event => {
  const button = event.target.closest("[data-view]");

  if (!button) return;

  event.preventDefault();

  view(button.dataset.view);
});

/* Header logout */

const headerLogoutButton = document.getElementById("logoutButton");

if (headerLogoutButton) {
  headerLogoutButton.addEventListener("click", logout);
}

/* Hamburger menu */

const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");

if (menuToggle && navMenu) {
  menuToggle.addEventListener("click", () => {
    const isOpen = !navMenu.hidden;

    navMenu.hidden = isOpen;

    menuToggle.setAttribute(
      "aria-expanded",
      String(!isOpen)
    );

    menuToggle.setAttribute(
      "aria-label",
      isOpen
        ? "Open navigation menu"
        : "Close navigation menu"
    );
  });

  document.addEventListener("click", event => {
    if (
      !event.target.closest("#navMenu") &&
      !event.target.closest("#menuToggle")
    ) {
      closeMenu();
    }
  });
}

/* =========================================================
   THEME SELECTOR
   ONLY LIGHT AND DARK THEMES
   ========================================================= */

const themeSelect = document.getElementById("themeSelect");

const allowedThemes = ["light", "dark"];

function applyTheme(theme) {
  const selectedTheme = allowedThemes.includes(theme)
    ? theme
    : "light";

  document.body.dataset.theme = selectedTheme;

  if (themeSelect) {
    themeSelect.value = selectedTheme;
  }

  try {
    localStorage.setItem("citizenTheme", selectedTheme);
  } catch {
    console.warn("Theme preference could not be saved.");
  }
}

/* Restore saved theme */

try {
  const savedTheme = localStorage.getItem("citizenTheme");

  applyTheme(savedTheme || "light");

} catch {
  applyTheme("light");
}

/* Listen for theme changes */

if (themeSelect) {
  themeSelect.addEventListener("change", event => {
    applyTheme(event.target.value);
  });
}

/* =========================================================
   HOME PAGE
   ========================================================= */

function homeView() {
  destroyFeedbackMap();

  if (appPanel) {
    appPanel.innerHTML = "";
  }

  setPageLayout(false);

  currentView = "home";

  updateAuthUI();

  scrollPageToTop();
}

/* =========================================================
   CITIZEN REGISTRATION
   ========================================================= */

function registerView() {
  shell(
    "Create Citizen Account",
    "Register to submit feedback and participate in improving your community.",
    `
      <form id="registerForm" class="app-form">

        ${formField("Full Name", "name")}

        ${formField("Email Address", "email", "email")}

        ${formField(
          "Password (minimum 8 characters)",
          "password",
          "password"
        )}

        ${formField(
          "Confirm Password",
          "confirmPassword",
          "password"
        )}

        <button type="submit" class="government-button">
          Create Account
        </button>

        <p class="form-note">
          Already registered?

          <button
            type="button"
            class="text-button"
            data-view="login"
          >
            Login here
          </button>
        </p>

        <div id="formMessage" class="form-message"></div>

      </form>
    `
  );

  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = form.querySelector('[type="submit"]');
    const formData = new FormData(form);

    const name = formData.get("name").trim();
    const email = formData.get("email").trim();
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (!name || !email) {
      toast("Please complete all required fields.");
      return;
    }

    if (password.length < 8) {
      toast("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast("Passwords do not match.");
      return;
    }

    setLoading(button, true, "Create Account");

    try {
      await api("/api/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password
        })
      });

      toast("Account created successfully!");

      await loadSession();

      view("submit");

    } catch (error) {
      toast(error.message);

    } finally {
      if (button.isConnected) {
        setLoading(button, false, "Create Account");
      }
    }
  });
}

/* =========================================================
   CITIZEN LOGIN
   ========================================================= */

function loginView() {
  shell(
    "Citizen Login",
    "Login to submit your feedback to the local administration.",
    `
      <form id="loginForm" class="app-form">

        ${formField("Email Address", "email", "email")}

        ${formField("Password", "password", "password")}

        <button type="submit" class="government-button">
          Login
        </button>

        <p class="form-note">
          Don't have an account?

          <button
            type="button"
            class="text-button"
            data-view="register"
          >
            Create Account
          </button>
        </p>

        <div id="formMessage" class="form-message"></div>

      </form>
    `
  );

  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = form.querySelector('[type="submit"]');
    const formData = new FormData(form);

    setLoading(button, true, "Login");

    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email").trim(),
          password: formData.get("password")
        })
      });

      toast("Login successful!");

      await loadSession();

      view("submit");

    } catch (error) {
      toast(error.message);

    } finally {
      if (button.isConnected) {
        setLoading(button, false, "Login");
      }
    }
  });
}

/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function adminLoginView() {
  shell(
    "Administrator Login",
    "Authorized administrators can manage citizen feedback.",
    `
      <form id="adminLoginForm" class="app-form">

        ${formField("Admin Username", "username")}

        ${formField("Password", "password", "password")}

        <button type="submit" class="government-button">
          Administrator Login
        </button>

        <div id="formMessage" class="form-message"></div>

      </form>
    `
  );

  const form = document.getElementById("adminLoginForm");

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = form.querySelector('[type="submit"]');
    const formData = new FormData(form);

    setLoading(button, true, "Administrator Login");

    try {
      await api("/api/admin-login", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username").trim(),
          password: formData.get("password")
        })
      });

      toast("Administrator login successful!");

      await loadSession();

      view("admin");

    } catch (error) {
      toast(error.message);

    } finally {
      if (button.isConnected) {
        setLoading(button, false, "Administrator Login");
      }
    }
  });
}

/* =========================================================
   LOCATION AND MAP FUNCTIONS
   ========================================================= */

function destroyFeedbackMap() {
  if (autocompleteTimer) {
    clearTimeout(autocompleteTimer);
    autocompleteTimer = null;
  }

  autocompleteRequestId++;

  if (feedbackMap) {
    feedbackMap.remove();
    feedbackMap = null;
    feedbackMarker = null;
  }

  selectedLatitude = null;
  selectedLongitude = null;
  locationRequestActive = false;
}

function updateLocationCoordinates(latitude, longitude) {
  selectedLatitude = Number(latitude);
  selectedLongitude = Number(longitude);

  const latInput = document.getElementById("latitudeInput");
  const lngInput = document.getElementById("longitudeInput");

  if (latInput) {
    latInput.value = selectedLatitude;
  }

  if (lngInput) {
    lngInput.value = selectedLongitude;
  }
}

function locationMessage(message, isError = false) {
  const element = document.getElementById("locationMessage");

  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
}

async function reverseGeocode(latitude, longitude) {
  const url = new URL(
    "https://nominatim.openstreetmap.org/reverse"
  );

  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude);
  url.searchParams.set("lon", longitude);
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Unable to identify this location.");
  }

  return response.json();
}

function extractAreaName(result) {
  const address = result.address || {};

  const parts = [
    address.neighbourhood,
    address.suburb,
    address.village,
    address.town,
    address.city_district,
    address.city,
    address.county,
    address.state
  ].filter(Boolean);

  const uniqueParts = [...new Set(parts)];

  return uniqueParts.slice(0, 3).join(", ") ||
    result.display_name ||
    "";
}

function setSelectedLocation(latitude, longitude, zoom = 16) {
  if (!feedbackMap) return;

  const position = [
    Number(latitude),
    Number(longitude)
  ];

  updateLocationCoordinates(
    position[0],
    position[1]
  );

  if (!feedbackMarker) {
    feedbackMarker = L.marker(position, {
      draggable: true
    }).addTo(feedbackMap);

    feedbackMarker.on("dragend", async () => {
      const point = feedbackMarker.getLatLng();

      updateLocationCoordinates(
        point.lat,
        point.lng
      );

      locationMessage("Updating selected map location...");

      try {
        const result = await reverseGeocode(
          point.lat,
          point.lng
        );

        const area = extractAreaName(result);
        const areaInput = document.getElementById("areaInput");

        if (areaInput && area) {
          areaInput.value = area;
        }

        locationMessage(
          area
            ? `Selected location: ${area}`
            : "Map location selected."
        );

      } catch {
        locationMessage(
          "Map location selected. Enter the area name manually."
        );
      }
    });

  } else {
    feedbackMarker.setLatLng(position);
  }

  feedbackMap.setView(position, zoom);
}

async function useCurrentLocation() {
  if (locationRequestActive) return;

  if (!navigator.geolocation) {
    toast("Location access is not supported by this device.");
    return;
  }

  if (!feedbackMap) {
    toast("Map is not ready yet.");
    return;
  }

  const button = document.getElementById("currentLocationButton");

  locationRequestActive = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Getting location...";
  }

  locationMessage("Requesting permission to access your location...");

  navigator.geolocation.getCurrentPosition(
    async position => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      setSelectedLocation(latitude, longitude, 17);

      locationMessage("Your current location was detected.");

      try {
        const result = await reverseGeocode(
          latitude,
          longitude
        );

        const area = extractAreaName(result);
        const areaInput = document.getElementById("areaInput");

        if (areaInput && area) {
          areaInput.value = area;
        }

        locationMessage(
          area
            ? `Current location: ${area}`
            : "Current location selected successfully."
        );

      } catch {
        locationMessage(
          "GPS location selected. Please enter your area name."
        );
      }

      locationRequestActive = false;

      if (button && button.isConnected) {
        button.disabled = false;
        button.textContent = "◎ Use Current Location";
      }
    },

    error => {
      let message = "Unable to access your location.";

      if (error.code === error.PERMISSION_DENIED) {
        message = "Location permission denied. Allow location access in your browser.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "Your current location is unavailable.";
      } else if (error.code === error.TIMEOUT) {
        message = "Location request timed out. Please try again.";
      }

      locationMessage(message, true);
      toast(message);

      locationRequestActive = false;

      if (button && button.isConnected) {
        button.disabled = false;
        button.textContent = "◎ Use Current Location";
      }
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 60000
    }
  );
}

function initializeFeedbackMap() {
  const mapElement = document.getElementById("feedbackMap");

  if (!mapElement) return;

  if (typeof L === "undefined") {
    locationMessage(
      "Map library could not load. Check your internet connection.",
      true
    );

    return;
  }

  if (feedbackMap) {
    feedbackMap.remove();
    feedbackMap = null;
    feedbackMarker = null;
  }

  feedbackMap = L.map("feedbackMap", {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([13.0827, 77.5877], 11);

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }
  ).addTo(feedbackMap);

  feedbackMap.on("click", async event => {
    const latitude = event.latlng.lat;
    const longitude = event.latlng.lng;

    setSelectedLocation(latitude, longitude, 16);

    locationMessage("Finding the selected area...");

    try {
      const result = await reverseGeocode(
        latitude,
        longitude
      );

      const area = extractAreaName(result);
      const areaInput = document.getElementById("areaInput");

      if (areaInput && area) {
        areaInput.value = area;
      }

      locationMessage(
        area
          ? `Selected area: ${area}`
          : "Map location selected."
      );

    } catch {
      locationMessage(
        "Location selected. Please enter the area name manually."
      );
    }
  });

  setTimeout(() => {
    if (feedbackMap) {
      feedbackMap.invalidateSize();
    }
  }, 250);
}

async function searchPlaces(query) {
  const url = new URL(
    "https://nominatim.openstreetmap.org/search"
  );

  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "in");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Place search is temporarily unavailable.");
  }

  return response.json();
}

function showPlaceSuggestions(results) {
  const suggestions = document.getElementById("areaSuggestions");

  if (!suggestions) return;

  suggestions.innerHTML = "";

  if (!results.length) {
    const empty = document.createElement("div");

    empty.className = "place-no-results";
    empty.textContent = "No matching places found.";

    suggestions.appendChild(empty);
    suggestions.hidden = false;

    return;
  }

  results.forEach(result => {
    const item = document.createElement("button");

    item.type = "button";
    item.className = "place-suggestion location-suggestion";

    const title = document.createElement("strong");

    title.textContent =
      extractAreaName(result) ||
      result.name ||
      "Selected place";

    const description = document.createElement("small");

    description.textContent = result.display_name || "";

    item.appendChild(title);
    item.appendChild(description);

    item.addEventListener("click", () => {
      selectSuggestedPlace(result);
    });

    suggestions.appendChild(item);
  });

  suggestions.hidden = false;
}

function selectSuggestedPlace(result) {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    toast("Unable to select this place.");
    return;
  }

  const areaInput = document.getElementById("areaInput");
  const suggestions = document.getElementById("areaSuggestions");

  const area =
    extractAreaName(result) ||
    result.name ||
    result.display_name;

  if (areaInput) {
    areaInput.value = area;
  }

  if (suggestions) {
    suggestions.innerHTML = "";
    suggestions.hidden = true;
  }

  setSelectedLocation(latitude, longitude, 16);

  locationMessage(`Selected location: ${area}`);
}

function initializePlaceAutocomplete() {
  const areaInput = document.getElementById("areaInput");
  const suggestions = document.getElementById("areaSuggestions");

  if (!areaInput || !suggestions) return;

  areaInput.addEventListener("input", () => {
    const query = areaInput.value.trim();
    const requestId = ++autocompleteRequestId;

    if (autocompleteTimer) {
      clearTimeout(autocompleteTimer);
    }

    suggestions.innerHTML = "";
    suggestions.hidden = true;

    selectedLatitude = null;
    selectedLongitude = null;

    const latInput = document.getElementById("latitudeInput");
    const lngInput = document.getElementById("longitudeInput");

    if (latInput) latInput.value = "";
    if (lngInput) lngInput.value = "";

    if (query.length < 3) return;

    autocompleteTimer = setTimeout(async () => {
      try {
        const now = Date.now();

        const wait = Math.max(
          0,
          1100 - (now - lastSearchTime)
        );

        await new Promise(resolve => setTimeout(resolve, wait));

        if (
          requestId !== autocompleteRequestId ||
          areaInput.value.trim() !== query
        ) {
          return;
        }

        lastSearchTime = Date.now();

        const results = await searchPlaces(query);

        if (
          requestId !== autocompleteRequestId ||
          areaInput.value.trim() !== query
        ) {
          return;
        }

        showPlaceSuggestions(results);

      } catch {
        if (
          requestId === autocompleteRequestId &&
          areaInput.value.trim() === query
        ) {
          suggestions.innerHTML = "";

          const message = document.createElement("div");

          message.className = "place-no-results";

          message.textContent =
            "Place search unavailable. You can enter the area manually.";

          suggestions.appendChild(message);
          suggestions.hidden = false;
        }
      }
    }, 750);
  });

  areaInput.addEventListener("focus", () => {
    if (
      suggestions.children.length > 0 &&
      areaInput.value.trim().length >= 3
    ) {
      suggestions.hidden = false;
    }
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".location-search-wrap")) {
      suggestions.hidden = true;
    }
  });
}

function initializeLocationControls() {
  initializeFeedbackMap();
  initializePlaceAutocomplete();

  const currentLocationButton = document.getElementById(
    "currentLocationButton"
  );

  if (currentLocationButton) {
    currentLocationButton.addEventListener(
      "click",
      useCurrentLocation
    );
  }
}

/* =========================================================
   PHOTO UPLOAD AND FEEDBACK SUBMISSION
   ========================================================= */

function validatePhoto(file) {
  if (!file) {
    return "Please upload a photo.";
  }

  if (file.type && !file.type.startsWith("image/")) {
    return "Please select an image file.";
  }

  return "";
}

function submitView() {
  if (!currentUser || currentUser.role !== "citizen") {
    shell(
      "Citizen Login Required",
      "Please login to your citizen account before submitting feedback.",
      `
        <div class="action-buttons">

          <button
            class="government-button"
            data-view="login"
          >
            Citizen Login
          </button>

          <button
            class="outline-button"
            data-view="register"
          >
            Create Account
          </button>

        </div>
      `
    );

    return;
  }

  shell(
    "Submit Your Feedback",
    "Describe the local issue, select its location and upload a photograph.",
    `
      <form id="suggestionForm" class="app-form">

        ${formField("Your Name (Optional)", "name", "text", false)}

        <label class="form-field">

          <span>Feedback Category *</span>

          <select name="category" required>

            <option value="">Select a category</option>
            <option value="Roads and Infrastructure">Roads and Infrastructure</option>
            <option value="Water Supply">Water Supply</option>
            <option value="Waste Management">Waste Management</option>
            <option value="Street Lights">Street Lights</option>
            <option value="Drainage">Drainage</option>
            <option value="Public Facilities">Public Facilities</option>
            <option value="Sanitation">Sanitation</option>
            <option value="Other">Other</option>

          </select>

        </label>

        <div class="form-field location-field">

          <span>Area / Place *</span>

          <div class="location-search-wrap">

            <input
              type="text"
              name="area"
              id="areaInput"
              placeholder="Type an area, road or place..."
              autocomplete="off"
              required
            >

            <div
              id="areaSuggestions"
              class="area-suggestions location-suggestions"
              hidden
            ></div>

          </div>

          <small class="form-note">
            Start typing at least 3 characters to find places.
          </small>

        </div>

        <div class="location-controls location-actions">

          <button
            type="button"
            class="location-button"
            id="currentLocationButton"
          >
            ◎ Use Current Location
          </button>

          <span
            id="locationMessage"
            class="location-message location-status"
          >
            Search for a place or use your current location.
          </span>

        </div>

        <input
          type="hidden"
          name="latitude"
          id="latitudeInput"
          value=""
        >

        <input
          type="hidden"
          name="longitude"
          id="longitudeInput"
          value=""
        >

        <div class="map-section location-map-section">

          <div class="map-heading">

            <strong>Select the issue location</strong>

            <small>
              Search for a place or tap the map to select a location.
            </small>

          </div>

          <div
            id="feedbackMap"
            class="feedback-map location-map"
            role="application"
            aria-label="Map for selecting feedback location"
          ></div>

          <p class="map-help location-help">
            You can drag the map marker to adjust the exact location.
          </p>

          <p class="map-attribution">
            Map data © OpenStreetMap contributors
          </p>

        </div>

        <label class="form-field">

          <span>Describe Your Issue *</span>

          <textarea
            name="description"
            rows="5"
            placeholder="Explain the problem or suggestion..."
            required
          ></textarea>

        </label>

        <label class="form-field">

          <span>Upload Photo *</span>

          <input
            type="file"
            name="photo"
            id="photoInput"
            accept="image/*"
            required
          >

          <small class="form-note">
            Select an image from your device or camera.
          </small>

        </label>

        <div id="photoPreview" class="photo-preview"></div>

        <button type="submit" class="government-button">
          Submit Feedback
        </button>

        <div id="formMessage" class="form-message"></div>

      </form>
    `
  );

  initializeLocationControls();

  const form = document.getElementById("suggestionForm");
  const photoInput = document.getElementById("photoInput");
  const preview = document.getElementById("photoPreview");

  photoInput.addEventListener("change", () => {
    preview.innerHTML = "";
    releasePhotoPreview();

    const file = photoInput.files[0];

    if (!file) return;

    const validationError = validatePhoto(file);

    if (validationError) {
      photoInput.value = "";
      toast(validationError);
      return;
    }

    activePhotoURL = URL.createObjectURL(file);

    const image = document.createElement("img");

    image.src = activePhotoURL;
    image.alt = "Selected feedback photo";

    image.style.width = "100%";
    image.style.maxWidth = "260px";
    image.style.height = "auto";
    image.style.objectFit = "contain";
    image.style.borderRadius = "12px";

    preview.appendChild(image);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const file = photoInput.files[0];
    const validationError = validatePhoto(file);

    if (validationError) {
      toast(validationError);
      return;
    }

    const button = form.querySelector('[type="submit"]');
    const formData = new FormData(form);

    if (
      !formData.get("latitude") ||
      !formData.get("longitude")
    ) {
      formData.delete("latitude");
      formData.delete("longitude");
    }

    setLoading(button, true, "Submit Feedback");

    try {
      const result = await api("/api/suggestions", {
        method: "POST",
        body: formData
      });

      const trackingId = result.trackingId;

      if (!trackingId) {
        throw new Error(
          "Feedback was submitted, but the tracking ID was not received."
        );
      }

      releasePhotoPreview();
      destroyFeedbackMap();

      shell(
        "Feedback Submitted Successfully!",
        "Your feedback has been recorded. Save your tracking ID.",
        `
          <div class="success-panel">

            <h3>Your Tracking ID</h3>

            <div class="tracking-code" id="newTrackingId">
              ${escapeHTML(trackingId)}
            </div>

            <button
              type="button"
              class="outline-button"
              id="copyTrackingButton"
            >
              Copy Tracking ID
            </button>

            <p>
              Use this tracking ID to check the progress
              of your feedback.
            </p>

            <button
              type="button"
              class="government-button"
              id="trackNewButton"
            >
              Track Your Feedback
            </button>

          </div>
        `
      );

      document.getElementById("copyTrackingButton")
        .addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(trackingId);
            toast("Tracking ID copied!");

          } catch {
            toast("Please copy the tracking ID manually.");
          }
        });

      document.getElementById("trackNewButton")
        .addEventListener("click", () => {
          view("track");

          const input = document.getElementById("trackingInput");

          if (input) {
            input.value = trackingId;
          }
        });

    } catch (error) {
      toast(error.message);

    } finally {
      if (button.isConnected) {
        setLoading(button, false, "Submit Feedback");
      }
    }
  });
}

/* =========================================================
   PUBLIC FEEDBACK TRACKING
   ========================================================= */

function trackView() {
  shell(
    "Track Your Feedback",
    "Enter your tracking ID to check the current status of your application.",
    `
      <form id="trackForm" class="app-form">

        <label class="form-field">

          <span>Tracking ID</span>

          <input
            type="text"
            id="trackingInput"
            name="trackingId"
            placeholder="Example: DSB-XXXXXXXXXX"
            required
          >

        </label>

        <button type="submit" class="government-button">
          Track Application
        </button>

      </form>

      <div id="trackingResult"></div>
    `
  );

  const form = document.getElementById("trackForm");

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const input = document.getElementById("trackingInput");
    const resultBox = document.getElementById("trackingResult");
    const button = form.querySelector('[type="submit"]');

    const trackingId = input.value.trim().toUpperCase();

    if (!trackingId) {
      toast("Please enter your tracking ID.");
      return;
    }

    setLoading(button, true, "Track Application");

    resultBox.innerHTML = "";

    try {
      const data = await api(
        `/api/track/${encodeURIComponent(trackingId)}`
      );

      showTrackingResult(data, resultBox);

    } catch (error) {
      resultBox.innerHTML = `
        <div class="error-panel">
          ${escapeHTML(error.message)}
        </div>
      `;

    } finally {
      if (button.isConnected) {
        setLoading(button, false, "Track Application");
      }
    }
  });
}

/* Tracking result */

function showTrackingResult(data, container) {
  const currentIndex = statuses.indexOf(data.status);

  const timeline = statuses.map((status, index) => `
    <div class="timeline-item ${index <= currentIndex ? "completed" : ""}">

      <span class="timeline-dot"></span>

      <div>
        <strong>${escapeHTML(status)}</strong>
      </div>

    </div>
  `).join("");

  const photoURL = safeImageURL(data.photoUrl);

  const hasCoordinates =
    data.latitude !== null &&
    data.latitude !== undefined &&
    data.longitude !== null &&
    data.longitude !== undefined;

  container.innerHTML = `
    <div class="tracking-result">

      <h3>Feedback Details</h3>

      <p>
        <strong>Tracking ID:</strong>
        ${escapeHTML(data.tracking_id)}
      </p>

      <p>
        <strong>Name:</strong>
        ${escapeHTML(data.name)}
      </p>

      <p>
        <strong>Category:</strong>
        ${escapeHTML(data.category)}
      </p>

      <p>
        <strong>Area:</strong>
        ${escapeHTML(data.area)}
      </p>

      <p>
        <strong>Description:</strong>
        ${escapeHTML(data.description)}
      </p>

      <p>
        <strong>Current Status:</strong>
        ${statusBadge(data.status)}
      </p>

      <h3>Application Progress</h3>

      <div class="status-timeline">
        ${timeline}
      </div>

      <h3>Administrator Response</h3>

      <p>
        ${escapeHTML(
          data.admin_response ||
          "No response has been added yet."
        )}
      </p>

      ${
        photoURL
          ? `
            <h3>Uploaded Photo</h3>

            <img
              src="${photoURL}"
              alt="Uploaded feedback"
              class="tracking-photo"
              loading="lazy"
            >
          `
          : ""
      }

      ${
        hasCoordinates
          ? `
            <p>
              <strong>Location coordinates:</strong>
              ${escapeHTML(data.latitude)},
              ${escapeHTML(data.longitude)}
            </p>
          `
          : ""
      }

      <p class="small-text">
        Last updated:
        ${escapeHTML(data.updated_at || "Not available")}
      </p>

    </div>
  `;
}

/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

function adminView() {
  if (!currentUser || currentUser.role !== "admin") {
    shell(
      "Administrator Login Required",
      "Please login with administrator credentials.",
      `
        <button
          class="government-button"
          data-view="admin-login"
        >
          Administrator Login
        </button>
      `
    );

    return;
  }

  shell(
    "Administrator Dashboard",
    "Manage citizen feedback and update application progress.",
    `
      <div class="admin-toolbar">

        <input
          type="search"
          id="adminSearch"
          placeholder="Search by ID, name, area or category..."
        >

        <select id="adminStatusFilter">

          <option value="">All Statuses</option>

          ${statuses.map(status => `
            <option value="${escapeHTML(status)}">
              ${escapeHTML(status)}
            </option>
          `).join("")}

        </select>

        <button
          type="button"
          class="outline-button"
          id="refreshAdmin"
        >
          Refresh
        </button>

      </div>

      <div id="adminStats" class="stats-grid"></div>

      <div id="adminTable" class="admin-table-wrap">
        Loading feedback...
      </div>

      <button
        type="button"
        class="outline-button"
        id="adminLogoutButton"
      >
        Logout
      </button>
    `,
    true
  );

  document.getElementById("adminSearch")
    .addEventListener("input", renderAdminTable);

  document.getElementById("adminStatusFilter")
    .addEventListener("change", renderAdminTable);

  document.getElementById("refreshAdmin")
    .addEventListener("click", loadAdminData);

  document.getElementById("adminLogoutButton")
    .addEventListener("click", logout);

  loadAdminData();
}

/* Load admin data */

async function loadAdminData() {
  const table = document.getElementById("adminTable");

  if (!table) return;

  table.textContent = "Loading feedback...";

  try {
    const data = await api("/api/admin/suggestions");

    adminItems = Array.isArray(data.items)
      ? data.items
      : [];

    const stats = data.stats || {};
    const statsBox = document.getElementById("adminStats");

    if (statsBox) {
      const statNames = [
        "Total",
        "Submitted",
        "Under Review",
        "In Progress",
        "Resolved"
      ];

      statsBox.innerHTML = statNames.map(name => `
        <div class="stat-card">

          <span>${escapeHTML(name)}</span>

          <strong>${Number(stats[name] || 0)}</strong>

        </div>
      `).join("");
    }

    renderAdminTable();

  } catch (error) {
    if (table.isConnected) {
      table.innerHTML = `
        <div class="error-panel">
          ${escapeHTML(error.message)}
        </div>
      `;
    }
  }
}

/* Render admin records */

function renderAdminTable() {
  const table = document.getElementById("adminTable");

  if (!table) return;

  const search = (
    document.getElementById("adminSearch")?.value || ""
  ).toLowerCase();

  const filter = (
    document.getElementById("adminStatusFilter")?.value || ""
  );

  const filtered = adminItems.filter(item => {
    const matchesSearch = [
      item.tracking_id,
      item.name,
      item.area,
      item.category,
      item.description
    ].some(value =>
      String(value || "").toLowerCase().includes(search)
    );

    const matchesStatus =
      !filter || item.status === filter;

    return matchesSearch && matchesStatus;
  });

  if (!filtered.length) {
    table.innerHTML = `
      <div class="empty-state">
        No feedback records found.
      </div>
    `;

    return;
  }

  table.innerHTML = `
    <div class="admin-record-list">

      ${filtered.map(item => {
        const photoURL = safeImageURL(item.photoUrl);

        return `
          <article class="admin-record">

            <div class="admin-record-header">

              <strong>
                ${escapeHTML(item.tracking_id)}
              </strong>

              ${statusBadge(item.status)}

            </div>

            <p>
              <strong>Name:</strong>
              ${escapeHTML(item.name)}
            </p>

            <p>
              <strong>Category:</strong>
              ${escapeHTML(item.category)}
            </p>

            <p>
              <strong>Area:</strong>
              ${escapeHTML(item.area)}
            </p>

            <p>
              <strong>Description:</strong>
              ${escapeHTML(item.description)}
            </p>

            ${
              photoURL
                ? `
                  <img
                    src="${photoURL}"
                    alt="Feedback photo"
                    class="admin-photo"
                    loading="lazy"
                  >
                `
                : ""
            }

            <label class="form-field">

              <span>Update Status</span>

              <select
                class="admin-status"
                data-id="${escapeHTML(item.tracking_id)}"
              >

                ${statuses.map(status => `
                  <option
                    value="${escapeHTML(status)}"
                    ${item.status === status ? "selected" : ""}
                  >
                    ${escapeHTML(status)}
                  </option>
                `).join("")}

              </select>

            </label>

            <label class="form-field">

              <span>Administrator Response</span>

              <textarea
                class="admin-response"
                data-id="${escapeHTML(item.tracking_id)}"
                rows="3"
                placeholder="Write your response..."
              >${escapeHTML(item.admin_response || "")}</textarea>

            </label>

            <div class="admin-actions">

              <button
                type="button"
                class="government-button save-admin"
                data-id="${escapeHTML(item.tracking_id)}"
              >
                Save Update
              </button>

              <button
                type="button"
                class="danger-button delete-admin"
                data-id="${escapeHTML(item.tracking_id)}"
              >
                Delete
              </button>

            </div>

          </article>
        `;
      }).join("")}

    </div>
  `;

  table.querySelectorAll(".save-admin").forEach(button => {
    button.addEventListener("click", () => {
      updateAdminRecord(button.dataset.id);
    });
  });

  table.querySelectorAll(".delete-admin").forEach(button => {
    button.addEventListener("click", () => {
      deleteAdminRecord(button.dataset.id);
    });
  });
}

/* Admin update */

async function updateAdminRecord(trackingId) {
  const statusInput = document.querySelector(
    `.admin-status[data-id="${CSS.escape(trackingId)}"]`
  );

  const responseInput = document.querySelector(
    `.admin-response[data-id="${CSS.escape(trackingId)}"]`
  );

  if (!statusInput || !responseInput) return;

  try {
    await api(
      `/api/admin/suggestions/${encodeURIComponent(trackingId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: statusInput.value,
          admin_response: responseInput.value
        })
      }
    );

    toast("Feedback updated successfully!");

    await loadAdminData();

  } catch (error) {
    toast(error.message);
  }
}

/* Admin delete */

async function deleteAdminRecord(trackingId) {
  const confirmed = confirm(
    `Are you sure you want to delete feedback ${trackingId}?`
  );

  if (!confirmed) return;

  try {
    await api(
      `/api/admin/suggestions/${encodeURIComponent(trackingId)}`,
      {
        method: "DELETE"
      }
    );

    toast("Feedback deleted successfully!");

    await loadAdminData();

  } catch (error) {
    toast(error.message);
  }
}

/* =========================================================
   SESSION AND LOGOUT
   ========================================================= */

async function loadSession() {
  try {
    const data = await api("/api/session");

    currentUser = data.loggedIn
      ? data
      : null;

    updateAuthUI();

    return currentUser;

  } catch {
    currentUser = null;

    updateAuthUI();

    return null;
  }
}

async function logout() {
  try {
    await api("/api/logout", {
      method: "POST"
    });

    currentUser = null;
    adminItems = [];

    updateAuthUI();

    toast("You have been logged out.");

    view("home");

  } catch (error) {
    toast(error.message);
  }
}

/* =========================================================
   SERVICE WORKER
   ========================================================= */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .catch(error => {
        console.warn(
          "Service worker registration failed:",
          error
        );
      });
  });
}

/* =========================================================
   START APPLICATION
   ========================================================= */

(async function startApplication() {
  await loadSession();

  homeView();
})();
