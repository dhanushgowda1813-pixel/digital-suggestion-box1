/* =========================================================
   JANASETU - DIGITAL CITIZEN FEEDBACK SYSTEM
   Multi-page Frontend JavaScript
   ========================================================= */

(() => {
  "use strict";

  const API = "";
  const pageContent = document.getElementById("pageContent");
  const page = pageContent?.dataset.page || "home";
  const toastEl = document.getElementById("toast");

  const STATUSES = [
    "Submitted",
    "Under Review",
    "In Progress",
    "Resolved"
  ];

  let currentUser = null;
  let adminItems = [];
  let map = null;
  let mapMarker = null;
  let activePhotoURL = null;
  let selectedLatitude = "";
  let selectedLongitude = "";
  let autocompleteTimer = null;

  /* -------------------- COMMON HELPERS -------------------- */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showToast(message, type = "success") {
    if (!toastEl) {
      alert(message);
      return;
    }

    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toastEl.className = "toast";
    }, 3500);
  }

  async function api(url, options = {}) {
    const response = await fetch(API + url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.headers || {})
      }
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        `Request failed (${response.status})`
      );
    }

    return data;
  }

  function setLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;
      button.textContent =
        button.dataset.originalText || "Submit";
    }
  }

  function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function safeImageURL(url) {
    if (!url) return "";

    try {
      const parsed = new URL(url, window.location.origin);

      if (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      ) {
        return parsed.href;
      }
    } catch {
      return "";
    }

    return "";
  }

  function navigate(url) {
    window.location.href = url;
  }

  function getNextPage(defaultPage) {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    if (next === "submit") return "/submit";

    return defaultPage;
  }

  /* -------------------- THEME -------------------- */

  function applyTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";

    document.body.dataset.theme = selected;

    const selector = $("#themeSelect");

    if (selector) {
      selector.value = selected;
    }

    localStorage.setItem("citizenTheme", selected);
  }

  function initializeTheme() {
    const saved = localStorage.getItem("citizenTheme") || "light";
    applyTheme(saved);

    $("#themeSelect")?.addEventListener("change", event => {
      applyTheme(event.target.value);
    });
  }

  /* -------------------- PASSWORD VISIBILITY -------------------- */

  document.addEventListener("click", event => {
    const button = event.target.closest(".password-toggle");

    if (!button) return;

    const wrapper = button.closest(".password-field");
    const input = wrapper?.querySelector("input");

    if (!input) return;

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";

    button.innerHTML = isPassword
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9 4.5 10 7-.3 1-1.1 2.2-2.3 3.4M6.2 6.2C3.9 7.6 2.5 9.7 2 12c1 2.5 4.8 7 10 7 1.4 0 2.7-.3 3.8-.8"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    button.setAttribute(
      "aria-label",
      isPassword ? "Hide password" : "Show password"
    );
    button.setAttribute("title", isPassword ? "Hide password" : "Show password");
  });

  /* -------------------- MOBILE NAVIGATION -------------------- */

  function initializeNavigation() {
    const toggle = $("#menuToggle");
    const menu = $("#navMenu");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", () => {
      const isOpen = menu.hidden;
      menu.hidden = !isOpen;
      menu.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    menu.addEventListener("click", event => {
      if (event.target.closest("a")) {
        menu.hidden = true;
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* -------------------- SESSION -------------------- */

  async function loadSession() {
    try {
      const data = await api("/api/session");

      currentUser = data.loggedIn
        ? { role: data.role, name: data.name }
        : null;

      updateAuthenticationUI();
      return data;
    } catch {
      currentUser = null;
      updateAuthenticationUI();
      return null;
    }
  }



  function updateAuthenticationUI() {
    const logoutButton = $("#logoutButton");

    if (logoutButton) {
      logoutButton.hidden = !currentUser;
    }
  }

  async function logout() {
    try {
      await api("/api/logout", {
        method: "POST",
        body: JSON.stringify({})
      });

      currentUser = null;
      showToast("Logged out successfully.");
      navigate("/");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  $("#logoutButton")?.addEventListener("click", logout);

  /* =========================================================
     REGISTRATION PAGE
     ========================================================= */

  function renderRegisterPage() {
    if (!pageContent) return;

    pageContent.innerHTML = `
      <div class="app-panel auth-panel">
        <div class="panel-heading">
          <h2>Create Citizen Account</h2>
          <p>Register to submit and track your feedback.</p>
        </div>

        <form id="registerForm" class="app-form">
          <div class="form-field">
            <label for="registerName">Full Name</label>
            <input
              id="registerName"
              name="name"
              type="text"
              placeholder="Enter your full name"
              autocomplete="name"
              required
            >
          </div>

          <div class="form-field">
            <label for="registerEmail">Email Address</label>
            <input
              id="registerEmail"
              name="email"
              type="email"
              placeholder="Enter your email"
              autocomplete="email"
              required
            >
          </div>

          <div class="form-field">
            <label for="registerPassword">Password</label>
            <div class="password-field">
              <input
                id="registerPassword"
                name="password"
                type="password"
                placeholder="Create a password"
                autocomplete="new-password"
                minlength="6"
                required
              >
              <button type="button" class="password-toggle" aria-label="Show password" title="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
            </div>
          </div>

          <div class="form-field">
            <label for="confirmPassword">Confirm Password</label>
            <div class="password-field">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Enter password again"
                autocomplete="new-password"
                required
              >
              <button type="button" class="password-toggle" aria-label="Show password" title="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
            </div>
          </div>

          <button class="primary-button" type="submit">
            Create Account
          </button>

          <p class="form-note">
            Already registered?
            <a href="/login">Login here</a>
          </p>
        </form>
      </div>
    `;

    $("#registerForm")?.addEventListener("submit", handleRegister);
  }

  async function handleRegister(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');

    const name = $("#registerName").value.trim();
    const email = $("#registerEmail").value.trim();
    const password = $("#registerPassword").value;
    const confirmPassword = $("#confirmPassword").value;

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    setLoading(button, true, "Creating account...");

    try {
      await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });

      showToast("Account created successfully.");
      navigate("/login");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  }

  /* =========================================================
     CITIZEN LOGIN PAGE
     ========================================================= */

  function renderLoginPage() {
    if (!pageContent) return;

    pageContent.innerHTML = `
      <div class="app-panel auth-panel">
        <div class="panel-heading">
          <h2>Citizen Login</h2>
          <p>Login to share your feedback with your community.</p>
        </div>

        <form id="loginForm" class="app-form">
          <div class="form-field">
            <label for="loginEmail">Email Address</label>
            <input
              id="loginEmail"
              name="email"
              type="email"
              placeholder="Enter your registered email"
              autocomplete="email"
              required
            >
          </div>

          <div class="form-field">
            <label for="loginPassword">Password</label>
            <div class="password-field">
              <input
                id="loginPassword"
                name="password"
                type="password"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
              >
              <button type="button" class="password-toggle" aria-label="Show password" title="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
            </div>
          </div>

          <button class="primary-button" type="submit">
            Login
          </button>

          <p class="form-note">
            Don't have an account?
            <a href="/register">Create an account</a>
          </p>
        </form>
      </div>
    `;

    $("#loginForm")?.addEventListener("submit", handleLogin);
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');

    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    setLoading(button, true, "Logging in...");

    try {
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      showToast("Login successful.");
      navigate(getNextPage("/submit"));
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  }

  /* =========================================================
     ADMIN LOGIN PAGE
     ========================================================= */

  function renderAdminLoginPage() {
    if (!pageContent) return;

    pageContent.innerHTML = `
      <div class="app-panel auth-panel">
        <div class="panel-heading">
          <h2>Admin Login</h2>
          <p>Authorized administrators can access the dashboard.</p>
        </div>

        <form id="adminLoginForm" class="app-form">
          <div class="form-field">
            <label for="adminUsername">Username</label>
            <input
              id="adminUsername"
              name="username"
              type="text"
              placeholder="Enter admin username"
              autocomplete="username"
              required
            >
          </div>

          <div class="form-field">
            <label for="adminPassword">Password</label>
            <div class="password-field">
              <input
                id="adminPassword"
                name="password"
                type="password"
                placeholder="Enter admin password"
                autocomplete="current-password"
                required
              >
              <button type="button" class="password-toggle" aria-label="Show password" title="Show password"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
            </div>
          </div>

          <button class="primary-button" type="submit">
            Admin Login
          </button>
        </form>
      </div>
    `;

    $("#adminLoginForm")?.addEventListener(
      "submit",
      handleAdminLogin
    );
  }

  async function handleAdminLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');

    const username = $("#adminUsername").value.trim();
    const password = $("#adminPassword").value;

    setLoading(button, true, "Verifying...");

    try {
      await api("/api/admin-login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      showToast("Admin login successful.");
      navigate("/admin");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  }

  /* =========================================================
     SUBMIT FEEDBACK PAGE
     ========================================================= */

  function renderSubmitPage() {
    if (!pageContent) return;

    pageContent.innerHTML = `
      <div class="app-panel form-panel">
        <div class="panel-heading">
          <h2>Submit Your Feedback</h2>
          <p>
            Share a suggestion or report an issue in your community.
          </p>
        </div>

        <form id="suggestionForm" class="app-form">

          <div class="form-field">
            <label for="citizenName">Your Name</label>
            <input
              id="citizenName"
              name="name"
              type="text"
              placeholder="Enter your name (optional)"
              autocomplete="name"
            >
          </div>

          <div class="form-field">
            <label for="categoryInput">Feedback Category</label>
            <select id="categoryInput" name="category" required>
              <option value="">Select a category</option>
              <option value="Roads and Transport">Roads and Transport</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Street Lights">Street Lights</option>
              <option value="Sanitation and Cleanliness">Sanitation and Cleanliness</option>
              <option value="Drainage">Drainage</option>
              <option value="Public Facilities">Public Facilities</option>
              <option value="Environment">Environment</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="form-field">
            <label for="areaInput">Area / Location</label>
            <input
              id="areaInput"
              name="area"
              type="text"
              placeholder="Enter your area or location"
              autocomplete="off"
              required
            >
            <div id="areaSuggestions" class="area-suggestions"></div>
          </div>

          <div class="form-field">
            <label>Mark Location on Map</label>

            <button
              type="button"
              id="currentLocationButton"
              class="secondary-button"
            >
              <span aria-hidden="true">◎</span>
              Use My Current Location
            </button>

            <p id="locationMessage" class="form-note">
              You can use your current location or select a place on the map.
            </p>

            <div id="feedbackMap" class="feedback-map"></div>

            <input type="hidden" id="latitudeInput" name="latitude">
            <input type="hidden" id="longitudeInput" name="longitude">
          </div>

          <div class="form-field">
            <label for="descriptionInput">Describe Your Feedback</label>
            <textarea
              id="descriptionInput"
              name="description"
              rows="5"
              placeholder="Explain your suggestion or the issue..."
              required
            ></textarea>
          </div>

          <div class="form-field">
            <label for="photoInput">Upload Photo</label>
            <input
              id="photoInput"
              name="photo"
              type="file"
              accept="image/*"
              required
            >
            <p class="form-note">
              Please attach a photo related to your feedback.
            </p>
            <div id="photoPreview" class="photo-preview"></div>
          </div>

          <button class="primary-button" type="submit">
            Submit Feedback
          </button>
        </form>
      </div>
    `;

    initializeMap();
    initializeLocation();
    initializeAreaAutocomplete();
    initializePhotoPreview();

    $("#suggestionForm")?.addEventListener(
      "submit",
      handleSuggestionSubmit
    );
  }

  /* -------------------- MAP -------------------- */

  function initializeMap() {
    const mapElement = $("#feedbackMap");

    if (!mapElement || typeof L === "undefined") {
      if (mapElement) {
        mapElement.innerHTML =
          "Map could not be loaded. You can still enter your area above.";
      }
      return;
    }

    map = L.map(mapElement).setView(
      [13.0827, 77.5877],
      11
    );

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ).addTo(map);

    map.on("click", event => {
      setMapLocation(
        event.latlng.lat,
        event.latlng.lng,
        true
      );
    });

    setTimeout(() => map.invalidateSize(), 300);
  }

  function setMapLocation(latitude, longitude, updateMessage = false) {
    selectedLatitude = latitude;
    selectedLongitude = longitude;

    const latInput = $("#latitudeInput");
    const lngInput = $("#longitudeInput");

    if (latInput) latInput.value = latitude;
    if (lngInput) lngInput.value = longitude;

    if (map) {
      const position = [latitude, longitude];

      if (mapMarker) {
        mapMarker.setLatLng(position);
      } else {
        mapMarker = L.marker(position).addTo(map);
      }

      map.setView(position, 16);
    }

    if (updateMessage) {
      const message = $("#locationMessage");

      if (message) {
        message.textContent = "Location selected on the map.";
      }
    }
  }

  /* -------------------- GPS LOCATION -------------------- */

  function initializeLocation() {
    $("#currentLocationButton")?.addEventListener(
      "click",
      getCurrentLocation
    );
  }

  function getCurrentLocation() {
    const message = $("#locationMessage");
    const button = $("#currentLocationButton");

    if (!navigator.geolocation) {
      if (message) message.textContent =
        "Your browser does not support location. Please enter your area manually.";
      return;
    }

    if (message) message.textContent =
      "Finding your precise location. Please keep location services turned on...";
    if (button) {
      button.disabled = true;
      button.textContent = "Locating...";
    }

    navigator.geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude, accuracy } = position.coords;

        // Store the actual GPS coordinates; the map pin uses these exact coordinates.
        setMapLocation(latitude, longitude);

        const accuracyText = Number.isFinite(accuracy)
          ? Math.round(accuracy)
          : null;

        if (message) {
          message.textContent = accuracyText !== null
            ? `GPS location detected (approximately ${accuracyText} m accuracy). Finding your street and area...`
            : "GPS location detected. Finding your street and area...";
        }

        try {
          const url = "https://nominatim.openstreetmap.org/reverse?" +
            new URLSearchParams({
              format: "jsonv2",
              lat: String(latitude),
              lon: String(longitude),
              zoom: "18",
              addressdetails: "1"
            });

          const response = await fetch(url, {
            headers: { "Accept": "application/json" }
          });

          if (response.ok) {
            const data = await response.json();
            const address = data.address || {};
            const parts = [
              address.road,
              address.residential,
              address.neighbourhood,
              address.suburb,
              address.village,
              address.town,
              address.city,
              address.county
            ].filter(Boolean);

            const uniqueParts = [...new Set(parts)];
            const accurateArea = uniqueParts.slice(0, 4).join(", ") ||
              data.display_name || "";

            if (accurateArea && $("#areaInput")) {
              $("#areaInput").value = accurateArea;
              $("#areaSuggestions").innerHTML = "";
            }
          }
        } catch {
          // The exact GPS coordinates and map pin remain saved if address lookup fails.
        }

        if (message) {
          message.textContent = accuracyText !== null
            ? `Location pinned successfully. GPS accuracy: approximately ${accuracyText} metres. Check the map pin and adjust it if needed.`
            : "Location pinned successfully. Check the map pin and adjust it if needed.";
        }

        if (button) {
          button.disabled = false;
          button.innerHTML = '<span aria-hidden="true">◎</span> Use My Current Location';
        }
      },
      error => {
        const messages = {
          1: "Location permission was denied. Allow location access for this site and enable Precise location.",
          2: "Your device could not determine its location. Turn on GPS/location services and try again.",
          3: "Location request timed out. Move near a window or outdoors and try again."
        };

        if (message) message.textContent =
          messages[error.code] || "Unable to get your location. Please try again.";

        if (button) {
          button.disabled = false;
          button.innerHTML = '<span aria-hidden="true">◎</span> Use My Current Location';
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  }

  /* -------------------- AREA AUTOCOMPLETE -------------------- */

  function initializeAreaAutocomplete() {
    const input = $("#areaInput");
    const suggestions = $("#areaSuggestions");

    if (!input || !suggestions) return;

    input.addEventListener("input", () => {
      clearTimeout(autocompleteTimer);

      const query = input.value.trim();

      if (query.length < 3) {
        suggestions.innerHTML = "";
        return;
      }

      autocompleteTimer = setTimeout(() => {
        searchAreaSuggestions(query);
      }, 450);
    });

    document.addEventListener("click", event => {
      if (
        !event.target.closest("#areaInput") &&
        !event.target.closest("#areaSuggestions")
      ) {
        suggestions.innerHTML = "";
      }
    });
  }

  async function searchAreaSuggestions(query) {
    const suggestions = $("#areaSuggestions");

    if (!suggestions) return;

    try {
      const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          format: "jsonv2",
          q: query,
          limit: "5",
          addressdetails: "1",
          countrycodes: "in"
        });

      const response = await fetch(url);
      if (!response.ok) return;

      const results = await response.json();

      suggestions.innerHTML = results.map((place, index) => `
        <button
          type="button"
          class="area-suggestion"
          data-index="${index}"
        >
          ${escapeHTML(place.display_name)}
        </button>
      `).join("");

      $$(".area-suggestion", suggestions).forEach(button => {
        button.addEventListener("click", () => {
          const place = results[Number(button.dataset.index)];

          $("#areaInput").value =
            place.display_name || "";

          suggestions.innerHTML = "";

          if (place.lat && place.lon) {
            setMapLocation(
              Number(place.lat),
              Number(place.lon)
            );
          }
        });
      });
    } catch {
      suggestions.innerHTML = "";
    }
  }

  /* -------------------- PHOTO PREVIEW -------------------- */

  function initializePhotoPreview() {
    const input = $("#photoInput");
    const preview = $("#photoPreview");

    if (!input || !preview) return;

    input.addEventListener("change", () => {
      preview.innerHTML = "";

      if (activePhotoURL) {
        URL.revokeObjectURL(activePhotoURL);
        activePhotoURL = null;
      }

      const file = input.files?.[0];

      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file.", "error");
        input.value = "";
        return;
      }

      activePhotoURL = URL.createObjectURL(file);

      preview.innerHTML = `
        <img
          src="${activePhotoURL}"
          alt="Selected feedback photo preview"
          class="preview-image"
        >
        <p>${escapeHTML(file.name)}</p>
      `;
    });
  }

  /* -------------------- SUBMIT FEEDBACK -------------------- */

  async function handleSuggestionSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');

    const photo = $("#photoInput")?.files?.[0];

    if (!photo) {
      showToast("Please upload a photo before submitting.", "error");
      return;
    }

    const formData = new FormData();

    formData.append(
      "name",
      $("#citizenName").value.trim()
    );

    formData.append(
      "category",
      $("#categoryInput").value
    );

    formData.append(
      "area",
      $("#areaInput").value.trim()
    );

    formData.append(
      "description",
      $("#descriptionInput").value.trim()
    );

    formData.append("photo", photo);

    formData.append(
      "latitude",
      $("#latitudeInput").value || ""
    );

    formData.append(
      "longitude",
      $("#longitudeInput").value || ""
    );

    setLoading(button, true, "Submitting feedback...");

    try {
      const result = await api("/api/suggestions", {
        method: "POST",
        body: formData
      });

      const trackingId =
        result.tracking_id ||
        result.trackingId ||
        result.id;

      if (!trackingId) {
        throw new Error(
          "Feedback was submitted, but no tracking ID was returned."
        );
      }

      pageContent.innerHTML = `
        <div class="app-panel success-panel">
          <div class="success-icon">✓</div>

          <h2>Feedback Submitted Successfully!</h2>

          <p>
            Thank you for helping improve your community.
            Your feedback has been recorded.
          </p>

          <div class="tracking-code">
            <span>Your Tracking ID</span>
            <strong id="successTrackingId">
              ${escapeHTML(trackingId)}
            </strong>

            <button
              type="button"
              class="secondary-button"
              id="copyTrackingId"
            >
              Copy Tracking ID
            </button>
          </div>

          <a
            class="primary-button"
            href="/track?id=${encodeURIComponent(trackingId)}"
          >
            Track Your Feedback
          </a>

          <a class="back-home-link" href="/">
            Back to Home
          </a>
        </div>
      `;

      $("#copyTrackingId")?.addEventListener("click", () => {
        copyText(trackingId);
      });

    } catch (error) {
      showToast(error.message, "error");
      setLoading(button, false);
    }
  }

  /* =========================================================
     TRACK FEEDBACK PAGE
     ========================================================= */

  function renderTrackPage() {
    if (!pageContent) return;

    pageContent.innerHTML = `
      <div class="app-panel tracking-panel">
        <div class="panel-heading">
          <h2>Track Your Feedback</h2>
          <p>
            Enter your tracking ID to check the latest progress.
          </p>
        </div>

        <form id="trackForm" class="app-form">
          <div class="form-field">
            <label for="trackingInput">Tracking ID</label>
            <input
              id="trackingInput"
              type="text"
              placeholder="Enter your tracking ID"
              required
            >
          </div>

          <button class="primary-button" type="submit">
            Track Application
          </button>
        </form>

        <div id="trackingResult" class="tracking-result"></div>
      </div>
    `;

    $("#trackForm")?.addEventListener("submit", event => {
      event.preventDefault();
      trackFeedback($("#trackingInput").value.trim());
    });

    const params = new URLSearchParams(window.location.search);
    const trackingId = params.get("id");

    if (trackingId) {
      $("#trackingInput").value = trackingId;
      trackFeedback(trackingId);
    }
  }

  async function trackFeedback(trackingId) {
    const resultElement = $("#trackingResult");

    if (!trackingId || !resultElement) return;

    resultElement.innerHTML = `
      <p class="loading-message">Searching for your feedback...</p>
    `;

    try {
      const data = await api(
        `/api/track/${encodeURIComponent(trackingId)}`
      );

      const item = data.item || data.suggestion || data;

      renderTrackingResult(item);

    } catch (error) {
      resultElement.innerHTML = `
        <div class="form-message error">
          ${escapeHTML(error.message)}
        </div>
      `;
    }
  }

  function renderTrackingResult(item) {
    const resultElement = $("#trackingResult");

    if (!resultElement) return;

    const status = item.status || "Submitted";
    const currentIndex = STATUSES.indexOf(status);

    const timeline = STATUSES.map((step, index) => {
      const completed = index <= currentIndex;

      return `
        <div class="timeline-item ${completed ? "completed" : ""}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <strong>${escapeHTML(step)}</strong>
            ${index === currentIndex
              ? "<span>Current Status</span>"
              : ""}
          </div>
        </div>
      `;
    }).join("");

    const photoURL = safeImageURL(
      item.photoUrl || item.photo_url || item.photo
    );

    const latitude = item.latitude;
    const longitude = item.longitude;

    resultElement.innerHTML = `
      <div class="tracking-card">

        <div class="tracking-card-header">
          <div>
            <span>Tracking ID</span>
            <strong>
              ${escapeHTML(item.tracking_id || item.trackingId || "")}
            </strong>
          </div>

          <span class="status-badge">
            ${escapeHTML(status)}
          </span>
        </div>

        <div class="tracking-details">
          <p>
            <strong>Category:</strong>
            ${escapeHTML(item.category || "Not specified")}
          </p>

          <p>
            <strong>Area:</strong>
            ${escapeHTML(item.area || "Not specified")}
          </p>

          <p>
            <strong>Description:</strong>
            ${escapeHTML(item.description || "Not available")}
          </p>

          <p>
            <strong>Submitted:</strong>
            ${escapeHTML(formatDate(item.created_at || item.createdAt))}
          </p>
        </div>

        ${photoURL ? `
          <div class="tracking-photo">
            <h3>Uploaded Photo</h3>
            <img
              src="${escapeHTML(photoURL)}"
              alt="Feedback attachment"
              loading="lazy"
            >
          </div>
        ` : ""}

        ${latitude && longitude ? `
          <p>
            <strong>Location:</strong>
            <a
              href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=17/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Map
            </a>
          </p>
        ` : ""}

        <div class="status-timeline">
          <h3>Feedback Progress</h3>
          ${timeline}
        </div>

        ${item.admin_response || item.adminResponse ? `
          <div class="admin-response">
            <h3>Admin Response</h3>
            <p>
              ${escapeHTML(item.admin_response || item.adminResponse)}
            </p>
          </div>
        ` : ""}

      </div>
    `;
  }

  /* =========================================================
     ADMIN DASHBOARD
     ========================================================= */

  function renderAdminPage() {
    if (!pageContent) return;

    pageContent.innerHTML = `
      <div class="app-panel dashboard-panel">

        <div class="dashboard-heading">
          <div>
            <h2>Admin Dashboard</h2>
            <p>Manage citizen feedback and update progress.</p>
          </div>

          <button
            type="button"
            id="adminLogoutButton"
            class="secondary-button"
          >
            Logout
          </button>
        </div>

        <div id="adminStats" class="stats-grid">
          <div class="stat-card">
            <span>Total Feedback</span>
            <strong>—</strong>
          </div>
          <div class="stat-card">
            <span>Submitted</span>
            <strong>—</strong>
          </div>
          <div class="stat-card">
            <span>In Progress</span>
            <strong>—</strong>
          </div>
          <div class="stat-card">
            <span>Resolved</span>
            <strong>—</strong>
          </div>
        </div>

        <div class="admin-toolbar">
          <input
            id="adminSearch"
            type="search"
            placeholder="Search by ID, area, category..."
          >

          <select id="adminStatusFilter">
            <option value="">All Statuses</option>
            ${STATUSES.map(status => `
              <option value="${escapeHTML(status)}">
                ${escapeHTML(status)}
              </option>
            `).join("")}
          </select>

          <button
            type="button"
            id="refreshAdmin"
            class="secondary-button"
          >
            Refresh
          </button>
        </div>

        <div id="adminTable" class="admin-table">
          <p class="loading-message">Loading feedback...</p>
        </div>
      </div>
    `;

    $("#adminLogoutButton")?.addEventListener("click", logout);
    $("#refreshAdmin")?.addEventListener("click", loadAdminItems);

    $("#adminSearch")?.addEventListener("input", renderAdminItems);
    $("#adminStatusFilter")?.addEventListener(
      "change",
      renderAdminItems
    );

    loadAdminItems();
  }

  async function loadAdminItems() {
    const table = $("#adminTable");

    if (table) {
      table.innerHTML =
        '<p class="loading-message">Loading feedback...</p>';
    }

    try {
      const data = await api("/api/admin/suggestions");

      adminItems = data.items || [];

      renderAdminStats(data.stats || {});
      renderAdminItems();

    } catch (error) {
      if (table) {
        table.innerHTML = `
          <div class="form-message error">
            ${escapeHTML(error.message)}
          </div>
        `;
      }
    }
  }

  function renderAdminStats(stats) {
    const container = $("#adminStats");

    if (!container) return;

    const total =
      stats.total ??
      stats.total_feedback ??
      adminItems.length;

    const submitted =
      stats.submitted ??
      adminItems.filter(item => item.status === "Submitted").length;

    const inProgress =
      stats.in_progress ??
      adminItems.filter(item => item.status === "In Progress").length;

    const resolved =
      stats.resolved ??
      adminItems.filter(item => item.status === "Resolved").length;

    container.innerHTML = `
      <div class="stat-card">
        <span>Total Feedback</span>
        <strong>${escapeHTML(total)}</strong>
      </div>

      <div class="stat-card">
        <span>Submitted</span>
        <strong>${escapeHTML(submitted)}</strong>
      </div>

      <div class="stat-card">
        <span>In Progress</span>
        <strong>${escapeHTML(inProgress)}</strong>
      </div>

      <div class="stat-card">
        <span>Resolved</span>
        <strong>${escapeHTML(resolved)}</strong>
      </div>
    `;
  }

  function renderAdminItems() {
    const container = $("#adminTable");

    if (!container) return;

    const query = ($("#adminSearch")?.value || "")
      .trim()
      .toLowerCase();

    const statusFilter =
      $("#adminStatusFilter")?.value || "";

    const filtered = adminItems.filter(item => {
      const searchable = [
        item.tracking_id,
        item.name,
        item.category,
        item.area,
        item.description
      ].join(" ").toLowerCase();

      return (
        searchable.includes(query) &&
        (!statusFilter || item.status === statusFilter)
      );
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No feedback found</h3>
          <p>There are no records matching your search.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const id = item.tracking_id || "";
      const photoURL = safeImageURL(
        item.photoUrl || item.photo_url || item.photo
      );

      return `
        <article class="admin-record" data-id="${escapeHTML(id)}">

          <div class="admin-record-header">
            <div>
              <strong>${escapeHTML(id)}</strong>
              <span>${escapeHTML(formatDate(item.created_at))}</span>
            </div>

            <span class="status-badge">
              ${escapeHTML(item.status || "Submitted")}
            </span>
          </div>

          <div class="admin-record-details">
            <p>
              <strong>Citizen:</strong>
              ${escapeHTML(item.name || "Anonymous")}
            </p>

            <p>
              <strong>Category:</strong>
              ${escapeHTML(item.category || "")}
            </p>

            <p>
              <strong>Area:</strong>
              ${escapeHTML(item.area || "")}
            </p>

            <p>
              <strong>Description:</strong>
              ${escapeHTML(item.description || "")}
            </p>
          </div>

          ${photoURL ? `
            <img
              class="admin-photo"
              src="${escapeHTML(photoURL)}"
              alt="Feedback attachment"
              loading="lazy"
            >
          ` : ""}

          <div class="admin-edit-fields">
            <label>
              Update Status
              <select class="admin-status">
                ${STATUSES.map(status => `
                  <option
                    value="${escapeHTML(status)}"
                    ${item.status === status ? "selected" : ""}
                  >
                    ${escapeHTML(status)}
                  </option>
                `).join("")}
              </select>
            </label>

            <label>
              Admin Response
              <textarea
                class="admin-response-input"
                rows="3"
                placeholder="Write a response to the citizen..."
              >${escapeHTML(item.admin_response || "")}</textarea>
            </label>
          </div>

          <div class="admin-actions">
            <button
              type="button"
              class="primary-button save-admin"
              data-id="${escapeHTML(id)}"
            >
              Save Update
            </button>

            <button
              type="button"
              class="danger-button delete-admin"
              data-id="${escapeHTML(id)}"
            >
              Delete
            </button>
          </div>

        </article>
      `;
    }).join("");

    $$(".save-admin", container).forEach(button => {
      button.addEventListener("click", () => {
        updateAdminItem(button.dataset.id, button);
      });
    });

    $$(".delete-admin", container).forEach(button => {
      button.addEventListener("click", () => {
        deleteAdminItem(button.dataset.id, button);
      });
    });
  }

  async function updateAdminItem(trackingId, button) {
    const record = button.closest(".admin-record");

    if (!record) return;

    const status = $(".admin-status", record).value;
    const admin_response =
      $(".admin-response-input", record).value.trim();

    setLoading(button, true, "Saving...");

    try {
      await api(
        `/api/admin/suggestions/${encodeURIComponent(trackingId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            admin_response
          })
        }
      );

      showToast("Feedback updated successfully.");
      await loadAdminItems();

    } catch (error) {
      showToast(error.message, "error");
      setLoading(button, false);
    }
  }

  async function deleteAdminItem(trackingId, button) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this feedback? This action cannot be undone."
    );

    if (!confirmed) return;

    setLoading(button, true, "Deleting...");

    try {
      await api(
        `/api/admin/suggestions/${encodeURIComponent(trackingId)}`,
        { method: "DELETE" }
      );

      showToast("Feedback deleted successfully.");
      await loadAdminItems();

    } catch (error) {
      showToast(error.message, "error");
      setLoading(button, false);
    }
  }

  /* -------------------- COPY TRACKING ID -------------------- */

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(String(value));
      showToast("Copied to clipboard.");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = String(value);
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
        showToast("Copied to clipboard.");
      } catch {
        showToast("Unable to copy. Please copy it manually.", "error");
      }

      textarea.remove();
    }
  }

  /* -------------------- PAGE INITIALIZATION -------------------- */

  async function initializePage() {
    initializeTheme();
    initializeNavigation();

    // Check the server session before rendering any protected form or dashboard.
    if (page === "submit" || page === "admin") {
      const session = await loadSession();

      if (page === "submit" &&
          !(session?.loggedIn && session.role === "citizen")) {
        navigate("/login?next=submit");
        return;
      }

      if (page === "admin" &&
          !(session?.loggedIn && session.role === "admin")) {
        navigate("/admin-login");
        return;
      }
    } else {
      loadSession();
    }

    switch (page) {
      case "register":
        renderRegisterPage();
        break;
      case "login":
        renderLoginPage();
        break;
      case "admin-login":
        renderAdminLoginPage();
        break;
      case "submit":
        renderSubmitPage();
        break;
      case "track":
        renderTrackPage();
        break;
      case "admin":
        renderAdminPage();
        break;
      case "home":
      default:
        break;
    }
  }



  initializePage();

  /* -------------------- JANASETU APP UPDATES -------------------- */

  function initializeAppUpdates() {
    if (!("serviceWorker" in navigator)) return;

    let updateRegistration = null;
    let waitingWorker = null;
    let updateInProgress = false;
    let updatePrompt = null;

    function showUpdatePrompt() {
      if (!waitingWorker || updatePrompt) return;

      const overlay = document.createElement("div");
      overlay.className = "janasetu-update-overlay";
      overlay.setAttribute("role", "presentation");

      const dialog = document.createElement("section");
      dialog.className = "janasetu-update-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "janasetuUpdateTitle");
      dialog.innerHTML = `
        <div class="janasetu-update-icon" aria-hidden="true">↻</div>
        <p class="janasetu-update-eyebrow">JANASETU UPDATE</p>
        <h2 id="janasetuUpdateTitle">A new version is ready!</h2>
        <p class="janasetu-update-message">
          We've made improvements to JANASETU. Update now to use the latest version.
        </p>
        <div class="janasetu-update-actions">
          <button type="button" class="janasetu-update-now">Update Now</button>
        </div>
        <p class="janasetu-update-footnote">Your account and submitted feedback will remain safe.</p>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      updatePrompt = overlay;

      const updateButton = dialog.querySelector(".janasetu-update-now");

      updateButton.addEventListener("click", () => {
        if (!waitingWorker) return;
        updateInProgress = true;
        updateButton.disabled = true;
        updateButton.textContent = "Updating...";
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      });

      updateButton.focus();
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (updateInProgress) {
        window.location.reload();
      }
    });

    window.addEventListener("load", async () => {
      try {
        updateRegistration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none"
        });

        const checkForUpdate = () => {
          if (updateRegistration && navigator.onLine) {
            updateRegistration.update().catch(() => {});
          }
        };

        const checkWaitingWorker = () => {
          if (updateRegistration && updateRegistration.waiting &&
              navigator.serviceWorker.controller) {
            waitingWorker = updateRegistration.waiting;
            showUpdatePrompt();
          }
        };

        updateRegistration.addEventListener("updatefound", () => {
          const installingWorker = updateRegistration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" &&
                navigator.serviceWorker.controller) {
              waitingWorker = updateRegistration.waiting || installingWorker;
              showUpdatePrompt();
            }
          });
        });

        checkWaitingWorker();
        checkForUpdate();

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            checkForUpdate();
            checkWaitingWorker();
          }
        });

        window.addEventListener("online", checkForUpdate);
        window.addEventListener("focus", checkForUpdate);

        // Recheck periodically while the app remains open.
        window.setInterval(checkForUpdate, 5 * 60 * 1000);
      } catch (error) {
        console.warn("JANASETU update check failed:", error);
      }
    });
  }

  initializeAppUpdates();

})();
