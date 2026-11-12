
# JANASETU – Digital Citizen Feedback System

JANASETU is a web-based citizen feedback platform that helps people share community suggestions, report local issues, and track the progress of their submissions.

## Features

- Citizen registration and login
- Secure password hashing
- Separate Admin login
- Submit suggestions and report community issues
- Photo upload with feedback submissions
- GPS location support
- Area and place search with map integration
- Unique tracking ID for every submission
- Public feedback tracking
- Feedback progress statuses:
  - Submitted
  - Under Review
  - In Progress
  - Resolved
- Admin dashboard with feedback statistics
- Search and filter submissions
- Admin responses and status updates
- Delete feedback submissions
- Responsive interface for desktop and mobile
- PWA support for compatible device installation
- Light, Dark, Ocean, Sunset and Forest themes

## Technology Used

- Frontend: HTML, CSS and JavaScript
- Backend: Python and Flask
- Database: SQLite
- Server: Gunicorn
- Map: Leaflet and OpenStreetMap
- Deployment: Render
- Application installation: Progressive Web App (PWA)

## Run Locally on Windows

1. Install Python 3.10 or newer.
2. Download or clone this repository.
3. Open Command Prompt or Terminal inside the project folder.
4. Create a virtual environment:

   ```bat
   py -m venv .venv
   ```

5. Activate the environment:

   ```bat
   .venv\Scripts\activate
   ```

6. Install the required packages:

   ```bat
   pip install -r requirements.txt
   ```

7. Start the application:

   ```bat
   py app.py
   ```

8. Open this address in your browser:

   http://127.0.0.1:5000

## Admin Account Configuration

The application supports environment variables for configuring the initial Admin account.

| Variable | Purpose |
|---|---|
| `DSB_ADMIN_USER` | Initial Admin username |
| `DSB_ADMIN_PASSWORD` | Initial Admin password |
| `DSB_SECRET_KEY` | Flask session security key |

Default local credentials:

- Username: `admin`
- Password: `ChangeMe123!`

**Important:** Change the default password before making the application publicly accessible.

Admin credentials are created during initial database initialization. Changing environment variables later does not automatically change an existing Admin account.

## Database and Uploaded Photos

- SQLite stores citizen accounts and feedback records.
- The database is created automatically when the application starts.
- Uploaded photos are stored using generated filenames.
- The default database location is `suggestions.db`.
- The default photo storage location is `static/uploads/`.

Back up the database and uploaded photos regularly.

## Render Deployment

The application can be deployed as a Render Web Service.

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
gunicorn app:app
```

For deployment, configure these environment variables:

```text
DSB_SECRET_KEY=your-strong-random-secret
DSB_ADMIN_USER=your-admin-username
DSB_ADMIN_PASSWORD=your-strong-admin-password
```

### Persistent Storage

Render's default filesystem may be temporary. To preserve feedback records and uploaded photos across deployments, configure a Persistent Disk.

For example, if the disk is mounted at `/var/data`, set:

```text
DATABASE_PATH=/var/data/suggestions.db
UPLOAD_FOLDER=/var/data/uploads
```

Make sure the configured upload directory exists or can be created by the application.

## Security and Usage Notes

- Use a strong secret key and Admin password.
- Keep database backups.
- Use HTTPS for public access.
- Protect Admin credentials.
- JANASETU is an independent citizen feedback platform and is not an official Karnataka Government or Government of India website.
