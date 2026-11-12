
/* =========================================================
   JANASETU - DIGITAL CITIZEN FEEDBACK SYSTEM
   Complete Frontend JavaScript
   ========================================================= */

const API = "/api";

let currentUser = null;
let currentRole = null;
let selectedPhoto = null;
let suggestionsCache = [];

/* ==================== HELPERS ==================== */

async function api(url, options = {}) {
    const response = await fetch(API + url, {
        credentials: "same-origin",
        ...options
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.error || data.message || "Something went wrong.");
    }

    return data;
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

function toast(message, type = "success") {
    const element = document.getElementById("toast");

    if (!element) return;

    element.textContent = message;
    element.className = "toast show " + type;

    clearTimeout(window.janasetuToastTimer);

    window.janasetuToastTimer = setTimeout(() => {
        element.className = "toast";
    }, 3500);
}

function setPanel(html) {
    const panel = document.getElementById("panel");

    if (!panel) return;

    panel.innerHTML = html;
    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function shell(title, description = "", content = "") {
    return `
        <section class="app-panel">

            <h2>${escapeHTML(title)}</h2>

            ${description ? `<p>${escapeHTML(description)}</p>` : ""}

            ${content}

        </section>
    `;
}

function button(text, action = "", extraClass = "") {
    return `
        <button
            type="button"
            class="primary-button ${extraClass}"
            ${action ? `data-action="${escapeHTML(action)}"` : ""}
        >
            ${escapeHTML(text)}
        </button>
    `;
}

function formField(label, name, type = "text", placeholder = "", required = true) {
    return `
        <div class="form-group">

            <label for="${escapeHTML(name)}">
                ${escapeHTML(label)}
            </label>

            <input
                type="${escapeHTML(type)}"
                id="${escapeHTML(name)}"
                name="${escapeHTML(name)}"
                placeholder="${escapeHTML(placeholder)}"
                ${required ? "required" : ""}
            >

        </div>
    `;
}

function passwordField(label, name, placeholder = "Enter password") {
    return `
        <div class="form-group">

            <label for="${escapeHTML(name)}">
                ${escapeHTML(label)}
            </label>

            <div class="password-wrapper">

                <input
                    type="password"
                    id="${escapeHTML(name)}"
                    name="${escapeHTML(name)}"
                    placeholder="${escapeHTML(placeholder)}"
                    required
                >

                <button
                    type="button"
                    class="password-toggle"
                    data-password="${escapeHTML(name)}"
                >
                    Show
                </button>

            </div>

        </div>
    `;
}

function imageURL(photo) {
    if (!photo) return "";

    const value = String(photo);

    if (value.startsWith("http://") || value.startsWith("https://")) {
        return value;
    }

    if (value.startsWith("/")) {
        return value;
    }

    return "/static/uploads/" + encodeURIComponent(value);
}

function photoPreview(file, container) {
    if (!file || !container) return;

    const reader = new FileReader();

    reader.onload = event => {
        container.innerHTML = `
            <img
                src="${event.target.result}"
                class="photo-preview"
                alt="Selected photo preview"
            >
        `;
    };

    reader.readAsDataURL(file);
}

function statusClass(status) {
    return "status-" + String(status || "submitted")
        .toLowerCase()
        .replace(/\s+/g, "-");
}

/* ==================== NAVIGATION ==================== */

function closeMobileMenu() {
    const menu = document.getElementById("navMenu");
    const toggle = document.getElementById("menuToggle");

    if (menu) menu.classList.remove("active");

    if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function showHome() {
    const home = document.getElementById("home");

    if (home) {
        home.style.display = "block";
    }

    setPanel("");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function showView(view) {
    closeMobileMenu();

    const home = document.getElementById("home");

    if (home) {
        home.style.display = view === "home" ? "block" : "none";
    }

    switch (view) {
        case "home":
            showHome();
            break;

        case "submit":
            showFeedbackForm();
            break;

        case "track":
            showTrackingForm();
            break;

        case "login":
            showLogin();
            break;

        case "admin-login":
            showAdminLogin();
            break;

        default:
            showHome();
    }
}

/* ==================== HOME ==================== */

function showCitizenDashboard() {
    setPanel(shell(
        "Citizen Dashboard",
        "Welcome to your JanaSetu account.",
        `
            <div class="home-actions">

                ${button("Submit Feedback", "submit")}

                ${button("Track Feedback", "track", "secondary-button")}

                <button
                    type="button"
                    class="secondary-button"
                    data-action="my-feedback"
                >
                    My Submissions
                </button>

                <button
                    type="button"
                    class="danger-button"
                    data-action="logout"
                >
                    Logout
                </button>

            </div>

            <div id="myFeedback" style="margin-top:25px;"></div>
        `
    ));
}

function showMyFeedback() {
    const container = document.getElementById("myFeedback");

    if (!container) return;

    container.innerHTML = `<p>Loading your submissions...</p>`;

    loadMyFeedback(container);
}

async function loadMyFeedback(container) {
    try {
        const data = await api("/admin/suggestions");
        const records = data.suggestions || data.records || data.items || [];

        const mine = records.filter(item =>
            String(item.user_id) === String(currentUser?.id)
        );

        if (!mine.length) {
            container.innerHTML = `
                <div class="empty-state">
                    You have not submitted any feedback yet.
                </div>
            `;
            return;
        }

        container.innerHTML = mine.map(item => `
            <div class="tracking-card">

                <h3>${escapeHTML(item.category)}</h3>

                <p>
                    Tracking ID:
                    <strong>${escapeHTML(item.tracking_id || item.trackingId)}</strong>
                </p>

                <p>Status:
                    <span class="status-badge ${statusClass(item.status)}">
                        ${escapeHTML(item.status)}
                    </span>
                </p>

            </div>
        `).join("");

    } catch (error) {
        container.innerHTML = `
            <div class="error-message">
                Unable to load submissions.
            </div>
        `;
    }
}

/* ==================== REGISTER ==================== */

function showRegister() {
    setPanel(shell(
        "Create Citizen Account",
        "Register to submit and track your feedback.",
        `
            <form id="registerForm">

                ${formField(
                    "Full Name (Optional)",
                    "name",
                    "text",
                    "Enter your name",
                    false
                )}

                ${formField(
                    "Email Address",
                    "email",
                    "email",
                    "Enter your email"
                )}

                ${passwordField("Password", "password")}

                ${passwordField("Confirm Password", "confirmPassword")}

                <div class="form-actions">
                    <button type="submit" class="primary-button">
                        Create Account
                    </button>
                </div>

            </form>

            <div class="auth-links">
                <span>Already registered?</span>
                <span class="text-link" data-view="login">
                    Login here
                </span>
            </div>
        `
    ));
}

/* ==================== CITIZEN LOGIN ==================== */

function showLogin() {
    setPanel(shell(
        "Citizen Login",
        "Login to access your JanaSetu account.",
        `
            <form id="loginForm">

                ${formField(
                    "Email Address",
                    "email",
                    "email",
                    "Enter registered email"
                )}

                ${passwordField("Password", "password")}

                <div class="form-actions">

                    <button type="submit" class="primary-button">
                        Login
                    </button>

                </div>

            </form>

            <div class="auth-links">
                <span>New citizen?</span>

                <span class="text-link" data-action="register">
                    Create an account
                </span>
            </div>
        `
    ));
}

/* ==================== ADMIN LOGIN ==================== */

function showAdminLogin() {
    setPanel(shell(
        "Admin Login",
        "Authorized administration access only.",
        `
            <form id="adminLoginForm">

                ${formField(
                    "Admin Username",
                    "username",
                    "text",
                    "Enter admin username"
                )}

                ${passwordField("Admin Password", "password")}

                <div class="form-actions">

                    <button type="submit" class="primary-button">
                        Admin Login
                    </button>

                </div>

            </form>
        `
    ));
}

/* ==================== AREA SUGGESTIONS ==================== */

const areas = [
    "Anchepalya",
    "Bagalagunte",
    "Chikkabanavara",
    "Dasarahalli",
    "Hesaraghatta",
    "Jalahalli",
    "Lakshmipura",
    "Madanayakanahalli",
    "Madhavara",
    "Nagasandra",
    "Nelamangala",
    "Peenya",
    "Rajanukunte",
    "T. Dasarahalli",
    "Tumkur Road",
    "Yeshwanthpur"
];

function showAreaSuggestions(value) {
    const list = document.getElementById("areaSuggestions");

    if (!list) return;

    const search = value.trim().toLowerCase();

    if (!search) {
        list.innerHTML = "";
        return;
    }

    const matches = areas.filter(area =>
        area.toLowerCase().includes(search)
    );

    list.innerHTML = matches.map(area => `
        <div
            class="autocomplete-item"
            data-area="${escapeHTML(area)}"
        >
            ${escapeHTML(area)}
        </div>
    `).join("");
}

/* ==================== GPS LOCATION ==================== */

async function getCurrentLocation() {
    if (!navigator.geolocation) {
        toast("Location is not supported by this device.", "error");
        return;
    }

    toast("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
        async position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            const latitudeInput = document.getElementById("latitude");
            const longitudeInput = document.getElementById("longitude");
            const locationStatus = document.getElementById("locationStatus");
            const map = document.getElementById("mapPreview");

            if (latitudeInput) latitudeInput.value = latitude;
            if (longitudeInput) longitudeInput.value = longitude;

            if (locationStatus) {
                locationStatus.textContent = "Location captured successfully.";
            }

            if (map) {
                map.innerHTML = `
                    <iframe
                        src="https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}"
                        loading="lazy"
                        title="Your location map"
                    ></iframe>
                `;
            }

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
                );

                const data = await response.json();

                const areaInput = document.getElementById("area");

                if (areaInput && data.address) {
                    const address = data.address;

                    const location =
                        address.suburb ||
                        address.neighbourhood ||
                        address.village ||
                        address.town ||
                        address.city ||
                        "";

                    if (location) {
                        areaInput.value = location;
                    }
                }

            } catch (error) {
                console.log("Address lookup unavailable.");
            }

            toast("Location captured successfully.");
        },

        error => {
            let message = "Unable to get location.";

            if (error.code === 1) {
                message = "Please allow location permission.";
            }

            if (error.code === 2) {
                message = "Location is currently unavailable.";
            }

            if (error.code === 3) {
                message = "Location request timed out.";
            }

            toast(message, "error");
        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

/* ==================== FEEDBACK FORM ==================== */

function showFeedbackForm() {
    selectedPhoto = null;

    setPanel(shell(
        "Submit Citizen Feedback",
        "Share a suggestion or report a problem in your community.",
        `
            <form id="feedbackForm">

                ${formField(
                    "Your Name (Optional)",
                    "citizenName",
                    "text",
                    "Enter your name",
                    false
                )}

                <div class="form-group">

                    <label for="category">Feedback Category *</label>

                    <select id="category" name="category" required>

                        <option value="">Select Category</option>

                        <option value="Roads and Infrastructure">
                            Roads and Infrastructure
                        </option>

                        <option value="Water Supply">
                            Water Supply
                        </option>

                        <option value="Sanitation and Cleanliness">
                            Sanitation and Cleanliness
                        </option>

                        <option value="Street Lights">
                            Street Lights
                        </option>

                        <option value="Drainage">
                            Drainage
                        </option>

                        <option value="Waste Management">
                            Waste Management
                        </option>

                        <option value="Public Facilities">
                            Public Facilities
                        </option>

                        <option value="Public Safety">
                            Public Safety
                        </option>

                        <option value="Other">
                            Other
                        </option>

                    </select>

                </div>

                <div class="form-group autocomplete-wrapper">

                    <label for="area">Area / Location *</label>

                    <input
                        type="text"
                        id="area"
                        name="area"
                        placeholder="Enter your area"
                        autocomplete="off"
                        required
                    >

                    <div
                        class="autocomplete-list"
                        id="areaSuggestions"
                    ></div>

                </div>

                <div class="form-group">

                    <label>GPS Location (Optional)</label>

                    <div class="location-row">

                        <button
                            type="button"
                            class="location-button"
                            id="getLocation"
                        >
                            📍 Get Current Location
                        </button>

                        <span id="locationStatus" class="form-help"></span>

                    </div>

                    <input
                        type="hidden"
                        id="latitude"
                        name="latitude"
                    >

                    <input
                        type="hidden"
                        id="longitude"
                        name="longitude"
                    >

                    <div class="map-preview" id="mapPreview">
                        <div class="empty-state">
                            Your location map will appear here.
                        </div>
                    </div>

                </div>

                <div class="form-group">

                    <label for="description">
                        Describe Your Feedback *
                    </label>

                    <textarea
                        id="description"
                        name="description"
                        placeholder="Explain the problem or suggestion clearly..."
                        required
                        minlength="5"
                    ></textarea>

                </div>

                <div class="form-group">

                    <label for="photo">
                        Upload Supporting Photo *
                    </label>

                    <input
                        type="file"
                        id="photo"
                        name="photo"
                        accept="image/*"
                        required
                    >

                    <p class="form-help">
                        Select an image showing the issue or suggestion.
                    </p>

                    <div id="photoPreview"></div>

                </div>

                <div class="form-actions">

                    <button type="submit" class="primary-button">
                        Submit Feedback
                    </button>

                    <button
                        type="reset"
                        class="secondary-button"
                    >
                        Clear Form
                    </button>

                </div>

            </form>
        `
    ));
}

/* ==================== TRACKING FORM ==================== */

function showTrackingForm() {
    setPanel(shell(
        "Track Your Feedback",
        "Enter your tracking ID to check the latest status.",
        `
            <form id="trackingForm">

                <div class="form-group">

                    <label for="trackingId">
                        Tracking ID
                    </label>

                    <input
                        type="text"
                        id="trackingId"
                        name="trackingId"
                        placeholder="Example: JAN-XXXXXXXX"
                        required
                    >

                </div>

                <button type="submit" class="primary-button">
                    Track Feedback
                </button>

            </form>

            <div id="trackingResult"></div>
        `
    ));
}

/* ==================== TRACKING RESULT ==================== */

async function trackFeedback(trackingId) {
    const container = document.getElementById("trackingResult");

    if (!container) return;

    container.innerHTML = `<p>Checking your feedback...</p>`;

    try {
        const data = await api(
            "/track/" + encodeURIComponent(trackingId)
        );

        const item = data.suggestion || data.feedback || data;

        if (!item || !(item.tracking_id || item.trackingId)) {
            throw new Error("Feedback not found.");
        }

        const status = item.status || "Submitted";

        const statuses = [
            "Submitted",
            "Under Review",
            "In Progress",
            "Resolved"
        ];

        const currentIndex = statuses.indexOf(status);

        const timeline = statuses.map((step, index) => `
            <div class="timeline-step">

                <h4>
                    ${index <= currentIndex ? "✓ " : ""}
                    ${escapeHTML(step)}
                </h4>

                <p>
                    ${index < currentIndex
                        ? "Completed"
                        : index === currentIndex
                            ? "Current status"
                            : "Pending"}
                </p>

            </div>
        `).join("");

        const photo = item.photoUrl || item.photo_url || item.photo;

        container.innerHTML = `
            <div class="tracking-card">

                <h3>Feedback Details</h3>

                <div class="tracking-id-display">
                    ${escapeHTML(item.tracking_id || item.trackingId)}
                </div>

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

                <p>
                    <strong>Status:</strong>

                    <span class="status-badge ${statusClass(status)}">
                        ${escapeHTML(status)}
                    </span>
                </p>

                ${
                    item.admin_response || item.response
                        ? `
                            <div class="success-message">
                                <strong>Admin Response:</strong>
                                <p>
                                    ${escapeHTML(item.admin_response || item.response)}
                                </p>
                            </div>
                        `
                        : ""
                }

                ${
                    photo
                        ? `
                            <img
                                src="${escapeHTML(imageURL(photo))}"
                                class="photo-preview"
                                alt="Feedback photo"
                            >
                        `
                        : ""
                }

                <h3 style="margin-top:25px;">
                    Progress Timeline
                </h3>

                <div class="tracking-timeline">
                    ${timeline}
                </div>

            </div>
        `;

    } catch (error) {
        container.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

/* ==================== ADMIN DASHBOARD ==================== */

async function showAdminDashboard() {
    setPanel(shell(
        "Admin Dashboard",
        "Manage citizen feedback and monitor progress.",
        `
            <div id="adminDashboardContent">
                <p>Loading dashboard...</p>
            </div>

            <button
                type="button"
                class="danger-button"
                data-action="logout"
                style="margin-top:20px;"
            >
                Logout
            </button>
        `
    ));

    await loadAdminDashboard();
}

async function loadAdminDashboard() {
    const container = document.getElementById("adminDashboardContent");

    if (!container) return;

    try {
        const data = await api("/admin/suggestions");

        suggestionsCache =
            data.suggestions ||
            data.records ||
            data.items ||
            [];

        const stats = data.stats || {};

        const total = stats.Total ?? stats.total ?? suggestionsCache.length;

        const submitted = stats.Submitted ??
            stats.submitted ??
            suggestionsCache.filter(x => x.status === "Submitted").length;

        const review = stats["Under Review"] ??
            stats.under_review ??
            suggestionsCache.filter(x => x.status === "Under Review").length;

        const progress = stats["In Progress"] ??
            stats.in_progress ??
            suggestionsCache.filter(x => x.status === "In Progress").length;

        const resolved = stats.Resolved ??
            stats.resolved ??
            suggestionsCache.filter(x => x.status === "Resolved").length;

        container.innerHTML = `

            <div class="admin-stats">

                ${statCard("Total Feedback", total)}

                ${statCard("Submitted", submitted)}

                ${statCard("Under Review", review)}

                ${statCard("In Progress", progress)}

                ${statCard("Resolved", resolved)}

            </div>

            <div class="admin-toolbar">

                <input
                    type="search"
                    id="adminSearch"
                    placeholder="Search by ID, category or area..."
                >

                <select id="adminStatusFilter">

                    <option value="">All Statuses</option>

                    <option value="Submitted">Submitted</option>

                    <option value="Under Review">Under Review</option>

                    <option value="In Progress">In Progress</option>

                    <option value="Resolved">Resolved</option>

                </select>

                <button
                    type="button"
                    class="secondary-button"
                    data-action="refresh-admin"
                >
                    Refresh
                </button>

            </div>

            <div class="admin-list" id="adminRecords"></div>
        `;

        renderAdminRecords();

    } catch (error) {
        container.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function statCard(title, value) {
    return `
        <div class="stat-card">

            <h3>${escapeHTML(title)}</h3>

            <strong>${escapeHTML(value)}</strong>

        </div>
    `;
}

function renderAdminRecords() {
    const container = document.getElementById("adminRecords");

    if (!container) return;

    const search = (
        document.getElementById("adminSearch")?.value || ""
    ).toLowerCase();

    const statusFilter =
        document.getElementById("adminStatusFilter")?.value || "";

    const records = suggestionsCache.filter(item => {
        const text = [
            item.tracking_id,
            item.trackingId,
            item.category,
            item.area,
            item.description,
            item.name
        ].join(" ").toLowerCase();

        return text.includes(search) &&
            (!statusFilter || item.status === statusFilter);
    });

    if (!records.length) {
        container.innerHTML = `
            <div class="empty-state">
                No feedback records found.
            </div>
        `;
        return;
    }

    container.innerHTML = records.map(item => {

        const id = item.id;

        const photo = item.photoUrl || item.photo_url || item.photo;

        return `
            <article class="admin-card">

                <h3>${escapeHTML(item.category)}</h3>

                <p>
                    <strong>Tracking ID:</strong>
                    ${escapeHTML(item.tracking_id || item.trackingId)}
                </p>

                <p>
                    <strong>Citizen:</strong>
                    ${escapeHTML(item.name || "Citizen")}
                </p>

                <p>
                    <strong>Area:</strong>
                    ${escapeHTML(item.area)}
                </p>

                <p>
                    <strong>Description:</strong>
                    ${escapeHTML(item.description)}
                </p>

                <p>
                    <strong>Current Status:</strong>

                    <span class="status-badge ${statusClass(item.status)}">
                        ${escapeHTML(item.status)}
                    </span>
                </p>

                ${
                    photo
                        ? `
                            <img
                                src="${escapeHTML(imageURL(photo))}"
                                alt="Citizen uploaded photo"
                                loading="lazy"
                            >
                        `
                        : ""
                }

                <div class="form-group">

                    <label>Status</label>

                    <select id="status-${escapeHTML(id)}">

                        ${[
                            "Submitted",
                            "Under Review",
                            "In Progress",
                            "Resolved"
                        ].map(status => `
                            <option
                                value="${status}"
                                ${item.status === status ? "selected" : ""}
                            >
                                ${status}
                            </option>
                        `).join("")}

                    </select>

                </div>

                <div class="form-group">

                    <label>Admin Response</label>

                    <textarea
                        id="response-${escapeHTML(id)}"
                        placeholder="Enter response for citizen..."
                    >${escapeHTML(item.admin_response || item.response || "")}</textarea>

                </div>

                <div class="admin-actions">

                    <button
                        type="button"
                        class="primary-button"
                        data-action="update-record"
                        data-id="${escapeHTML(id)}"
                    >
                        Update
                    </button>

                    <button
                        type="button"
                        class="danger-button"
                        data-action="delete-record"
                        data-id="${escapeHTML(id)}"
                    >
                        Delete
                    </button>

                </div>

            </article>
        `;
    }).join("");
}

/* ==================== UPDATE ADMIN RECORD ==================== */

async function updateRecord(id) {
    const status = document.getElementById("status-" + id)?.value;

    const response = document.getElementById("response-" + id)?.value || "";

    if (!status) {
        toast("Please select a status.", "error");
        return;
    }

    try {
        await api("/admin/suggestions/" + encodeURIComponent(id), {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status,
                admin_response: response
            })
        });

        toast("Feedback updated successfully.");

        await loadAdminDashboard();

    } catch (error) {
        toast(error.message, "error");
    }
}

/* ==================== DELETE RECORD ==================== */

async function deleteRecord(id) {
    if (!confirm("Are you sure you want to delete this feedback?")) {
        return;
    }

    try {
        await api("/admin/suggestions/" + encodeURIComponent(id), {
            method: "DELETE"
        });

        toast("Feedback deleted successfully.");

        await loadAdminDashboard();

    } catch (error) {
        toast(error.message, "error");
    }
}

/* ==================== LOGOUT ==================== */

async function logout() {
    try {
        await api("/logout", {
            method: "POST"
        });
    } catch (error) {
        console.log(error);
    }

    currentUser = null;
    currentRole = null;

    toast("Logged out successfully.");

    showHome();
}

/* ==================== FORM SUBMISSIONS ==================== */

document.addEventListener("submit", async event => {

    const form = event.target;

    if (form.id === "registerForm") {
        event.preventDefault();

        const name = document.getElementById("name")?.value.trim() || "";

        const email = document.getElementById("email")?.value.trim() || "";

        const password = document.getElementById("password")?.value || "";

        const confirmPassword =
            document.getElementById("confirmPassword")?.value || "";

        if (password !== confirmPassword) {
            toast("Passwords do not match.", "error");
            return;
        }

        try {
            await api("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            });

            toast("Registration successful. Please login.");

            showLogin();

        } catch (error) {
            toast(error.message, "error");
        }
    }

    if (form.id === "loginForm") {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();

        const password = document.getElementById("password").value;

        try {
            const data = await api("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    identity: email,
                    password
                })
            });

            currentUser = data.user || null;
            currentRole = "citizen";

            toast("Login successful.");

            showCitizenDashboard();

        } catch (error) {
            toast(error.message, "error");
        }
    }

    if (form.id === "adminLoginForm") {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();

        const password = document.getElementById("password").value;

        try {
            await api("/admin-login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            currentRole = "admin";

            toast("Admin login successful.");

            showAdminDashboard();

        } catch (error) {
            toast(error.message, "error");
        }
    }

    if (form.id === "feedbackForm") {
        event.preventDefault();

        const fileInput = document.getElementById("photo");

        if (!fileInput.files.length) {
            toast("Please upload a supporting photo.", "error");
            return;
        }

        const formData = new FormData(form);

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";
        }

        try {
            const data = await api("/suggestions", {
                method: "POST",
                body: formData
            });

            const trackingId =
                data.trackingId ||
                data.tracking_id ||
                data.id;

            if (!trackingId) {
                throw new Error("Submitted, but tracking ID was not returned.");
            }

            setPanel(shell(
                "Feedback Submitted Successfully!",
                "Thank you for contributing towards better communities.",
                `
                    <div class="success-message">
                        Your feedback has been submitted successfully.
                    </div>

                    <h3>Your Tracking ID</h3>

                    <div class="tracking-id-display" id="newTrackingId">
                        ${escapeHTML(trackingId)}
                    </div>

                    <div class="form-actions">

                        <button
                            type="button"
                            class="primary-button"
                            data-action="copy-tracking"
                        >
                            Copy Tracking ID
                        </button>

                        <button
                            type="button"
                            class="secondary-button"
                            data-action="track-new"
                        >
                            Track Feedback
                        </button>

                    </div>

                    <p class="form-help">
                        Save your tracking ID to check the progress
                        of your feedback later.
                    </p>
                `
            ));

            toast("Feedback submitted successfully.");

        } catch (error) {
            toast(error.message, "error");

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Submit Feedback";
            }
        }
    }

    if (form.id === "trackingForm") {
        event.preventDefault();

        const trackingId =
            document.getElementById("trackingId").value.trim();

        await trackFeedback(trackingId);
    }

});

/* ==================== CLICK EVENTS ==================== */

document.addEventListener("click", async event => {

    const viewButton = event.target.closest("[data-view]");

    if (viewButton) {
        showView(viewButton.dataset.view);
        return;
    }

    const areaItem = event.target.closest("[data-area]");

    if (areaItem) {
        const areaInput = document.getElementById("area");

        if (areaInput) {
            areaInput.value = areaItem.dataset.area;
        }

        const list = document.getElementById("areaSuggestions");

        if (list) list.innerHTML = "";

        return;
    }

    const passwordButton = event.target.closest("[data-password]");

    if (passwordButton) {
        const input = document.getElementById(
            passwordButton.dataset.password
        );

        if (!input) return;

        const showing = input.type === "text";

        input.type = showing ? "password" : "text";

        passwordButton.textContent = showing ? "Show" : "Hide";

        return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (!actionButton) return;

    const action = actionButton.dataset.action;

    switch (action) {

        case "register":
            showRegister();
            break;

        case "submit":
            showFeedbackForm();
            break;

        case "track":
            showTrackingForm();
            break;

        case "logout":
            await logout();
            break;

        case "my-feedback":
            showMyFeedback();
            break;

        case "refresh-admin":
            await loadAdminDashboard();
            break;

        case "update-record":
            await updateRecord(actionButton.dataset.id);
            break;

        case "delete-record":
            await deleteRecord(actionButton.dataset.id);
            break;

        case "copy-tracking": {
            const trackingId =
                document.getElementById("newTrackingId")?.textContent.trim();

            if (trackingId) {
                try {
                    await navigator.clipboard.writeText(trackingId);
                    toast("Tracking ID copied.");
                } catch {
                    toast("Unable to copy tracking ID.", "error");
                }
            }

            break;
        }

        case "track-new": {
            const trackingId =
                document.getElementById("newTrackingId")?.textContent.trim();

            showTrackingForm();

            if (trackingId) {
                const input = document.getElementById("trackingId");

                if (input) input.value = trackingId;

                await trackFeedback(trackingId);
            }

            break;
        }

    }

});

/* ==================== INPUT EVENTS ==================== */

document.addEventListener("input", event => {

    if (event.target.id === "area") {
        showAreaSuggestions(event.target.value);
    }

    if (
        event.target.id === "adminSearch"
    ) {
        renderAdminRecords();
    }

});

document.addEventListener("change", event => {

    if (event.target.id === "adminStatusFilter") {
        renderAdminRecords();
    }

    if (event.target.id === "photo") {
        const file = event.target.files?.[0];

        selectedPhoto = file || null;

        const preview = document.getElementById("photoPreview");

        if (file && preview) {
            photoPreview(file, preview);
        } else if (preview) {
            preview.innerHTML = "";
        }
    }

});

/* ==================== GPS BUTTON ==================== */

document.addEventListener("click", event => {

    if (event.target.closest("#getLocation")) {
        getCurrentLocation();
    }

});

/* ==================== HAMBURGER MENU ==================== */

const menuToggle = document.getElementById("menuToggle");

const navMenu = document.getElementById("navMenu");

if (menuToggle && navMenu) {

    menuToggle.addEventListener("click", () => {

        const active = navMenu.classList.toggle("active");

        menuToggle.setAttribute(
            "aria-expanded",
            active ? "true" : "false"
        );

    });

}

/* ==================== THEME SETTINGS ==================== */

function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = selectedTheme;

    const selector = document.getElementById("themeSelect");

    if (selector) {
        selector.value = selectedTheme;
    }

    localStorage.setItem("janasetu-theme", selectedTheme);
}

const themeSelect = document.getElementById("themeSelect");

const savedTheme = localStorage.getItem("janasetu-theme") || "light";

applyTheme(savedTheme);

if (themeSelect) {
    themeSelect.addEventListener("change", event => {
        applyTheme(event.target.value);
    });
}

/* ==================== SESSION INITIALIZATION ==================== */

async function initializeJanaSetu() {

    showHome();

    try {
        const data = await api("/session");

        if (data.logged_in) {

            currentUser = data.user || null;

            currentRole = data.role || "citizen";

            if (currentRole === "admin") {
                await showAdminDashboard();
            } else {
                showCitizenDashboard();
            }

        }

    } catch (error) {
        console.log("No active session.");
    }

}

/* ==================== SERVICE WORKER ==================== */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker.register("/sw.js")
            .catch(error => {
                console.log("Service worker registration failed:", error);
            });

    });

}

/* ==================== START APPLICATION ==================== */

document.addEventListener("DOMContentLoaded", initializeJanaSetu);
