
/* =========================================================
   JANASETU - DIGITAL CITIZEN FEEDBACK SYSTEM
   Complete Frontend JavaScript
   Compatible with Flask app.py
   Web Application + Android APK
   ========================================================= */

"use strict";

const API = "/api";

let currentUser = null;
let currentRole = null;
let suggestionsCache = [];
let photoPreviewURL = null;

/* =========================================================
   1. GENERAL HELPERS
   ========================================================= */

async function api(url, options = {}) {
  const response = await fetch(API + url, {
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || "Something went wrong."
    );
  }

  return data;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function toast(message, type = "success") {
  let element = document.getElementById("toast");

  if (!element) {
    element = document.createElement("div");
    element.id = "toast";
    element.setAttribute("role", "status");
    document.body.appendChild(element);
  }

  element.textContent = message;
  element.className = "toast " + type;
  element.hidden = false;

  clearTimeout(element._toastTimer);

  element._toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3500);
}

function setPanel(html) {
  const panel = document.getElementById("panel");

  if (panel) {
    panel.innerHTML = html;
    panel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function shell(title, content) {
  setPanel(`
    <section class="app-panel">
      <h2>${escapeHTML(title)}</h2>
      ${content}
    </section>
  `);
}

function formField(label, name, type = "text", required = true) {
  return `
    <label class="form-field">
      <span>${escapeHTML(label)}</span>
      <input
        type="${type}"
        name="${name}"
        ${required ? "required" : ""}
        autocomplete="${type === "password" ? "current-password" : "on"}"
      >
    </label>
  `;
}

function passwordField(label, name) {
  return `
    <label class="form-field">
      <span>${escapeHTML(label)}</span>

      <div class="password-wrapper">
        <input
          type="password"
          name="${name}"
          required
          autocomplete="current-password"
        >

        <button
          type="button"
          class="password-toggle"
          aria-label="Show password"
          title="Show password"
        >👁</button>
      </div>
    </label>
  `;
}

function button(label, type = "submit") {
  return `
    <button class="primary-button" type="${type}">
      ${escapeHTML(label)}
    </button>
  `;
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value.replace(" ", "T") + "Z");

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN");
}

function getTrackingId(item) {
  return item.tracking_id || item.trackingId || "";
}

function getAdminResponse(item) {
  return item.admin_response || item.response || "";
}

/* =========================================================
   2. PHOTO PREVIEW
   ========================================================= */

function photoPreview(input, previewId) {
  const preview = document.getElementById(previewId);
  const file = input.files?.[0];

  if (!preview) return;

  if (photoPreviewURL) {
    URL.revokeObjectURL(photoPreviewURL);
    photoPreviewURL = null;
  }

  preview.innerHTML = "";

  if (!file) return;

  photoPreviewURL = URL.createObjectURL(file);

  const image = document.createElement("img");

  image.src = photoPreviewURL;
  image.alt = "Selected feedback photo";
  image.style.maxWidth = "100%";
  image.style.maxHeight = "240px";
  image.style.objectFit = "contain";

  preview.appendChild(image);
}

/* =========================================================
   3. HOME PAGE
   ========================================================= */

function showHome() {
  shell("Welcome to JanaSetu", `
    <section class="welcome-panel">

      <h2>Your Voice Matters</h2>

      <p>
        Share your suggestions and complaints.
        Help improve your community through JanaSetu.
      </p>

      <div class="home-actions">

        <button class="primary-button"
          onclick="showRegister()">
          Citizen Registration
        </button>

        <button class="primary-button"
          onclick="showLogin()">
          Citizen Login
        </button>

        <button class="secondary-button"
          onclick="showSubmitForm()">
          Submit Feedback
        </button>

        <button class="secondary-button"
          onclick="showTracking()">
          Track Feedback
        </button>

        <button class="secondary-button"
          onclick="showAdminLogin()">
          Admin Login
        </button>

      </div>

    </section>
  `);
}

/* =========================================================
   4. CITIZEN REGISTRATION
   ========================================================= */

function showRegister() {
  shell("Citizen Registration", `
    <form id="registerForm">

      ${formField(
        "Full Name (Optional)",
        "name",
        "text",
        false
      )}

      ${formField(
        "Email Address",
        "email",
        "email"
      )}

      ${passwordField(
        "Create Password (Minimum 8 Characters)",
        "password"
      )}

      ${button("Create Account")}

    </form>

    <p>
      Already registered?
      <a href="#" onclick="showLogin(); return false;">
        Login here
      </a>
    </p>
  `);
}

/* =========================================================
   5. CITIZEN LOGIN
   ========================================================= */

function showLogin() {
  shell("Citizen Login", `
    <form id="loginForm">

      ${formField(
        "Email Address",
        "email",
        "email"
      )}

      ${passwordField(
        "Password",
        "password"
      )}

      ${button("Login")}

    </form>

    <p>
      New citizen?
      <a href="#" onclick="showRegister(); return false;">
        Register here
      </a>
    </p>
  `);
}

/* =========================================================
   6. ADMIN LOGIN
   ========================================================= */

function showAdminLogin() {
  shell("Admin Login", `
    <form id="adminLoginForm">

      ${formField(
        "Admin Username",
        "username"
      )}

      ${passwordField(
        "Password",
        "password"
      )}

      ${button("Admin Login")}

    </form>
  `);
}

/* =========================================================
   7. PASSWORD SHOW / HIDE
   ========================================================= */

document.addEventListener("click", event => {
  const toggle = event.target.closest(".password-toggle");

  if (!toggle) return;

  const wrapper = toggle.parentElement;
  const input = wrapper.querySelector("input");

  if (!input) return;

  const visible = input.type === "password";

  input.type = visible ? "text" : "password";
  toggle.textContent = visible ? "🙈" : "👁";

  toggle.setAttribute(
    "aria-label",
    visible ? "Hide password" : "Show password"
  );
});

/* =========================================================
   8. AREA AUTOCOMPLETE
   ========================================================= */

const areas = [
  "Bengaluru",
  "Rajeshwari Nagar",
  "Madanayakanahalli",
  "Bagalagunte",
  "T Dasarahalli",
  "Chikkabanavara",
  "Anchepalya",
  "Lakshmipura",
  "Madhavara",
  "Yeshwanthpur",
  "Peenya",
  "Nagasandra",
  "Nelamangala",
  "Jalahalli",
  "Malleshwaram",
  "Vijayanagar",
  "Basaveshwaranagar",
  "Mandya",
  "Mysuru",
  "Tumakuru",
  "Ramanagara",
  "Kolar",
  "Chikkaballapur",
  "Davanagere",
  "Hassan",
  "Shivamogga",
  "Hubballi",
  "Belagavi",
  "Ballari"
];

function setupAreaAutocomplete() {
  const input = document.getElementById("areaInput");
  const list = document.getElementById("areaSuggestions");

  if (!input || !list) return;

  input.addEventListener("input", () => {
    const value = input.value.trim().toLowerCase();

    list.innerHTML = "";

    if (!value) {
      list.hidden = true;
      return;
    }

    const matches = areas.filter(area =>
      area.toLowerCase().includes(value)
    ).slice(0, 8);

    matches.forEach(area => {
      const item = document.createElement("button");

      item.type = "button";
      item.className = "area-suggestion";
      item.textContent = area;

      item.addEventListener("click", () => {
        input.value = area;
        list.hidden = true;
      });

      list.appendChild(item);
    });

    list.hidden = matches.length === 0;
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      list.hidden = true;
    }
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".area-autocomplete")) {
      list.hidden = true;
    }
  });
}

/* =========================================================
   9. GPS LOCATION AND MAP
   ========================================================= */

function setupLocation() {
  const locationButton =
    document.getElementById("getLocationButton");

  if (!locationButton) return;

  locationButton.addEventListener("click", () => {
    const message =
      document.getElementById("locationMessage");

    if (!navigator.geolocation) {
      if (message) {
        message.textContent =
          "Location is not supported by this device.";
      }

      return;
    }

    locationButton.disabled = true;
    locationButton.textContent = "Getting location...";

    navigator.geolocation.getCurrentPosition(
      async position => {

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        const latitudeInput =
          document.getElementById("latitudeInput");

        const longitudeInput =
          document.getElementById("longitudeInput");

        if (latitudeInput) latitudeInput.value = lat;
        if (longitudeInput) longitudeInput.value = lon;

        if (message) {
          message.textContent =
            "Location captured successfully.";
        }

        const map =
          document.getElementById("locationMap");

        if (map) {
          map.hidden = false;

          map.innerHTML = `
            <iframe
              title="Selected location map"
              width="100%"
              height="220"
              loading="lazy"
              style="border:0;border-radius:12px"
              src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}">
            </iframe>

            <a
              target="_blank"
              rel="noopener"
              href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}">
              Open Map
            </a>
          `;
        }

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          );

          if (response.ok) {
            const result = await response.json();
            const address = result.address || {};

            const area =
              address.suburb ||
              address.neighbourhood ||
              address.village ||
              address.town ||
              address.city ||
              address.county;

            const areaInput =
              document.getElementById("areaInput");

            if (area && areaInput && !areaInput.value.trim()) {
              areaInput.value = area;
            }
          }

        } catch (error) {
          console.log("Address lookup unavailable:", error);
        }

        locationButton.disabled = false;
        locationButton.textContent =
          "Use My Current Location";

      },

      error => {
        if (message) {
          message.textContent =
            "Unable to get location. Please allow location permission or enter your area manually.";
        }

        locationButton.disabled = false;
        locationButton.textContent =
          "Use My Current Location";
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

/* =========================================================
   10. SUBMIT FEEDBACK FORM
   ========================================================= */

function showSubmitForm() {

  if (currentRole !== "citizen") {
    toast("Please login as a citizen first.", "error");
    showLogin();
    return;
  }

  shell("Submit Feedback", `

    <form id="suggestionForm">

      <label class="form-field">
        <span>Feedback Category</span>

        <select name="category" required>
          <option value="">Select Category</option>
          <option>Road and Infrastructure</option>
          <option>Water Supply</option>
          <option>Street Lights</option>
          <option>Sanitation and Cleanliness</option>
          <option>Drainage</option>
          <option>Public Safety</option>
          <option>Waste Management</option>
          <option>Public Facilities</option>
          <option>Other</option>
        </select>
      </label>

      <div class="area-autocomplete form-field">

        <span>Area / Location</span>

        <input
          id="areaInput"
          name="area"
          placeholder="Enter your area"
          autocomplete="off"
          required
        >

        <div
          id="areaSuggestions"
          class="area-suggestions"
          hidden>
        </div>

      </div>

      <div class="location-controls">

        <button
          type="button"
          id="getLocationButton"
          class="secondary-button">
          Use My Current Location
        </button>

        <p id="locationMessage"></p>

        <div
          id="locationMap"
          class="location-map"
          hidden>
        </div>

      </div>

      <input
        type="hidden"
        name="latitude"
        id="latitudeInput"
      >

      <input
        type="hidden"
        name="longitude"
        id="longitudeInput"
      >

      <label class="form-field">
        <span>Describe Your Feedback</span>

        <textarea
          name="description"
          rows="5"
          placeholder="Explain the issue or suggestion..."
          required>
        </textarea>
      </label>

      <label class="form-field">
        <span>Upload Photo (Required)</span>

        <input
          type="file"
          id="photoInput"
          name="photo"
          accept="image/*"
          required
        >
      </label>

      <div
        id="photoPreview"
        class="photo-preview">
      </div>

      ${button("Submit Feedback")}

    </form>
  `);

  setupAreaAutocomplete();
  setupLocation();

  document.getElementById("photoInput")
    ?.addEventListener("change", event => {
      photoPreview(event.target, "photoPreview");
    });
}

/* =========================================================
   11. FEEDBACK TRACKING
   ========================================================= */

function showTracking() {

  shell("Track Your Feedback", `

    <form id="trackingForm">

      ${formField(
        "Enter Your Tracking ID",
        "trackingId"
      )}

      ${button("Track Feedback")}

    </form>

    <div id="trackingResult"></div>

  `);
}

async function trackFeedback(trackingId) {

  const result =
    document.getElementById("trackingResult");

  if (!result) return;

  if (!trackingId || !trackingId.trim()) {
    result.innerHTML =
      "<p>Please enter a tracking ID.</p>";
    return;
  }

  result.innerHTML =
    "<p>Loading feedback details...</p>";

  try {

    const data = await api(
      "/track/" + encodeURIComponent(trackingId.trim())
    );

    const item = data.suggestion || data;

    const statuses = [
      "Submitted",
      "Under Review",
      "In Progress",
      "Resolved"
    ];

    const currentIndex =
      statuses.indexOf(item.status);

    const response = getAdminResponse(item);

    result.innerHTML = `

      <div class="tracking-card">

        <h3>Feedback Details</h3>

        <p>
          <strong>Tracking ID:</strong>
          ${escapeHTML(getTrackingId(item) || trackingId)}
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
          <strong>Status:</strong>
          ${escapeHTML(item.status || "Submitted")}
        </p>

        <p>
          <strong>Description:</strong>
          ${escapeHTML(item.description || "")}
        </p>

        <p>
          <strong>Submitted:</strong>
          ${escapeHTML(formatDate(item.created_at))}
        </p>

        <div class="status-timeline">

          ${statuses.map((status, index) => `
            <div class="timeline-step ${
              index <= currentIndex ? "active" : ""
            }">
              ${escapeHTML(status)}
            </div>
          `).join("")}

        </div>

        ${response ? `
          <div class="admin-response">
            <strong>Admin Response</strong>
            <p>${escapeHTML(response)}</p>
          </div>
        ` : ""}

        ${item.photoUrl ? `
          <div class="tracking-photo">
            <img
              src="${escapeHTML(item.photoUrl)}"
              alt="Uploaded feedback photo"
              loading="lazy"
            >
          </div>
        ` : ""}

      </div>

    `;

  } catch (error) {

    result.innerHTML = `
      <p class="error-message">
        ${escapeHTML(error.message)}
      </p>
    `;
  }
}

/* =========================================================
   12. ADMIN DASHBOARD
   ========================================================= */

async function showAdminDashboard() {

  currentRole = "admin";

  shell("Admin Dashboard", `

    <div class="admin-toolbar">

      <input
        id="adminSearch"
        placeholder="Search feedback..."
      >

      <select id="statusFilter">
        <option value="">All Statuses</option>
        <option>Submitted</option>
        <option>Under Review</option>
        <option>In Progress</option>
        <option>Resolved</option>
      </select>

      <button
        class="secondary-button"
        type="button"
        onclick="loadAdminDashboard()">
        Refresh
      </button>

    </div>

    <div
      id="adminStats"
      class="admin-stats">
    </div>

    <div id="adminList">
      Loading feedback...
    </div>

    <button
      class="secondary-button"
      type="button"
      onclick="logout()">
      Logout
    </button>

  `);

  document.getElementById("adminSearch")
    ?.addEventListener("input", renderAdminList);

  document.getElementById("statusFilter")
    ?.addEventListener("change", renderAdminList);

  await loadAdminDashboard();
}

async function loadAdminDashboard() {

  try {

    const data = await api("/admin/suggestions");

    suggestionsCache =
      data.items || data.suggestions || [];

    const stats = data.stats || {};

    const statsBox =
      document.getElementById("adminStats");

    if (statsBox) {

      statsBox.innerHTML = `

        <div class="stat-card">
          <strong>${stats.Total ?? stats.total ?? suggestionsCache.length}</strong>
          <span>Total</span>
        </div>

        <div class="stat-card">
          <strong>${stats.Submitted ?? stats.submitted ?? 0}</strong>
          <span>Submitted</span>
        </div>

        <div class="stat-card">
          <strong>${stats["Under Review"] ?? stats.underReview ?? 0}</strong>
          <span>Under Review</span>
        </div>

        <div class="stat-card">
          <strong>${stats["In Progress"] ?? stats.inProgress ?? 0}</strong>
          <span>In Progress</span>
        </div>

        <div class="stat-card">
          <strong>${stats.Resolved ?? stats.resolved ?? 0}</strong>
          <span>Resolved</span>
        </div>

      `;
    }

    renderAdminList();

  } catch (error) {

    const list =
      document.getElementById("adminList");

    if (list) {
      list.innerHTML = `
        <p class="error-message">
          ${escapeHTML(error.message)}
        </p>
      `;
    }
  }
}

/* =========================================================
   13. ADMIN SEARCH AND FILTER
   ========================================================= */

function renderAdminList() {

  const list =
    document.getElementById("adminList");

  if (!list) return;

  const search = (
    document.getElementById("adminSearch")?.value || ""
  ).toLowerCase();

  const filter =
    document.getElementById("statusFilter")?.value || "";

  const items = suggestionsCache.filter(item => {

    const text = [
      getTrackingId(item),
      item.name,
      item.category,
      item.area,
      item.description,
      item.status
    ].join(" ").toLowerCase();

    return (
      text.includes(search) &&
      (!filter || item.status === filter)
    );
  });

  if (!items.length) {
    list.innerHTML = "<p>No feedback found.</p>";
    return;
  }

  list.innerHTML = items.map(item => {

    const trackingId = getTrackingId(item);
    const safeId = escapeHTML(trackingId);

    return `

      <article class="admin-card">

        <h3>${escapeHTML(item.category || "Feedback")}</h3>

        <p>
          <strong>Tracking ID:</strong>
          ${safeId}
        </p>

        <p>
          <strong>Citizen:</strong>
          ${escapeHTML(item.name || "Citizen")}
        </p>

        <p>
          <strong>Area:</strong>
          ${escapeHTML(item.area || "")}
        </p>

        <p>
          <strong>Description:</strong>
          ${escapeHTML(item.description || "")}
        </p>

        <p>
          <strong>Submitted:</strong>
          ${escapeHTML(formatDate(item.created_at))}
        </p>

        ${item.latitude != null && item.longitude != null ? `
          <p>
            <a
              target="_blank"
              rel="noopener"
              href="https://www.openstreetmap.org/?mlat=${Number(item.latitude)}&mlon=${Number(item.longitude)}">
              View Submitted Location
            </a>
          </p>
        ` : ""}

        ${item.photoUrl ? `
          <div class="admin-photo">
            <img
              src="${escapeHTML(item.photoUrl)}"
              alt="Feedback photo"
              loading="lazy"
            >
          </div>
        ` : ""}

        <label class="form-field">
          <span>Update Status</span>

          <select id="status-${safeId}">
            ${[
              "Submitted",
              "Under Review",
              "In Progress",
              "Resolved"
            ].map(status => `
              <option
                value="${status}"
                ${item.status === status ? "selected" : ""}>
                ${status}
              </option>
            `).join("")}
          </select>
        </label>

        <label class="form-field">
          <span>Admin Response</span>

          <textarea
            id="response-${safeId}"
            rows="3"
            placeholder="Enter response to citizen..."
          >${escapeHTML(getAdminResponse(item))}</textarea>
        </label>

        <div class="admin-actions">

          <button
            class="primary-button"
            type="button"
            onclick="updateFeedback('${safeId}')">
            Save Changes
          </button>

          <button
            class="danger-button"
            type="button"
            onclick="deleteFeedback('${safeId}')">
            Delete
          </button>

        </div>

      </article>

    `;
  }).join("");
}

/* =========================================================
   14. ADMIN UPDATE FEEDBACK
   ========================================================= */

async function updateFeedback(trackingId) {

  const status =
    document.getElementById("status-" + trackingId)?.value;

  const response =
    document.getElementById("response-" + trackingId)?.value || "";

  try {

    await api(
      "/admin/suggestions/" + encodeURIComponent(trackingId),
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          status: status,
          admin_response: response
        })
      }
    );

    toast("Feedback updated successfully.");

    await loadAdminDashboard();

  } catch (error) {

    toast(error.message, "error");
  }
}

/* =========================================================
   15. ADMIN DELETE FEEDBACK
   ========================================================= */

async function deleteFeedback(trackingId) {

  const confirmed = confirm(
    "Are you sure you want to delete this feedback?"
  );

  if (!confirmed) return;

  try {

    await api(
      "/admin/suggestions/" + encodeURIComponent(trackingId),
      {
        method: "DELETE"
      }
    );

    toast("Feedback deleted successfully.");

    await loadAdminDashboard();

  } catch (error) {

    toast(error.message, "error");
  }
}

/* =========================================================
   16. CITIZEN DASHBOARD
   ========================================================= */

function showCitizenDashboard() {

  shell("Citizen Dashboard", `

    <div class="welcome-panel">

      <h2>Welcome to JanaSetu</h2>

      <p>
        Your feedback can help improve your community.
      </p>

      <div class="home-actions">

        <button
          class="primary-button"
          onclick="showSubmitForm()">
          Submit Feedback
        </button>

        <button
          class="secondary-button"
          onclick="showTracking()">
          Track Feedback
        </button>

        <button
          class="secondary-button"
          onclick="logout()">
          Logout
        </button>

      </div>

    </div>

  `);
}

/* =========================================================
   17. LOGOUT
   ========================================================= */

async function logout() {

  try {

    await api("/logout", {
      method: "POST"
    });

  } catch (error) {
    console.log("Logout:", error);
  }

  currentUser = null;
  currentRole = null;
  suggestionsCache = [];

  toast("Logged out successfully.");

  showHome();
}

/* =========================================================
   18. HAMBURGER MENU AND NAVIGATION
   ========================================================= */

function closeMenu() {

  const toggle =
    document.getElementById("menuToggle");

  const menu =
    document.getElementById("navMenu");

  if (menu) menu.classList.remove("active");

  if (toggle) {
    toggle.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
  }
}

document.addEventListener("DOMContentLoaded", () => {

  const toggle =
    document.getElementById("menuToggle");

  const menu =
    document.getElementById("navMenu");

  if (toggle && menu) {

    toggle.addEventListener("click", event => {

      event.stopPropagation();

      const isOpen = menu.classList.toggle("active");

      toggle.classList.toggle("active", isOpen);

      toggle.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    });

    document.addEventListener("click", event => {

      if (
        !menu.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", event => {

      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  // Navigation buttons in the HTML.
  document.addEventListener("click", event => {

    const navButton = event.target.closest("[data-view]");

    if (!navButton) return;

    const view = navButton.dataset.view;

    closeMenu();

    switch (view) {

      case "home":
        showHome();
        break;

      case "submit":
        showSubmitForm();
        break;

      case "track":
        showTracking();
        break;

      case "login":
        showLogin();
        break;

      case "register":
        showRegister();
        break;

      case "admin-login":
        showAdminLogin();
        break;

      case "dashboard":
        if (currentRole === "admin") {
          showAdminDashboard();
        } else if (currentRole === "citizen") {
          showCitizenDashboard();
        } else {
          showLogin();
        }
        break;
    }
  });

  /* =======================================================
     19. LIGHT / DARK THEME
     ======================================================= */

  const themeSelect =
    document.getElementById("themeSelect");

  const savedTheme =
    localStorage.getItem("janasetu-theme") || "light";

  document.documentElement.dataset.theme = savedTheme;

  if (themeSelect) {

    themeSelect.value = savedTheme;

    themeSelect.addEventListener("change", () => {

      const theme = themeSelect.value;

      document.documentElement.dataset.theme = theme;

      localStorage.setItem("janasetu-theme", theme);
    });
  }

  /* =======================================================
     20. INITIAL PAGE AND SESSION
     ======================================================= */

  showHome();

  api("/session")
    .then(data => {

      if (!data.loggedIn) return;

      currentUser = data.user || null;
      currentRole = data.role || null;

      if (currentRole === "admin") {
        showAdminDashboard();
      } else if (currentRole === "citizen") {
        showCitizenDashboard();
      }
    })
    .catch(error => {
      console.log("Session check:", error);
    });

});

/* =========================================================
   21. FORM SUBMISSIONS
   ========================================================= */

document.addEventListener("submit", async event => {

  const form = event.target;

  if (!form.matches("form")) return;

  event.preventDefault();

  const submitButton =
    form.querySelector('[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {

    /* ---------------- REGISTRATION ---------------- */

    if (form.id === "registerForm") {

      const values =
        Object.fromEntries(new FormData(form));

      const data = await api("/register", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(values)
      });

      currentRole = "citizen";
      currentUser = data;

      toast("Registration successful!");

      showCitizenDashboard();
    }

    /* ---------------- CITIZEN LOGIN ---------------- */

    else if (form.id === "loginForm") {

      const values =
        Object.fromEntries(new FormData(form));

      const data = await api("/login", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(values)
      });

      currentUser = data.user || null;
      currentRole = "citizen";

      toast("Login successful!");

      showCitizenDashboard();
    }

    /* ---------------- ADMIN LOGIN ---------------- */

    else if (form.id === "adminLoginForm") {

      const values =
        Object.fromEntries(new FormData(form));

      const data = await api("/admin-login", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(values)
      });

      currentUser = data;
      currentRole = "admin";

      toast("Admin login successful!");

      await showAdminDashboard();
    }

    /* ---------------- SUBMIT FEEDBACK ---------------- */

    else if (form.id === "suggestionForm") {

      const photoInput =
        document.getElementById("photoInput");

      const photo = photoInput?.files?.[0];

      if (!photo) {

        toast("Please upload a photo.", "error");

        return;
      }

      const formData = new FormData(form);

      const data = await api("/suggestions", {

        method: "POST",

        body: formData
      });

      const trackingId = data.trackingId;

      toast("Feedback submitted successfully!");

      shell("Feedback Submitted Successfully!", `

        <div class="success-panel">

          <h3>Your feedback has been received.</h3>

          <p>
            Keep your Tracking ID safe to check the progress
            of your feedback.
          </p>

          <div class="tracking-id-display">
            <strong>${escapeHTML(trackingId)}</strong>
          </div>

          <button
            class="primary-button"
            type="button"
            onclick="copyTrackingId('${escapeHTML(trackingId)}')">
            Copy Tracking ID
          </button>

          <button
            class="secondary-button"
            type="button"
            onclick="showTracking()">
            Track Feedback
          </button>

          <button
            class="secondary-button"
            type="button"
            onclick="showCitizenDashboard()">
            Citizen Dashboard
          </button>

        </div>

      `);
    }

    /* ---------------- TRACK FEEDBACK ---------------- */

    else if (form.id === "trackingForm") {

      const trackingId =
        new FormData(form).get("trackingId");

      await trackFeedback(trackingId);
    }

  } catch (error) {

    toast(error.message, "error");

  } finally {

    if (submitButton && submitButton.isConnected) {
      submitButton.disabled = false;
    }
  }
});

/* =========================================================
   22. COPY TRACKING ID
   ========================================================= */

async function copyTrackingId(trackingId) {

  try {

    await navigator.clipboard.writeText(trackingId);

    toast("Tracking ID copied successfully!");

  } catch (error) {

    const temporaryInput =
      document.createElement("textarea");

    temporaryInput.value = trackingId;

    document.body.appendChild(temporaryInput);

    temporaryInput.select();

    document.execCommand("copy");

    temporaryInput.remove();

    toast("Tracking ID copied!");
  }
}

/* =========================================================
   23. SERVICE WORKER
   ========================================================= */

if ("serviceWorker" in navigator) {

  window.addEventListener("load", () => {

    navigator.serviceWorker.register("/sw.js")
      .catch(error => {

        console.log(
          "Service worker registration failed:",
          error
        );

      });

  });
}

/* =========================================================
   END OF JANASETU JAVASCRIPT
   ========================================================= */
