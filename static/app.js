const appPanel = document.getElementById('panel');
const toastEl = document.getElementById('toast');

const statuses = [
    'Submitted',
    'Under Review',
    'In Progress',
    'Resolved'
];

let currentView = '';

function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');

    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3200);
}

async function api(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            ...(options.body instanceof FormData
                ? {}
                : { 'Content-Type': 'application/json' }),
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await res.json();
    } catch {}

    if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
    }

    return data;
}

function view(name) {
    currentView = name;

    const views = {
        submit: submitView,
        login: loginView,
        register: registerView,
        'admin-login': adminLoginView,
        track: trackView,
        admin: adminView
    };

    (views[name] || homeView)();
}

document.addEventListener('click', e => {
    const b = e.target.closest('[data-view]');

    if (b) {
        e.preventDefault();
        view(b.dataset.view);
    }
});

function shell(title, lead, body, wide = false) {
    appPanel.innerHTML = `
        <div class="panel ${wide ? 'wide' : ''}">
            <button class="back" data-view="home">
                ← Back to home
            </button>

            <h2>${title}</h2>
            <p class="lead">${lead}</p>

            ${body}
        </div>
    `;

    appPanel.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function homeView() {
    appPanel.innerHTML = '';
}


// --------------------------------------------------
// SUBMIT SUGGESTION
// --------------------------------------------------

function submitView() {
    shell(
        'Share a suggestion',
        'Help improve your neighbourhood. All fields—including a photo—are required.',
        `
        <form id="suggestionForm">

            <div class="formgrid">

                <div class="field">
                    <label>Full name *</label>

                    <input
                        name="name"
                        required
                        maxlength="90"
                        placeholder="Your name"
                    >
                </div>

                <div class="field">
                    <label>Category *</label>

                    <select name="category" required>
                        <option value="">Choose category</option>
                        <option>Roads</option>
                        <option>Water supply</option>
                        <option>Waste management</option>
                        <option>Street lights</option>
                        <option>Public safety</option>
                        <option>Public transport</option>
                        <option>Other</option>
                    </select>
                </div>

                <!-- STATE -->
                <div class="field">
                    <label>State *</label>

                    <select name="state" id="locationState" required>
                        <option value="Karnataka" selected>
                            Karnataka
                        </option>
                        <option>Andhra Pradesh</option>
                        <option>Arunachal Pradesh</option>
                        <option>Assam</option>
                        <option>Bihar</option>
                        <option>Chhattisgarh</option>
                        <option>Goa</option>
                        <option>Gujarat</option>
                        <option>Haryana</option>
                        <option>Himachal Pradesh</option>
                        <option>Jharkhand</option>
                        <option>Kerala</option>
                        <option>Madhya Pradesh</option>
                        <option>Maharashtra</option>
                        <option>Manipur</option>
                        <option>Meghalaya</option>
                        <option>Mizoram</option>
                        <option>Nagaland</option>
                        <option>Odisha</option>
                        <option>Punjab</option>
                        <option>Rajasthan</option>
                        <option>Sikkim</option>
                        <option>Tamil Nadu</option>
                        <option>Telangana</option>
                        <option>Tripura</option>
                        <option>Uttar Pradesh</option>
                        <option>Uttarakhand</option>
                        <option>West Bengal</option>
                        <option>Delhi</option>
                    </select>
                </div>

                <!-- CITY -->
                <div class="field">
                    <label>City *</label>

                    <input
                        name="city"
                        id="locationCity"
                        value="Bengaluru"
                        required
                        placeholder="Enter city"
                    >
                </div>

                <!-- AREA -->
                <div class="field full">
                    <label>Area / locality *</label>

                    <input
                        name="area"
                        id="locationArea"
                        required
                        maxlength="120"
                        placeholder="Start typing your area"
                    >

                    <button
                        type="button"
                        class="btn light"
                        id="openLocationMap"
                        style="margin-top:10px"
                    >
                        📍 Choose location on map
                    </button>

                    <div
                        id="locationMapBox"
                        style="display:none;margin-top:12px"
                    >
                        <div
                            id="locationMap"
                            style="
                                height:350px;
                                width:100%;
                                border-radius:12px;
                            "
                        ></div>

                        <p class="hint">
                            Click anywhere on the map to select your location.
                        </p>

                        <button
                            type="button"
                            class="btn light"
                            id="useMyLocation"
                        >
                            Use my current location
                        </button>
                    </div>
                </div>

                <!-- DESCRIPTION -->
                <div class="field full">
                    <label>
                        Describe the issue or suggestion *
                    </label>

                    <textarea
                        name="description"
                        required
                        maxlength="2500"
                        placeholder="Tell us what happened and what could improve..."
                    ></textarea>
                </div>

                <!-- PHOTO -->
                <div class="field full">
                    <label>Upload photo (mandatory) *</label>

                    <input
                        id="photo"
                        name="photo"
                        type="file"
                        accept="image/*"
                        required
                    >

                    <span class="hint">
                        A photo is required. No app-level file size or image-extension restriction.
                    </span>

                    <img
                        id="preview"
                        class="photo-preview"
                        alt="Selected photo preview"
                    >
                </div>

            </div>

            <div class="formfoot">
                <button class="btn" type="submit">
                    Submit suggestion →
                </button>

                <span class="hint">
                    Sign in first to submit a request.
                </span>
            </div>

        </form>

        <div id="submissionResult"></div>
        `
    );

    document
        .getElementById('photo')
        .addEventListener('change', previewPhoto);

    document
        .getElementById('suggestionForm')
        .addEventListener('submit', submitSuggestion);

    setupAreaAutocomplete();
}


// --------------------------------------------------
// BENGALURU AREAS
// --------------------------------------------------

const bengaluruAreas = [
    'Bagalagunte, Bengaluru',
    'Chikkabanavara, Bengaluru',
    'T. Dasarahalli, Bengaluru',
    '8th Mile, Bengaluru',
    'Jalahalli, Bengaluru',
    'Peenya, Bengaluru',
    'Nagasandra, Bengaluru',
    'Madanayakanahalli, Bengaluru',
    'Anchepalya, Bengaluru',
    'Lakshmipura, Bengaluru',
    'Rajeshwari Nagar, Bengaluru',
    'Yeshwanthpur, Bengaluru',
    'Mathikere, Bengaluru',
    'Vijayanagar, Bengaluru',
    'Malleswaram, Bengaluru',
    'Hebbal, Bengaluru',
    'Majestic, Bengaluru',
    'Yelahanka, Bengaluru',
    'Hesaraghatta, Bengaluru',
    'Nandini Layout, Bengaluru',
    'Basaveshwaranagar, Bengaluru',
    'Kengeri, Bengaluru',
    'RR Nagar, Bengaluru',
    'Jayanagar, Bengaluru',
    'Banashankari, Bengaluru',
    'Indiranagar, Bengaluru',
    'Whitefield, Bengaluru',
    'Electronic City, Bengaluru',
    'Koramangala, Bengaluru',
    'BTM Layout, Bengaluru',
    'Marathahalli, Bengaluru',
    'Bellandur, Bengaluru',
    'Bommanahalli, Bengaluru',
    'Hoodi, Bengaluru',
    'Kalyan Nagar, Bengaluru',
    'Sahakara Nagar, Bengaluru'
];


// --------------------------------------------------
// MAP LOCATION
// --------------------------------------------------

let locationMap = null;
let locationMarker = null;
let leafletLoading = null;

function loadLeaflet() {
    if (window.L) {
        return Promise.resolve();
    }

    if (leafletLoading) {
        return leafletLoading;
    }

    leafletLoading = new Promise((resolve, reject) => {
        const css = document.createElement('link');

        css.rel = 'stylesheet';
        css.href =
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

        document.head.appendChild(css);

        const script = document.createElement('script');

        script.src =
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

        script.onload = resolve;

        script.onerror = () => {
            reject(
                new Error(
                    'Could not load the map. Check your internet connection.'
                )
            );
        };

        document.head.appendChild(script);
    });

    return leafletLoading;
}

function setupAreaAutocomplete() {
    const areaInput = document.getElementById('locationArea');
    const mapBox = document.getElementById('locationMapBox');
    const mapButton = document.getElementById('openLocationMap');
    const currentButton = document.getElementById('useMyLocation');

    if (!areaInput || !mapButton) {
        return;
    }

    // ----------------------------------------------
    // AREA AUTOCOMPLETE
    // ----------------------------------------------

    areaInput.setAttribute('autocomplete', 'off');
    areaInput.setAttribute('aria-autocomplete', 'list');

    const wrapper = document.createElement('div');

    wrapper.className = 'autocomplete-wrap';

    areaInput.parentNode.insertBefore(wrapper, areaInput);
    wrapper.appendChild(areaInput);

    const list = document.createElement('div');

    list.className = 'autocomplete-list';
    list.hidden = true;
    list.setAttribute('role', 'listbox');

    wrapper.appendChild(list);

    function closeList() {
        list.hidden = true;
        list.innerHTML = '';
    }

    function showSuggestions() {
        const query = areaInput.value.trim().toLowerCase();

        list.innerHTML = '';

        if (query.length < 2) {
            closeList();
            return;
        }

        const matches = bengaluruAreas
            .filter(area => area.toLowerCase().includes(query))
            .slice(0, 7);

        if (!matches.length) {
            closeList();
            return;
        }

        matches.forEach(area => {
            const option = document.createElement('button');

            option.type = 'button';
            option.className = 'autocomplete-option';
            option.setAttribute('role', 'option');
            option.textContent = area;

            option.addEventListener('click', () => {
                areaInput.value = area;
                closeList();
                areaInput.focus();
            });

            list.appendChild(option);
        });

        list.hidden = false;
    }

    areaInput.addEventListener('input', showSuggestions);
    areaInput.addEventListener('focus', showSuggestions);

    areaInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeList();
        }
    });

    document.addEventListener('click', e => {
        if (!wrapper.contains(e.target)) {
            closeList();
        }
    });

    // ----------------------------------------------
    // OPEN MAP
    // ----------------------------------------------

    mapButton.addEventListener('click', async () => {
        mapBox.style.display = 'block';

        try {
            await loadLeaflet();

            if (!locationMap) {
                locationMap = L.map('locationMap').setView(
                    [13.0827, 77.5877],
                    12
                );

                L.tileLayer(
                    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    {
                        maxZoom: 19,
                        attribution:
                            '&copy; OpenStreetMap contributors'
                    }
                ).addTo(locationMap);

                locationMap.on('click', async event => {
                    const lat = event.latlng.lat;
                    const lon = event.latlng.lng;

                    if (locationMarker) {
                        locationMarker.setLatLng(event.latlng);
                    } else {
                        locationMarker = L.marker(event.latlng)
                            .addTo(locationMap);
                    }

                    await fillAddressFromCoordinates(lat, lon);
                });
            }

            setTimeout(() => {
                locationMap.invalidateSize();
            }, 200);

        } catch (err) {
            toast(err.message);
        }
    });

    // ----------------------------------------------
    // USE CURRENT LOCATION
    // ----------------------------------------------

    currentButton.addEventListener('click', async () => {
        if (!navigator.geolocation) {
            toast(
                'Location access is not supported by this browser.'
            );
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                mapBox.style.display = 'block';

                try {
                    await loadLeaflet();

                    // Initialize map if not already initialized.
                    if (!locationMap) {
                        locationMap = L.map('locationMap').setView(
                            [lat, lon],
                            16
                        );

                        L.tileLayer(
                            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            {
                                maxZoom: 19,
                                attribution:
                                    '&copy; OpenStreetMap contributors'
                            }
                        ).addTo(locationMap);

                        locationMap.on('click', async event => {
                            const clickedLat = event.latlng.lat;
                            const clickedLon = event.latlng.lng;

                            if (locationMarker) {
                                locationMarker.setLatLng(event.latlng);
                            } else {
                                locationMarker = L.marker(event.latlng)
                                    .addTo(locationMap);
                            }

                            await fillAddressFromCoordinates(
                                clickedLat,
                                clickedLon
                            );
                        });
                    }

                    const point = [lat, lon];

                    locationMap.setView(point, 16);

                    if (locationMarker) {
                        locationMarker.setLatLng(point);
                    } else {
                        locationMarker = L.marker(point)
                            .addTo(locationMap);
                    }

                    setTimeout(() => {
                        locationMap.invalidateSize();
                    }, 200);

                    await fillAddressFromCoordinates(lat, lon);

                } catch (err) {
                    toast(err.message);
                }
            },

            () => {
                toast(
                    'Please allow location access in your browser.'
                );
            }
        );
    });
}


// --------------------------------------------------
// REVERSE GEOCODING
// Converts map coordinates into address details
// --------------------------------------------------

async function fillAddressFromCoordinates(lat, lon) {
    const areaInput = document.getElementById('locationArea');
    const cityInput = document.getElementById('locationCity');
    const stateInput = document.getElementById('locationState');

    try {
        const url =
            'https://nominatim.openstreetmap.org/reverse' +
            '?format=jsonv2' +
            '&lat=' + encodeURIComponent(lat) +
            '&lon=' + encodeURIComponent(lon);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Address lookup failed.');
        }

        const data = await response.json();
        const address = data.address || {};

        areaInput.value =
            address.suburb ||
            address.neighbourhood ||
            address.village ||
            address.town ||
            address.city_district ||
            address.residential ||
            data.display_name ||
            `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

        cityInput.value =
            address.city ||
            address.town ||
            address.village ||
            address.county ||
            cityInput.value;

        if (address.state) {
            const stateOption = Array.from(stateInput.options)
                .find(option =>
                    option.value.toLowerCase() ===
                    address.state.toLowerCase()
                );

            if (stateOption) {
                stateInput.value = stateOption.value;
            }
        }

        toast('Location selected.');

    } catch {
        areaInput.value =
            `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

        toast(
            'Map point selected. Address lookup was unavailable.'
        );
    }
}


// --------------------------------------------------
// THEMES
// --------------------------------------------------

const themeNames = [
    'light',
    'dark',
    'ocean',
    'sunset',
    'forest'
];

function applyTheme(theme) {
    if (!themeNames.includes(theme)) {
        theme = 'light';
    }

    document.documentElement.dataset.theme = theme;

    const picker = document.getElementById('themeSelect');

    if (picker) {
        picker.value = theme;
    }
}

function initializeTheme() {
    let theme = 'light';

    try {
        theme = localStorage.getItem('dsb-theme') || 'light';
    } catch {}

    applyTheme(theme);

    const picker = document.getElementById('themeSelect');

    if (picker) {
        picker.addEventListener('change', () => {
            applyTheme(picker.value);

            try {
                localStorage.setItem(
                    'dsb-theme',
                    picker.value
                );
            } catch {}
        });
    }
}

initializeTheme();


// --------------------------------------------------
// PHOTO PREVIEW
// No app-level type or size restriction
// --------------------------------------------------

function previewPhoto(e) {
    const file = e.target.files[0];
    const img = document.getElementById('preview');

    if (!file) {
        img.style.display = 'none';
        img.removeAttribute('src');
        return;
    }

    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
}


// --------------------------------------------------
// SUBMIT SUGGESTION
// --------------------------------------------------

async function submitSuggestion(e) {
    e.preventDefault();

    const form = e.currentTarget;
    const fd = new FormData(form);

    const photo = fd.get('photo');

    if (!photo || !photo.size) {
        toast('Photo upload is mandatory.');
        return;
    }

    try {
        const data = await api('/api/suggestions', {
            method: 'POST',
            body: fd
        });

        document.getElementById('submissionResult').innerHTML = `
            <div class="trackresult">

                <span class="status-pill">
                    Submitted successfully
                </span>

                <p>Your tracking ID is:</p>

                <h2>${escapeHtml(data.trackingId)}</h2>

                <p class="hint">
                    Save this ID to check the progress later.
                </p>

                <button class="btn light" data-view="track">
                    Track this suggestion
                </button>

            </div>
        `;

        form.reset();

        document.getElementById('preview').style.display = 'none';

        toast('Suggestion submitted.');

    } catch (err) {
        toast(err.message);

        if (err.message.includes('log in')) {
            view('login');
        }
    }
}


// --------------------------------------------------
// CITIZEN LOGIN
// --------------------------------------------------

function loginView() {
    shell(
        'Citizen login',
        'Sign in to submit a suggestion with a photo and manage your submissions.',
        `
        <form id="loginForm">

            <div class="field">
                <label>Email address</label>

                <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                >
            </div>

            <div class="field">
                <label>Password</label>

                <input
                    name="password"
                    type="password"
                    required
                    minlength="8"
                >
            </div>

            <div class="formfoot">
                <button class="btn">
                    Sign in
                </button>

                <button
                    class="textlink"
                    type="button"
                    data-view="register"
                >
                    Create account
                </button>
            </div>

        </form>
        `
    );

    document
        .getElementById('loginForm')
        .addEventListener('submit', async e => {
            e.preventDefault();

            const f = new FormData(e.currentTarget);

            try {
                await api('/api/login', {
                    method: 'POST',
                    body: JSON.stringify(
                        Object.fromEntries(f)
                    )
                });

                toast('Welcome back!');
                view('submit');

            } catch (err) {
                toast(err.message);
            }
        });
}


// --------------------------------------------------
// CITIZEN REGISTRATION
// --------------------------------------------------

function registerView() {
    shell(
        'Create citizen account',
        'Create an account to submit and follow community suggestions.',
        `
        <form id="registerForm">

            <div class="field">
                <label>Full name</label>

                <input
                    name="name"
                    required
                    maxlength="90"
                >
            </div>

            <div class="field">
                <label>Email address</label>

                <input
                    name="email"
                    type="email"
                    required
                >
            </div>

            <div class="field">
                <label>Password (at least 8 characters)</label>

                <input
                    name="password"
                    type="password"
                    required
                    minlength="8"
                >
            </div>

            <div class="formfoot">
                <button class="btn">
                    Create account
                </button>

                <button
                    class="textlink"
                    type="button"
                    data-view="login"
                >
                    I already have an account
                </button>
            </div>

        </form>
        `
    );

    document
        .getElementById('registerForm')
        .addEventListener('submit', async e => {
            e.preventDefault();

            try {
                await api('/api/register', {
                    method: 'POST',
                    body: JSON.stringify(
                        Object.fromEntries(
                            new FormData(e.currentTarget)
                        )
                    )
                });

                toast('Account created.');
                view('submit');

            } catch (err) {
                toast(err.message);
            }
        });
}


// --------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------

function adminLoginView() {
    shell(
        'Administrator access',
        'Sign in to review, update, and manage citizen suggestions.',
        `
        <form id="adminForm">

            <div class="field">
                <label>Admin username</label>

                <input
                    name="username"
                    required
                    autocomplete="username"
                >
            </div>

            <div class="field">
                <label>Password</label>

                <input
                    name="password"
                    type="password"
                    required
                    autocomplete="current-password"
                >
            </div>

            <button class="btn">
                Open dashboard
            </button>

        </form>
        `
    );

    document
        .getElementById('adminForm')
        .addEventListener('submit', async e => {
            e.preventDefault();

            try {
                await api('/api/admin-login', {
                    method: 'POST',
                    body: JSON.stringify(
                        Object.fromEntries(
                            new FormData(e.currentTarget)
                        )
                    )
                });

                toast('Admin signed in.');
                view('admin');

            } catch (err) {
                toast(err.message);
            }
        });
}


// --------------------------------------------------
// TRACK SUGGESTION
// --------------------------------------------------

function trackView() {
    shell(
        'Track your suggestion',
        'Enter the unique tracking ID you received after submitting your suggestion.',
        `
        <form id="trackForm">

            <div class="formfoot">

                <input
                    name="tracking"
                    required
                    placeholder="Example: DSB-1234ABCD"
                    style="
                        flex:1;
                        min-width:190px;
                        border:1px solid var(--line);
                        border-radius:11px;
                        padding:13px
                    "
                >

                <button class="btn">
                    Check status
                </button>

            </div>

        </form>

        <div id="trackResult"></div>
        `
    );

    document
        .getElementById('trackForm')
        .addEventListener('submit', async e => {
            e.preventDefault();

            const id = new FormData(e.currentTarget)
                .get('tracking');

            try {
                const item = await api(
                    '/api/track/' + encodeURIComponent(id)
                );

                renderTracking(
                    item,
                    document.getElementById('trackResult')
                );

            } catch (err) {
                document.getElementById('trackResult').innerHTML = `
                    <p class="hint">
                        ${escapeHtml(err.message)}
                    </p>
                `;
            }
        });
}


// --------------------------------------------------
// TRACKING RESULT
// --------------------------------------------------

function renderTracking(item, target) {
    const idx = statuses.indexOf(item.status);

    target.innerHTML = `
        <div class="trackresult">

            <div class="suggestion-head">

                <div>
                    <span class="hint">TRACKING ID</span>

                    <h3>
                        ${escapeHtml(item.tracking_id)}
                    </h3>
                </div>

                <span class="status-pill">
                    ${escapeHtml(item.status)}
                </span>

            </div>

            <div class="timeline">

                ${statuses.map((s, i) => `
                    <div class="stage ${
                        i < idx
                            ? 'done'
                            : i === idx
                                ? 'current'
                                : ''
                    }">

                        <div class="dot">
                            ${i < idx ? '✓' : i + 1}
                        </div>

                        ${s}

                    </div>
                `).join('')}

            </div>

            <div class="detailgrid">

                <div class="detail">
                    <small>Category</small>
                    <strong>
                        ${escapeHtml(item.category)}
                    </strong>
                </div>

                <div class="detail">
                    <small>Area</small>
                    <strong>
                        ${escapeHtml(item.area)}
                    </strong>
                </div>

                <div class="detail">
                    <small>Submitted</small>
                    <strong>
                        ${escapeHtml(item.created_at)}
                    </strong>
                </div>

                <div class="detail">
                    <small>Last updated</small>
                    <strong>
                        ${escapeHtml(item.updated_at)}
                    </strong>
                </div>

            </div>

            <div class="detail" style="margin-top:12px">
                <small>Suggestion details</small>

                <strong>
                    ${escapeHtml(item.description)}
                </strong>
            </div>

            <div class="detail" style="margin-top:12px">
                <small>Administrator response</small>

                <strong>
                    ${escapeHtml(
                        item.admin_response ||
                        'No response has been added yet.'
                    )}
                </strong>
            </div>

            <img
                class="result-photo"
                src="${escapeHtml(item.photoUrl || '')}"
                alt="Uploaded supporting photo"
            >

        </div>
    `;
}


// --------------------------------------------------
// ADMIN DASHBOARD
// --------------------------------------------------

async function adminView() {
    appPanel.innerHTML = `
        <div class="panel wide">

            <h2>Admin dashboard</h2>

            <p class="lead">
                Review citizen requests, update progress,
                and respond transparently.
            </p>

            <div id="adminContent">
                Loading…
            </div>

            <div class="formfoot">
                <button class="btn light" id="logout">
                    Log out
                </button>
            </div>

        </div>
    `;

    document.getElementById('logout').onclick = async () => {
        await api('/api/logout', {
            method: 'POST'
        });

        view('home');
        toast('Signed out.');
    };

    try {
        await loadAdmin();

    } catch (err) {
        toast(err.message);
        view('admin-login');
    }
}


// --------------------------------------------------
// LOAD ADMIN DATA
// --------------------------------------------------

async function loadAdmin() {
    const q =
        document.getElementById('adminSearch')?.value || '';

    const s =
        document.getElementById('adminFilter')?.value || '';

    const data = await api(
        '/api/admin/suggestions?q=' +
        encodeURIComponent(q) +
        '&status=' +
        encodeURIComponent(s)
    );

    const target = document.getElementById('adminContent');

    target.innerHTML = `
        <div class="stats">

            ${['Total', ...statuses].map(k => `
                <div class="stat">
                    <small>${k}</small>
                    <b>${data.stats[k] || 0}</b>
                </div>
            `).join('')}

        </div>

        <div class="toolbar">

            <input
                id="adminSearch"
                placeholder="Search ID, name, area..."
                value="${escapeHtml(q)}"
            >

            <select id="adminFilter">

                <option value="">
                    All statuses
                </option>

                ${statuses.map(st => `
                    <option ${
                        s === st ? 'selected' : ''
                    }>
                        ${st}
                    </option>
                `).join('')}

            </select>

            <button class="btn" id="refresh">
                Refresh
            </button>

        </div>

        <div id="adminItems">

            ${
                data.items.length
                    ? data.items.map(adminCard).join('')
                    : '<div class="empty">No suggestions match your search.</div>'
            }

        </div>
    `;

    document
        .getElementById('adminSearch')
        .addEventListener('input', debounce(loadAdmin, 300));

    document
        .getElementById('adminFilter')
        .addEventListener('change', loadAdmin);

    document
        .getElementById('refresh')
        .addEventListener('click', loadAdmin);

    target
        .querySelectorAll('[data-save]')
        .forEach(b => {
            b.addEventListener('click', saveAdmin);
        });

    target
        .querySelectorAll('[data-delete]')
        .forEach(b => {
            b.addEventListener('click', deleteAdmin);
        });
}


// --------------------------------------------------
// ADMIN SUGGESTION CARD
// --------------------------------------------------

function adminCard(x) {
    return `
        <article class="suggestion">

            <div class="suggestion-head">

                <div>

                    <span class="hint">
                        ${escapeHtml(x.tracking_id)}
                        ·
                        ${escapeHtml(x.created_at)}
                    </span>

                    <h3>
                        ${escapeHtml(x.name)}
                        —
                        ${escapeHtml(x.category)}
                    </h3>

                    <span class="hint">
                        ${escapeHtml(x.area)}
                    </span>

                </div>

                <span class="status-pill">
                    ${escapeHtml(x.status)}
                </span>

            </div>

            <p>
                ${escapeHtml(x.description)}
            </p>

            <img
                src="${escapeHtml(x.photoUrl || '')}"
                alt="Citizen uploaded photo"
                style="
                    max-width:150px;
                    max-height:100px;
                    border-radius:9px
                "
            >

            <div class="formgrid">

                <div class="field">
                    <label>Update status</label>

                    <select data-status="${escapeHtml(x.tracking_id)}">

                        ${statuses.map(s => `
                            <option ${
                                x.status === s ? 'selected' : ''
                            }>
                                ${s}
                            </option>
                        `).join('')}

                    </select>
                </div>

                <div class="field">
                    <label>Admin response</label>

                    <input
                        data-response="${escapeHtml(x.tracking_id)}"
                        value="${escapeHtml(x.admin_response || '')}"
                        placeholder="Write a short update"
                    >
                </div>

            </div>

            <div class="suggestion-actions">

                <button
                    class="btn"
                    data-save="${escapeHtml(x.tracking_id)}"
                >
                    Save update
                </button>

                <button
                    class="btn danger"
                    data-delete="${escapeHtml(x.tracking_id)}"
                >
                    Delete
                </button>

            </div>

        </article>
    `;
}


// --------------------------------------------------
// ADMIN: SAVE STATUS AND RESPONSE
// --------------------------------------------------

async function saveAdmin(e) {
    const id = e.currentTarget.dataset.save;

    const status = document.querySelector(
        `[data-status="${id}"]`
    ).value;

    const admin_response = document.querySelector(
        `[data-response="${id}"]`
    ).value;

    try {
        await api(
            '/api/admin/suggestions/' + encodeURIComponent(id),
            {
                method: 'PATCH',
                body: JSON.stringify({
                    status,
                    admin_response
                })
            }
        );

        toast('Suggestion updated.');

        await loadAdmin();

    } catch (err) {
        toast(err.message);
    }
}


// --------------------------------------------------
// ADMIN: DELETE SUGGESTION
// --------------------------------------------------

async function deleteAdmin(e) {
    const id = e.currentTarget.dataset.delete;

    if (!confirm(
        'Delete this suggestion and its uploaded photo?'
    )) {
        return;
    }

    try {
        await api(
            '/api/admin/suggestions/' + encodeURIComponent(id),
            {
                method: 'DELETE'
            }
        );

        toast('Suggestion deleted.');

        await loadAdmin();

    } catch (err) {
        toast(err.message);
    }
}


// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function debounce(fn, wait) {
    let timer;

    return () => {
        clearTimeout(timer);
        timer = setTimeout(fn, wait);
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c])
    );
}


// --------------------------------------------------
// SESSION / NAVIGATION
// --------------------------------------------------

(async () => {
    try {
        const s = await api('/api/session');

        if (s.role === 'admin') {
            const n = document.createElement('button');

            n.className = 'navlink';
            n.dataset.view = 'admin';
            n.textContent = 'Dashboard';

            document.getElementById('nav').prepend(n);

        } else if (s.role === 'citizen') {
            const n = document.createElement('button');

            n.className = 'navlink';
            n.dataset.view = 'submit';
            n.textContent = 'Submit suggestion';

            document.getElementById('nav').prepend(n);
        }

    } catch {}
})();


// --------------------------------------------------
// SERVICE WORKER
// --------------------------------------------------

if (
    'serviceWorker' in navigator &&
    location.protocol.startsWith('http')
) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .catch(() => {});
    });
}
