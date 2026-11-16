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

  /* -------------------- FULL SITE ENGLISH / KANNADA -------------------- */

  const KANNADA_TEXT = {
    "Home":"ಮುಖಪುಟ",
    "Submit Feedback":"ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಿ",
    "Submit Application":"ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
    "Track Application":"ಅರ್ಜಿಯ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ",
    "Citizen Login":"ನಾಗರಿಕರ ಲಾಗಿನ್",
    "Register":"ನೋಂದಣಿ",
    "Administrator":"ನಿರ್ವಾಹಕರು",
    "Logout":"ಲಾಗ್ ಔಟ್",
    "Language / ಭಾಷೆ":"ಭಾಷೆ",
    "Choose website language":"ವೆಬ್‌ಸೈಟ್ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    "Theme":"ಥೀಮ್",
    "Light":"ಬೆಳಕು",
    "Dark":"ಡಾರ್ಕ್",
    "ಕರ್ನಾಟಕ | KARNATAKA":"ಕರ್ನಾಟಕ",
    "Citizen Participation • Local Governance":"ನಾಗರಿಕರ ಭಾಗವಹಿಸುವಿಕೆ • ಸ್ಥಳೀಯ ಆಡಳಿತ",
    "A better community":"ಉತ್ತಮ ಸಮುದಾಯ",
    "begins with":"ಆರಂಭವಾಗುವುದು",
    "your voice.":"ನಿಮ್ಮ ಧ್ವನಿಯಿಂದ.",
    "Have a concern about roads, water supply, waste management or public facilities? Share your feedback and follow its progress through one simple digital platform.":"ರಸ್ತೆಗಳು, ನೀರು ಸರಬರಾಜು, ತ್ಯಾಜ್ಯ ನಿರ್ವಹಣೆ ಅಥವಾ ಸಾರ್ವಜನಿಕ ಸೌಲಭ್ಯಗಳ ಬಗ್ಗೆ ಸಮಸ್ಯೆಯಿದೆಯೇ? ನಿಮ್ಮ ಅಭಿಪ್ರಾಯವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ ಮತ್ತು ಅದರ ಪ್ರಗತಿಯನ್ನು ಒಂದೇ ಡಿಜಿಟಲ್ ವೇದಿಕೆಯಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
    "Submit Your Feedback":"ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಿ",
    "How can we help you?":"ನಾವು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
    "Choose a service to get started.":"ಪ್ರಾರಂಭಿಸಲು ಒಂದು ಸೇವೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    "Service is our commitment":"ಸೇವೆಯೇ ನಮ್ಮ ಬದ್ಧತೆ",
    "Submit Feedback":"ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಿ",
    "Report a local issue or share a suggestion with the local administration.":"ಸ್ಥಳೀಯ ಸಮಸ್ಯೆಯನ್ನು ವರದಿ ಮಾಡಿ ಅಥವಾ ಸ್ಥಳೀಯ ಆಡಳಿತಕ್ಕೆ ನಿಮ್ಮ ಸಲಹೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.",
    "Submit now →":"ಈಗ ಸಲ್ಲಿಸಿ →",
    "Track Application":"ಅರ್ಜಿಯ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ",
    "Check the status of your submitted feedback using your tracking ID.":"ನಿಮ್ಮ ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ ಬಳಸಿ ಸಲ್ಲಿಸಿದ ಅಭಿಪ್ರಾಯದ ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ.",
    "Track now →":"ಈಗ ಪರಿಶೀಲಿಸಿ →",
    "Access your citizen account and submit feedback through the portal.":"ನಿಮ್ಮ ನಾಗರಿಕ ಖಾತೆಗೆ ಪ್ರವೇಶಿಸಿ, ಈ ಪೋರ್ಟಲ್ ಮೂಲಕ ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಿ.",
    "Login →":"ಲಾಗಿನ್ →",
    "Review submissions, manage requests and update application progress.":"ಸಲ್ಲಿಸಿದ ಅಭಿಪ್ರಾಯಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ವಿನಂತಿಗಳನ್ನು ನಿರ್ವಹಿಸಿ ಮತ್ತು ಅರ್ಜಿಯ ಪ್ರಗತಿಯನ್ನು ನವೀಕರಿಸಿ.",
    "Admin access →":"ನಿರ್ವಾಹಕರ ಪ್ರವೇಶ →",
    "Building better communities together":"ಒಟ್ಟಾಗಿ ಉತ್ತಮ ಸಮುದಾಯಗಳನ್ನು ನಿರ್ಮಿಸೋಣ",
    "Report neighbourhood issues":"ನೆರೆಹೊರೆಯ ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡಿ",
    "Share ideas and suggestions":"ಆಲೋಚನೆಗಳು ಮತ್ತು ಸಲಹೆಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ",
    "Follow application progress":"ಅರ್ಜಿಯ ಪ್ರಗತಿಯನ್ನು ಗಮನಿಸಿ",
    "How the system works":"ವ್ಯವಸ್ಥೆ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ",
    "Submit":"ಸಲ್ಲಿಸಿ",
    "Share your issue with the required details and photo.":"ಅಗತ್ಯ ವಿವರಗಳು ಮತ್ತು ಫೋಟೋದೊಂದಿಗೆ ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.",
    "Review":"ಪರಿಶೀಲನೆ",
    "Your submission can be reviewed by the administrator.":"ನಿಮ್ಮ ಅರ್ಜಿಯನ್ನು ನಿರ್ವಾಹಕರು ಪರಿಶೀಲಿಸಬಹುದು.",
    "Track progress":"ಪ್ರಗತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ",
    "Follow the latest status and administrator response online.":"ಇತ್ತೀಚಿನ ಸ್ಥಿತಿ ಮತ್ತು ನಿರ್ವಾಹಕರ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
    "Small suggestions can create meaningful change.":"ಸಣ್ಣ ಸಲಹೆಗಳೂ ಅರ್ಥಪೂರ್ಣ ಬದಲಾವಣೆಯನ್ನು ತರಬಹುದು.",
    "Participate in improving your neighbourhood by sharing concerns, ideas and suggestions through this digital platform.":"ಈ ಡಿಜಿಟಲ್ ವೇದಿಕೆಯ ಮೂಲಕ ಸಮಸ್ಯೆಗಳು, ಆಲೋಚನೆಗಳು ಮತ್ತು ಸಲಹೆಗಳನ್ನು ಹಂಚಿಕೊಂಡು ನಿಮ್ಮ ಪ್ರದೇಶದ ಅಭಿವೃದ್ಧಿಯಲ್ಲಿ ಭಾಗವಹಿಸಿ.",
    "Share Your Feedback →":"ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಹಂಚಿಕೊಳ್ಳಿ →",
    "← Back to Home":"← ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    "Sign in to access your JANASETU citizen account.":"ನಿಮ್ಮ ಜನಸೇತು ನಾಗರಿಕ ಖಾತೆಗೆ ಪ್ರವೇಶಿಸಲು ಲಾಗಿನ್ ಆಗಿ.",
    "Create Citizen Account":"ನಾಗರಿಕ ಖಾತೆ ರಚಿಸಿ",
    "Register to participate in improving your community.":"ನಿಮ್ಮ ಸಮುದಾಯದ ಅಭಿವೃದ್ಧಿಯಲ್ಲಿ ಭಾಗವಹಿಸಲು ನೋಂದಾಯಿಸಿ.",
    "Admin Login":"ನಿರ್ವಾಹಕರ ಲಾಗಿನ್",
    "Sign in to manage citizen feedback submissions.":"ನಾಗರಿಕರ ಅಭಿಪ್ರಾಯಗಳನ್ನು ನಿರ್ವಹಿಸಲು ಲಾಗಿನ್ ಆಗಿ.",
    "Submit Feedback":"ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಿ",
    "Share a local concern, suggestion or complaint.":"ಸ್ಥಳೀಯ ಸಮಸ್ಯೆ, ಸಲಹೆ ಅಥವಾ ದೂರನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.",
    "Track Application":"ಅರ್ಜಿಯ ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಿ",
    "Enter your tracking ID to view the latest progress.":"ಇತ್ತೀಚಿನ ಪ್ರಗತಿಯನ್ನು ನೋಡಲು ನಿಮ್ಮ ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ ನಮೂದಿಸಿ.",
    "Admin Dashboard":"ನಿರ್ವಾಹಕರ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    "Review submissions and manage their progress.":"ಸಲ್ಲಿಕೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಅವುಗಳ ಪ್ರಗತಿಯನ್ನು ನಿರ್ವಹಿಸಿ.",
    "Every suggestion is an opportunity to improve our community.":"ಪ್ರತಿಯೊಂದು ಸಲಹೆಯೂ ನಮ್ಮ ಸಮುದಾಯವನ್ನು ಸುಧಾರಿಸುವ ಒಂದು ಅವಕಾಶ.",
    "JANASETU | Citizen Feedback & Community Participation":"ಜನಸೇತು | ನಾಗರಿಕರ ಅಭಿಪ್ರಾಯ ಮತ್ತು ಸಮುದಾಯದ ಭಾಗವಹಿಸುವಿಕೆ",
    "© JANASETU - Digital Citizen Feedback System":"© ಜನಸೇತು - ಡಿಜಿಟಲ್ ನಾಗರಿಕರ ಅಭಿಪ್ರಾಯ ವ್ಯವಸ್ಥೆ",
    "JANASETU is an independent citizen feedback platform and is not an official Karnataka Government or Government of India website.":"ಜನಸೇತು ಸ್ವತಂತ್ರ ನಾಗರಿಕರ ಅಭಿಪ್ರಾಯ ವೇದಿಕೆಯಾಗಿದೆ. ಇದು ಕರ್ನಾಟಕ ಸರ್ಕಾರ ಅಥವಾ ಭಾರತ ಸರ್ಕಾರದ ಅಧಿಕೃತ ವೆಬ್‌ಸೈಟ್ ಅಲ್ಲ.",
    "Login to share your feedback with your community.":"ನಿಮ್ಮ ಸಮುದಾಯದೊಂದಿಗೆ ಅಭಿಪ್ರಾಯ ಹಂಚಿಕೊಳ್ಳಲು ಲಾಗಿನ್ ಆಗಿ.",
    "Authorized administrators can access the dashboard.":"ಅಧಿಕೃತ ನಿರ್ವಾಹಕರು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಪ್ರವೇಶಿಸಬಹುದು.",
    "Full Name":"ಪೂರ್ಣ ಹೆಸರು",
    "Enter your full name":"ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
    "Email Address":"ಇಮೇಲ್ ವಿಳಾಸ",
    "Enter your email":"ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ",
    "Password":"ಪಾಸ್‌ವರ್ಡ್",
    "Create a password":"ಪಾಸ್‌ವರ್ಡ್ ರಚಿಸಿ",
    "Confirm Password":"ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ",
    "Enter password again":"ಪಾಸ್‌ವರ್ಡ್ ಅನ್ನು ಮತ್ತೆ ನಮೂದಿಸಿ",
    "Create Account":"ಖಾತೆ ರಚಿಸಿ",
    "Already registered?":"ಈಗಾಗಲೇ ನೋಂದಾಯಿಸಿದ್ದೀರಾ?",
    "Login here":"ಇಲ್ಲಿ ಲಾಗಿನ್ ಆಗಿ",
    "Enter your registered email":"ನೋಂದಾಯಿತ ಇಮೇಲ್ ನಮೂದಿಸಿ",
    "Enter your password":"ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ",
    "Login":"ಲಾಗಿನ್",
    "Don't have an account?":"ಖಾತೆ ಇಲ್ಲವೇ?",
    "Create an account":"ಖಾತೆ ರಚಿಸಿ",
    "Username":"ಬಳಕೆದಾರ ಹೆಸರು",
    "Enter admin username":"ನಿರ್ವಾಹಕರ ಬಳಕೆದಾರ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
    "Enter admin password":"ನಿರ್ವಾಹಕರ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ",
    "Your Name":"ನಿಮ್ಮ ಹೆಸರು",
    "Enter your name (optional)":"ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ (ಐಚ್ಛಿಕ)",
    "Feedback Category":"ಅಭಿಪ್ರಾಯದ ವರ್ಗ",
    "Select a category":"ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    "Roads and Transport":"ರಸ್ತೆಗಳು ಮತ್ತು ಸಾರಿಗೆ",
    "Water Supply":"ನೀರು ಸರಬರಾಜು",
    "Street Lights":"ಬೀದಿ ದೀಪಗಳು",
    "Sanitation and Cleanliness":"ನೈರ್ಮಲ್ಯ ಮತ್ತು ಸ್ವಚ್ಛತೆ",
    "Drainage":"ಚರಂಡಿ ವ್ಯವಸ್ಥೆ",
    "Public Facilities":"ಸಾರ್ವಜನಿಕ ಸೌಲಭ್ಯಗಳು",
    "Environment":"ಪರಿಸರ",
    "Other":"ಇತರೆ",
    "Area / Location":"ಪ್ರದೇಶ / ಸ್ಥಳ",
    "Enter your area or location":"ನಿಮ್ಮ ಪ್ರದೇಶ ಅಥವಾ ಸ್ಥಳವನ್ನು ನಮೂದಿಸಿ",
    "Mark Location on Map":"ನಕ್ಷೆಯಲ್ಲಿ ಸ್ಥಳವನ್ನು ಗುರುತಿಸಿ",
    "Use My Current Location":"ನನ್ನ ಪ್ರಸ್ತುತ ಸ್ಥಳವನ್ನು ಬಳಸಿ",
    "You can use your current location or select a place on the map.":"ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಸ್ಥಳವನ್ನು ಬಳಸಬಹುದು ಅಥವಾ ನಕ್ಷೆಯಲ್ಲಿ ಸ್ಥಳವನ್ನು ಆಯ್ಕೆಮಾಡಬಹುದು.",
    "Describe Your Feedback":"ನಿಮ್ಮ ಅಭಿಪ್ರಾಯವನ್ನು ವಿವರಿಸಿ",
    "Explain your suggestion or the issue...":"ನಿಮ್ಮ ಸಲಹೆ ಅಥವಾ ಸಮಸ್ಯೆಯನ್ನು ವಿವರಿಸಿ...",
    "Upload Photo":"ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    "Please attach a photo related to your feedback.":"ನಿಮ್ಮ ಅಭಿಪ್ರಾಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಫೋಟೋವನ್ನು ಸೇರಿಸಿ.",
    "Submit Your Feedback":"ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಿ",
    "Feedback Submitted Successfully!":"ಅಭಿಪ್ರಾಯ ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಸಲಾಗಿದೆ!",
    "Thank you for helping improve your community. Your feedback has been recorded.":"ನಿಮ್ಮ ಸಮುದಾಯದ ಅಭಿವೃದ್ಧಿಗೆ ಸಹಕರಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಅಭಿಪ್ರಾಯವನ್ನು ದಾಖಲಿಸಲಾಗಿದೆ.",
    "Your Tracking ID":"ನಿಮ್ಮ ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ",
    "Copy Tracking ID":"ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿಯನ್ನು ನಕಲಿಸಿ",
    "Track Your Feedback":"ನಿಮ್ಮ ಅಭಿಪ್ರಾಯದ ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ",
    "Back to Home":"ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    "Enter your tracking ID to check the latest progress.":"ಇತ್ತೀಚಿನ ಪ್ರಗತಿಯನ್ನು ಪರಿಶೀಲಿಸಲು ನಿಮ್ಮ ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ ನಮೂದಿಸಿ.",
    "Tracking ID":"ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ",
    "Enter your tracking ID":"ನಿಮ್ಮ ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ ನಮೂದಿಸಿ",
    "Searching for your feedback...":"ನಿಮ್ಮ ಅಭಿಪ್ರಾಯವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
    "Current Status":"ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ",
    "Category:":"ವರ್ಗ:",
    "Area:":"ಪ್ರದೇಶ:",
    "Description:":"ವಿವರಣೆ:",
    "Submitted:":"ಸಲ್ಲಿಸಿದ ದಿನಾಂಕ:",
    "Uploaded Photo":"ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಫೋಟೋ",
    "Admin Response":"ನಿರ್ವಾಹಕರ ಪ್ರತಿಕ್ರಿಯೆ",
    "Manage citizen feedback and update progress.":"ನಾಗರಿಕರ ಅಭಿಪ್ರಾಯಗಳನ್ನು ನಿರ್ವಹಿಸಿ ಮತ್ತು ಪ್ರಗತಿಯನ್ನು ನವೀಕರಿಸಿ.",
    "Total Feedback":"ಒಟ್ಟು ಅಭಿಪ್ರಾಯಗಳು",
    "In Progress":"ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    "Resolved":"ಪರಿಹರಿಸಲಾಗಿದೆ",
    "Under Review":"ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    "All Statuses":"ಎಲ್ಲಾ ಸ್ಥಿತಿಗಳು",
    "Search by ID, area, category...":"ಐಡಿ, ಪ್ರದೇಶ ಅಥವಾ ವರ್ಗದ ಮೂಲಕ ಹುಡುಕಿ...",
    "Refresh":"ಮರುಲೋಡ್ ಮಾಡಿ",
    "Loading feedback...":"ಅಭಿಪ್ರಾಯಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...",
    "No feedback found":"ಯಾವುದೇ ಅಭಿಪ್ರಾಯ ಕಂಡುಬಂದಿಲ್ಲ",
    "There are no records matching your search.":"ನಿಮ್ಮ ಹುಡುಕಾಟಕ್ಕೆ ಹೊಂದುವ ದಾಖಲೆಗಳಿಲ್ಲ.",
    "Citizen:":"ನಾಗರಿಕ:",
    "Update Status":"ಸ್ಥಿತಿಯನ್ನು ನವೀಕರಿಸಿ",
    "Write a response to the citizen...":"ನಾಗರಿಕರಿಗೆ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಬರೆಯಿರಿ...",
    "Save Update":"ನವೀಕರಣವನ್ನು ಉಳಿಸಿ",
    "Delete":"ಅಳಿಸಿ",
    "Submitted":"ಸಲ್ಲಿಸಲಾಗಿದೆ",
    "Please wait...":"ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ...",
    "Not available":"ಲಭ್ಯವಿಲ್ಲ",
    "Not specified":"ನಿರ್ದಿಷ್ಟಪಡಿಸಿಲ್ಲ",
    "Anonymous":"ಅನಾಮಧೇಯ",
    "Show password":"ಪಾಸ್‌ವರ್ಡ್ ತೋರಿಸಿ",
    "Hide password":"ಪಾಸ್‌ವರ್ಡ್ ಮರೆಮಾಡಿ",
    "Logged out successfully.":"ಯಶಸ್ವಿಯಾಗಿ ಲಾಗ್ ಔಟ್ ಆಗಿದ್ದೀರಿ.",
    "Passwords do not match.":"ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ.",
    "Creating account...":"ಖಾತೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    "Account created successfully.":"ಖಾತೆ ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ.",
    "Logging in...":"ಲಾಗಿನ್ ಆಗಲಾಗುತ್ತಿದೆ...",
    "Login successful.":"ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ.",
    "Verifying...":"ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...",
    "Admin login successful.":"ನಿರ್ವಾಹಕರ ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ.",
    "Map could not be loaded. You can still enter your area above.":"ನಕ್ಷೆಯನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮೇಲಿನ ಜಾಗದಲ್ಲಿ ನಿಮ್ಮ ಪ್ರದೇಶವನ್ನು ನಮೂದಿಸಬಹುದು.",
    "Location selected on the map.":"ನಕ್ಷೆಯಲ್ಲಿ ಸ್ಥಳವನ್ನು ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ.",
    "Your browser does not support location. Please enter your area manually.":"ನಿಮ್ಮ ಬ್ರೌಸರ್ ಸ್ಥಳ ಗುರುತಿಸುವಿಕೆಯನ್ನು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರದೇಶವನ್ನು ಕೈಯಾರೆ ನಮೂದಿಸಿ.",
    "Finding your precise location. Please keep location services turned on...":"ನಿಮ್ಮ ನಿಖರ ಸ್ಥಳವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸ್ಥಳ ಸೇವೆಗಳನ್ನು ಆನ್‌ನಲ್ಲಿಡಿ...",
    "Locating...":"ಸ್ಥಳವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
    "GPS location detected. Finding your street and area...":"GPS ಸ್ಥಳ ಪತ್ತೆಯಾಗಿದೆ. ನಿಮ್ಮ ರಸ್ತೆ ಮತ್ತು ಪ್ರದೇಶವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...",
    "Location pinned successfully. Check the map pin and adjust it if needed.":"ಸ್ಥಳವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಗುರುತಿಸಲಾಗಿದೆ. ನಕ್ಷೆಯ ಗುರುತನ್ನು ಪರಿಶೀಲಿಸಿ, ಅಗತ್ಯವಿದ್ದರೆ ಬದಲಾಯಿಸಿ.",
    "Location permission was denied. Allow location access for this site and enable Precise location.":"ಸ್ಥಳ ಅನುಮತಿಯನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ. ಈ ವೆಬ್‌ಸೈಟ್‌ಗೆ ಸ್ಥಳ ಪ್ರವೇಶವನ್ನು ಅನುಮತಿಸಿ ಮತ್ತು ನಿಖರ ಸ್ಥಳವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ.",
    "Your device could not determine its location. Turn on GPS/location services and try again.":"ನಿಮ್ಮ ಸಾಧನವು ಸ್ಥಳವನ್ನು ಪತ್ತೆಹಚ್ಚಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. GPS/ಸ್ಥಳ ಸೇವೆಗಳನ್ನು ಆನ್ ಮಾಡಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    "Location request timed out. Move near a window or outdoors and try again.":"ಸ್ಥಳ ವಿನಂತಿಯ ಸಮಯ ಮುಗಿದಿದೆ. ಕಿಟಕಿಯ ಹತ್ತಿರ ಅಥವಾ ಹೊರಗೆ ಹೋಗಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    "Unable to get your location. Please try again.":"ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಪಡೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    "Please select an image file.":"ದಯವಿಟ್ಟು ಚಿತ್ರ ಫೈಲ್ ಆಯ್ಕೆಮಾಡಿ.",
    "Selected feedback photo preview":"ಆಯ್ಕೆ ಮಾಡಿದ ಅಭಿಪ್ರಾಯದ ಫೋಟೋ ಪೂರ್ವವೀಕ್ಷಣೆ",
    "Please upload a photo before submitting.":"ಸಲ್ಲಿಸುವ ಮೊದಲು ದಯವಿಟ್ಟು ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
    "Preparing photo...":"ಫೋಟೋ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...",
    "Submitting feedback...":"ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...",
    "Feedback was submitted, but no tracking ID was returned.":"ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸಲಾಗಿದೆ, ಆದರೆ ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿ ದೊರೆತಿಲ್ಲ.",
    "Feedback updated successfully.":"ಅಭಿಪ್ರಾಯವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ನವೀಕರಿಸಲಾಗಿದೆ.",
    "Are you sure you want to delete this feedback? This action cannot be undone.":"ಈ ಅಭಿಪ್ರಾಯವನ್ನು ಅಳಿಸಲು ನೀವು ಖಚಿತವಾಗಿದ್ದೀರಾ? ಈ ಕ್ರಿಯೆಯನ್ನು ಹಿಂತಿರುಗಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    "Saving...":"ಉಳಿಸಲಾಗುತ್ತಿದೆ...",
    "Deleting...":"ಅಳಿಸಲಾಗುತ್ತಿದೆ...",
    "Feedback deleted successfully.":"ಅಭಿಪ್ರಾಯವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಅಳಿಸಲಾಗಿದೆ.",
    "Copied to clipboard.":"ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ನಕಲಿಸಲಾಗಿದೆ.",
    "Unable to copy. Please copy it manually.":"ನಕಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಕೈಯಾರೆ ನಕಲಿಸಿ.",
    "Please enter your name.":"ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.",
    "Please enter a valid email address.":"ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ.",
    "Password must contain at least 8 characters.":"ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳನ್ನು ಹೊಂದಿರಬೇಕು.",
    "Password is too long.":"ಪಾಸ್‌ವರ್ಡ್ ತುಂಬಾ ಉದ್ದವಾಗಿದೆ.",
    "An account with this email already exists.":"ಈ ಇಮೇಲ್‌ನೊಂದಿಗೆ ಈಗಾಗಲೇ ಖಾತೆ ಇದೆ.",
    "Please enter your email and password.":"ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ.",
    "Email or password is incorrect.":"ಇಮೇಲ್ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.",
    "Please enter your Admin username and password.":"ದಯವಿಟ್ಟು ನಿರ್ವಾಹಕರ ಬಳಕೆದಾರ ಹೆಸರು ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ.",
    "Admin username or password is incorrect.":"ನಿರ್ವಾಹಕರ ಬಳಕೆದಾರ ಹೆಸರು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.",
    "Please log in as a citizen before submitting.":"ಅಭಿಪ್ರಾಯ ಸಲ್ಲಿಸುವ ಮೊದಲು ನಾಗರಿಕರಾಗಿ ಲಾಗಿನ್ ಆಗಿ.",
    "Invalid location coordinates.":"ಸ್ಥಳದ ನಿರ್ದೇಶಾಂಕಗಳು ಅಮಾನ್ಯವಾಗಿವೆ.",
    "Category, area, description, and a photo are mandatory.":"ವರ್ಗ, ಪ್ರದೇಶ, ವಿವರಣೆ ಮತ್ತು ಫೋಟೋ ಕಡ್ಡಾಯವಾಗಿವೆ.",
    "Please upload a valid image.":"ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
    "Unable to save the uploaded image. Please try again.":"ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಚಿತ್ರವನ್ನು ಉಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    "Unable to submit your suggestion. Please try again.":"ನಿಮ್ಮ ಸಲಹೆಯನ್ನು ಸಲ್ಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    "No suggestion found for this tracking ID.":"ಈ ಟ್ರ್ಯಾಕಿಂಗ್ ಐಡಿಗೆ ಯಾವುದೇ ಸಲಹೆ ಕಂಡುಬಂದಿಲ್ಲ.",
    "Invalid status filter.":"ಸ್ಥಿತಿ ಫಿಲ್ಟರ್ ಅಮಾನ್ಯವಾಗಿದೆ.",
    "Admin access required.":"ನಿರ್ವಾಹಕರ ಪ್ರವೇಶ ಅಗತ್ಯವಿದೆ.",
    "Invalid status.":"ಸ್ಥಿತಿ ಅಮಾನ್ಯವಾಗಿದೆ.",
    "Invalid Admin response.":"ನಿರ್ವಾಹಕರ ಪ್ರತಿಕ್ರಿಯೆ ಅಮಾನ್ಯವಾಗಿದೆ.",
    "Choose a valid status.":"ಮಾನ್ಯವಾದ ಸ್ಥಿತಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    "Suggestion not found.":"ಸಲಹೆ ಕಂಡುಬಂದಿಲ್ಲ."
  };

  const ENGLISH_TEXT = Object.fromEntries(
    Object.entries(KANNADA_TEXT).map(([english, kannada]) => [kannada, english])
  );

  function initializeLanguage() {
    const selector = $("#languageSelect");
    const savedLanguage = localStorage.getItem("janasetuLanguage") || "en";
    let activeLanguage = savedLanguage === "kn" ? "kn" : "en";

    function translateText(value) {
      const trimmed = value.trim();
      if (!trimmed) return value;
      const dictionary = activeLanguage === "kn" ? KANNADA_TEXT : ENGLISH_TEXT;
      const translated = dictionary[trimmed];
      if (!translated) return value;
      const leading = value.match(/^\s*/)?.[0] || "";
      const trailing = value.match(/\s*$/)?.[0] || "";
      return leading + translated + trailing;
    }

    function translateElement(element) {
      if (!(element instanceof Element)) return;
      if (element.matches("[data-en][data-kn]")) {
        element.textContent = activeLanguage === "kn"
          ? element.dataset.kn
          : element.dataset.en;
      }

      const attributes = ["placeholder", "title", "aria-label"];
      attributes.forEach(attribute => {
        if (element.hasAttribute(attribute)) {
          const original = element.getAttribute(attribute);
          element.setAttribute(attribute, translateText(original));
        }
      });

      if (element instanceof HTMLInputElement && element.type === "button") {
        element.value = translateText(element.value);
      }
    }

    function translateTree(root = document) {
      if (root.nodeType === Node.TEXT_NODE) {
        root.nodeValue = translateText(root.nodeValue || "");
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;

      if (root !== document) translateElement(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(node => {
        const parent = node.parentElement;
        if (parent && !parent.closest("script, style, textarea, input, select option[data-user-content]")) {
          node.nodeValue = translateText(node.nodeValue || "");
        }
      });
      if (root.querySelectorAll) {
        root.querySelectorAll("*").forEach(translateElement);
      }
    }

    function applyLanguage(language) {
      activeLanguage = language === "kn" ? "kn" : "en";
      localStorage.setItem("janasetuLanguage", activeLanguage);
      document.documentElement.lang = activeLanguage;
      if (selector) selector.value = activeLanguage;
      translateTree(document);
    }

    if (selector) {
      selector.value = activeLanguage;
      selector.addEventListener("change", event => applyLanguage(event.target.value));
    }

    applyLanguage(activeLanguage);

    // Also translate content created later by the app (forms, tracking results,
    // admin records and notifications) without changing user-entered text.
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            translateTree(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
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

  /* -------------------- PHOTO OPTIMIZATION -------------------- */

  async function optimizePhotoForUpload(file) {
    if (!file || !file.type.startsWith("image/") || !("createImageBitmap" in window)) {
      return file;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();

      const optimized = await new Promise(resolve =>
        canvas.toBlob(resolve, "image/webp", 0.80)
      );
      if (!optimized || optimized.size >= file.size) return file;

      return new File(
        [optimized],
        (file.name.replace(/\\.[^.]+$/, "") || "feedback-photo") + ".webp",
        { type: "image/webp", lastModified: Date.now() }
      );
    } catch (error) {
      console.warn("Photo optimization skipped:", error);
      return file;
    }
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

    setLoading(button, true, "Preparing photo...");
    const optimizedPhoto = await optimizePhotoForUpload(photo);
    formData.append("photo", optimizedPhoto, optimizedPhoto.name);

    formData.append(
      "latitude",
      $("#latitudeInput").value || ""
    );

    formData.append(
      "longitude",
      $("#longitudeInput").value || ""
    );

    if (button) button.textContent = "Submitting feedback...";

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
    // Navigation toggle is handled directly by the menu button for reliability.

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



  initializeLanguage();
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
