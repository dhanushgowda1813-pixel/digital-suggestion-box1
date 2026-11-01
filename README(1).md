# Digital Suggestion Box — Full-stack edition

A Flask + SQLite application for community suggestions, mandatory photo evidence, tracking IDs, citizen accounts, and an administrator dashboard.

## Features
- Citizen registration and login (passwords hashed)
- Mandatory photo upload; PNG/JPG/JPEG/WEBP, maximum 5 MB
- Unique tracking ID and public status lookup
- Progress timeline and administrator response
- Admin dashboard with counts, search, status filter, update and delete actions
- SQLite persistence, so requests are not limited to a single browser's localStorage

## Run locally (Windows)
1. Install Python 3.10 or newer.
2. Extract this ZIP and open a terminal in the extracted folder.
3. Create and activate a virtual environment (optional but recommended):
   ```bat
   py -m venv .venv
   .venv\Scripts\activate
   ```
4. Install dependencies:
   ```bat
   pip install -r requirements.txt
   ```
5. Start the app:
   ```bat
   py app.py
   ```
6. Open `http://127.0.0.1:5000` in your browser.

## First-run admin credentials
Default local demo login: username `admin`, password `ChangeMe123!`.
Set `DSB_ADMIN_USER` and `DSB_ADMIN_PASSWORD` environment variables before first launch to choose different credentials. Set `DSB_SECRET_KEY` to a strong random value before deployment. The default credentials are for local demonstration only; change them before sharing or deploying.

## Data and files
- SQLite database is created automatically as `suggestions.db` on first run.
- Uploaded photos are saved in `static/uploads/` using generated filenames.
- Back up both `suggestions.db` and `static/uploads/` to preserve submitted records.

## Important project limitations
This is a local learning/demo build, not production-hardened. For public deployment add HTTPS, CSRF protection, rate limiting, stricter image-content verification, production secret management, and a proper production server. Admin accounts are provisioned through environment variables at first database initialization; do not expose the demo credentials.
