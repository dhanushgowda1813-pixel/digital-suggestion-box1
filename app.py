
from flask import Flask, render_template, request, jsonify, session, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pathlib import Path
import sqlite3
import os
import uuid

# =========================================================
# JANASETU - DIGITAL CITIZEN FEEDBACK SYSTEM
# Flask Backend
# =========================================================

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / "suggestions.db"
UPLOAD_DIR = BASE / "static" / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)

app.secret_key = os.environ.get(
    "DSB_SECRET_KEY",
    "change-this-secret-before-deployment"
)

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = (
    os.environ.get("RENDER") is not None
)

# No application-level upload size limit.
# Hosting providers may enforce their own limits.


# =========================================================
# DATABASE CONNECTION
# =========================================================

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# =========================================================
# DATABASE INITIALIZATION
# =========================================================

def init_db():

    with db() as con:

        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        con.execute("""
            CREATE TABLE IF NOT EXISTS suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracking_id TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                area TEXT NOT NULL,
                description TEXT NOT NULL,
                photo TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Submitted',
                admin_response TEXT DEFAULT '',
                latitude REAL,
                longitude REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)

        columns = {
            row["name"]
            for row in con.execute(
                "PRAGMA table_info(suggestions)"
            ).fetchall()
        }

        if "latitude" not in columns:
            con.execute(
                "ALTER TABLE suggestions ADD COLUMN latitude REAL"
            )

        if "longitude" not in columns:
            con.execute(
                "ALTER TABLE suggestions ADD COLUMN longitude REAL"
            )

        con.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        """)

        username = os.environ.get(
            "DSB_ADMIN_USER",
            "admin"
        )

        password = os.environ.get(
            "DSB_ADMIN_PASSWORD",
            "ChangeMe123!"
        )

        existing_admin = con.execute(
            "SELECT id FROM admins WHERE username=?",
            (username,)
        ).fetchone()

        if not existing_admin:
            con.execute(
                """
                INSERT INTO admins(username, password_hash)
                VALUES(?, ?)
                """,
                (
                    username,
                    generate_password_hash(password)
                )
            )


# =========================================================
# AUTHENTICATION HELPERS
# =========================================================

def is_admin():
    return session.get("role") == "admin"


def is_citizen():
    return (
        session.get("role") == "citizen"
        and session.get("user_id") is not None
    )


def row_to_dict(row):
    return {
        key: row[key]
        for key in row.keys()
    }


def add_photo_url(item):
    if item.get("photo"):
        item["photoUrl"] = url_for(
            "static",
            filename="uploads/" + Path(item["photo"]).name
        )
        item.pop("photo", None)

    # Compatibility with the frontend.
    item["response"] = item.get("admin_response", "")

    return item


# =========================================================
# HOME PAGE
# =========================================================

@app.route("/")
def home():
    return render_template("index.html")


# =========================================================
# SERVICE WORKER
# =========================================================

@app.get("/sw.js")
def service_worker():
    return app.send_static_file("sw.js")


# =========================================================
# CURRENT SESSION
# =========================================================

@app.get("/api/session")
def session_info():

    return jsonify({
        "loggedIn": is_citizen() or is_admin(),
        "role": session.get("role"),
        "name": session.get("name"),
        "user": {
            "name": session.get("name")
        } if session.get("role") == "citizen" else None
    })


# =========================================================
# CITIZEN REGISTRATION
# =========================================================

@app.post("/api/register")
def register():

    data = request.get_json(silent=True) or {}

    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    # Name is optional.
    if not name:
        name = "Citizen"

    if not email or "@" not in email:
        return jsonify(
            error="Please enter a valid email address."
        ), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify(
            error="Password must contain at least 8 characters."
        ), 400

    try:

        with db() as con:

            cur = con.execute(
                """
                INSERT INTO users(name, email, password_hash)
                VALUES(?, ?, ?)
                """,
                (
                    name,
                    email,
                    generate_password_hash(password)
                )
            )

            session.clear()

            session.update(
                user_id=cur.lastrowid,
                role="citizen",
                name=name
            )

    except sqlite3.IntegrityError:

        return jsonify(
            error="An account with this email already exists."
        ), 409

    return jsonify(
        ok=True,
        name=name
    )


# =========================================================
# CITIZEN LOGIN
# =========================================================

@app.post("/api/login")
def login():

    data = request.get_json(silent=True) or {}

    # Accept both frontend field names.
    email = str(
        data.get("email") or data.get("identity") or ""
    ).strip().lower()

    password = data.get("password") or ""

    if not email or not isinstance(password, str):
        return jsonify(
            error="Please enter your email and password."
        ), 400

    with db() as con:

        user = con.execute(
            "SELECT * FROM users WHERE email=?",
            (email,)
        ).fetchone()

    if not user or not check_password_hash(
        user["password_hash"],
        password
    ):

        return jsonify(
            error="Email or password is incorrect."
        ), 401

    session.clear()

    session.update(
        user_id=user["id"],
        role="citizen",
        name=user["name"]
    )

    return jsonify(
        ok=True,
        user={
            "name": user["name"],
            "email": user["email"]
        }
    )


# =========================================================
# ADMIN LOGIN
# =========================================================

@app.post("/api/admin-login")
def admin_login():

    data = request.get_json(silent=True) or {}

    username = str(data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not isinstance(password, str):
        return jsonify(
            error="Please enter your Admin username and password."
        ), 400

    with db() as con:

        admin = con.execute(
            "SELECT * FROM admins WHERE username=?",
            (username,)
        ).fetchone()

    if not admin or not check_password_hash(
        admin["password_hash"],
        password
    ):

        return jsonify(
            error="Admin username or password is incorrect."
        ), 401

    session.clear()

    session.update(
        role="admin",
        name=admin["username"]
    )

    return jsonify(
        ok=True,
        name=admin["username"]
    )


# =========================================================
# LOGOUT
# =========================================================

@app.post("/api/logout")
def logout():

    session.clear()

    return jsonify(ok=True)


# =========================================================
# CREATE CITIZEN SUGGESTION / COMPLAINT
# =========================================================

@app.post("/api/suggestions")
def create_suggestion():

    if not is_citizen():
        return jsonify(
            error="Please log in as a citizen before submitting."
        ), 401

    photo = request.files.get("photo")

    name = (
        request.form.get("name", "").strip()
        or session.get("name")
        or "Anonymous citizen"
    )

    category = request.form.get(
        "category", ""
    ).strip()

    area = request.form.get(
        "area", ""
    ).strip()

    description = request.form.get(
        "description", ""
    ).strip()

    latitude = request.form.get(
        "latitude", ""
    ).strip()

    longitude = request.form.get(
        "longitude", ""
    ).strip()

    # Validate optional coordinates.
    try:

        latitude = float(latitude) if latitude else None
        longitude = float(longitude) if longitude else None

        if latitude is not None and not -90 <= latitude <= 90:
            raise ValueError()

        if longitude is not None and not -180 <= longitude <= 180:
            raise ValueError()

    except (ValueError, TypeError):

        return jsonify(
            error="Invalid location coordinates."
        ), 400

    # Photo is mandatory.
    if not all([
        photo,
        photo.filename,
        category,
        area,
        description
    ]):

        return jsonify(
            error="Category, area, description, and a photo are mandatory."
        ), 400

    # Accept image uploads without a PNG/JPG/WEBP-only whitelist.
    # No application-level 5 MB limit is applied.
    # The browser's image/* selector is not a security validation.

    safe_original_name = secure_filename(photo.filename)

    extension = Path(safe_original_name).suffix.lower()

    if not extension or len(extension) > 20:
        extension = ".upload"

    filename = uuid.uuid4().hex + extension
    filepath = UPLOAD_DIR / filename

    try:

        photo.save(filepath)

        if not filepath.exists() or filepath.stat().st_size == 0:
            raise OSError("Empty uploaded file")

    except Exception:

        filepath.unlink(missing_ok=True)

        return jsonify(
            error="Unable to save the uploaded photo. Please try again."
        ), 500

    tracking_id = "DSB-" + uuid.uuid4().hex[:10].upper()

    try:

        with db() as con:

            con.execute(
                """
                INSERT INTO suggestions(
                    tracking_id,
                    user_id,
                    name,
                    category,
                    area,
                    description,
                    photo,
                    latitude,
                    longitude
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    tracking_id,
                    session["user_id"],
                    name,
                    category,
                    area,
                    description,
                    filename,
                    latitude,
                    longitude
                )
            )

    except Exception:

        filepath.unlink(missing_ok=True)

        app.logger.exception(
            "Suggestion submission failed"
        )

        return jsonify(
            error="Unable to submit your suggestion. Please try again."
        ), 500

    return jsonify(
        ok=True,
        trackingId=tracking_id
    )


# =========================================================
# PUBLIC TRACKING
# =========================================================

@app.get("/api/track/<tracking_id>")
def track(tracking_id):

    with db() as con:

        row = con.execute(
            """
            SELECT
                tracking_id,
                name,
                category,
                area,
                description,
                photo,
                status,
                admin_response,
                latitude,
                longitude,
                created_at,
                updated_at
            FROM suggestions
            WHERE tracking_id=?
            """,
            (tracking_id.strip().upper(),)
        ).fetchone()

    if not row:
        return jsonify(
            error="No suggestion found for this tracking ID."
        ), 404

    result = row_to_dict(row)
    result = add_photo_url(result)

    return jsonify(result)


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@app.get("/api/admin/suggestions")
def admin_suggestions():

    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    status = request.args.get("status", "").strip()
    search = request.args.get("q", "").strip()

    sql = """
        SELECT *
        FROM suggestions
        WHERE 1=1
    """

    args = []

    if status:
        sql += " AND status=?"
        args.append(status)

    if search:
        sql += """
            AND (
                tracking_id LIKE ?
                OR name LIKE ?
                OR area LIKE ?
                OR category LIKE ?
                OR description LIKE ?
            )
        """

        args += [f"%{search}%"] * 5

    sql += " ORDER BY created_at DESC"

    with db() as con:

        rows = [
            row_to_dict(row)
            for row in con.execute(sql, args).fetchall()
        ]

        stats = {
            current_status: con.execute(
                """
                SELECT COUNT(*)
                FROM suggestions
                WHERE status=?
                """,
                (current_status,)
            ).fetchone()[0]

            for current_status in [
                "Submitted",
                "Under Review",
                "In Progress",
                "Resolved"
            ]
        }

        stats["Total"] = con.execute(
            "SELECT COUNT(*) FROM suggestions"
        ).fetchone()[0]

    for row in rows:
        add_photo_url(row)

    # Return both capitalized and lowercase statistic keys.
    frontend_stats = {
        "Total": stats["Total"],
        "Submitted": stats["Submitted"],
        "Under Review": stats["Under Review"],
        "In Progress": stats["In Progress"],
        "Resolved": stats["Resolved"],
        "total": stats["Total"],
        "submitted": stats["Submitted"],
        "underReview": stats["Under Review"],
        "inProgress": stats["In Progress"],
        "resolved": stats["Resolved"]
    }

    return jsonify(
        items=rows,
        stats=frontend_stats
    )


# =========================================================
# ADMIN UPDATE STATUS AND RESPONSE
# =========================================================

@app.patch("/api/admin/suggestions/<tracking_id>")
def update_suggestion(tracking_id):

    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    data = request.get_json(silent=True) or {}

    status = data.get("status", "")

    # Accept both frontend and backend response field names.
    response = data.get(
        "admin_response",
        data.get("response", "")
    )

    if not isinstance(response, str):
        return jsonify(
            error="Invalid Admin response."
        ), 400

    response = response.strip()

    valid_statuses = [
        "Submitted",
        "Under Review",
        "In Progress",
        "Resolved"
    ]

    if status not in valid_statuses:
        return jsonify(
            error="Choose a valid status."
        ), 400

    with db() as con:

        cur = con.execute(
            """
            UPDATE suggestions
            SET
                status=?,
                admin_response=?,
                updated_at=CURRENT_TIMESTAMP
            WHERE tracking_id=?
            """,
            (
                status,
                response,
                tracking_id.strip().upper()
            )
        )

    if not cur.rowcount:
        return jsonify(
            error="Suggestion not found."
        ), 404

    return jsonify(ok=True)


# =========================================================
# ADMIN DELETE SUGGESTION
# =========================================================

@app.delete("/api/admin/suggestions/<tracking_id>")
def delete_suggestion(tracking_id):

    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    with db() as con:

        row = con.execute(
            """
            SELECT photo
            FROM suggestions
            WHERE tracking_id=?
            """,
            (tracking_id.strip().upper(),)
        ).fetchone()

        if not row:
            return jsonify(
                error="Suggestion not found."
            ), 404

        con.execute(
            """
            DELETE FROM suggestions
            WHERE tracking_id=?
            """,
            (tracking_id.strip().upper(),)
        )

    try:

        photo_path = UPLOAD_DIR / Path(row["photo"]).name
        photo_path.unlink(missing_ok=True)

    except OSError:

        app.logger.warning(
            "Unable to delete uploaded photo for %s",
            tracking_id
        )

    return jsonify(ok=True)


# =========================================================
# INITIALIZE DATABASE
# =========================================================

init_db()


# =========================================================
# LOCAL DEVELOPMENT
# =========================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
