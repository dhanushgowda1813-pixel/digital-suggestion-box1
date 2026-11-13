
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    url_for,
    redirect
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from pathlib import Path
from contextlib import contextmanager
import sqlite3
import os
import uuid
import mimetypes

# =========================================================
# JANASETU - DIGITAL CITIZEN FEEDBACK SYSTEM
# Flask Backend
# =========================================================

BASE = Path(__file__).resolve().parent

DB_PATH = Path(
    os.environ.get(
        "DATABASE_PATH",
        str(BASE / "suggestions.db")
    )
)

UPLOAD_DIR = Path(
    os.environ.get(
        "UPLOAD_FOLDER",
        str(BASE / "static" / "uploads")
    )
)

DB_PATH.parent.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)

# =========================================================
# APPLICATION CONFIGURATION
# =========================================================

app.secret_key = os.environ.get(
    "DSB_SECRET_KEY",
    "change-this-secret-before-deployment"
)

app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1
)

IS_PRODUCTION = (
    os.environ.get("RENDER", "").lower() == "true"
    or os.environ.get("FLASK_ENV") == "production"
)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=IS_PRODUCTION,
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 7
)

if IS_PRODUCTION and app.secret_key == "change-this-secret-before-deployment":
    app.logger.warning(
        "Set DSB_SECRET_KEY in your hosting environment."
    )


# =========================================================
# DATABASE CONNECTION
# =========================================================

@contextmanager
def db():

    con = sqlite3.connect(
        DB_PATH,
        timeout=20
    )

    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")

    try:
        yield con
        con.commit()

    except Exception:
        con.rollback()
        raise

    finally:
        con.close()


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

        con.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_suggestions_tracking
            ON suggestions(tracking_id)
        """)

        con.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_suggestions_created
            ON suggestions(created_at)
        """)

        con.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_suggestions_status
            ON suggestions(status)
        """)


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


def clean_text(value, maximum=5000):

    if not isinstance(value, str):
        return ""

    return value.strip()[:maximum]


def image_extension(photo):

    original_name = secure_filename(
        photo.filename or ""
    )

    extension = Path(original_name).suffix.lower()

    if not extension:
        extension = mimetypes.guess_extension(
            photo.mimetype or ""
        ) or ".upload"

    if len(extension) > 20:
        extension = ".upload"

    return extension


# =========================================================
# SEPARATE WEBSITE PAGES
# =========================================================

@app.route("/")
def home():

    return render_template(
        "index.html",
        page="home"
    )


@app.route("/login")
def citizen_login_page():

    if is_citizen():
        return redirect(url_for("submit_page"))

    if is_admin():
        return redirect(url_for("admin_page"))

    return render_template(
        "index.html",
        page="login"
    )


@app.route("/register")
def register_page():

    if is_citizen():
        return redirect(url_for("submit_page"))

    if is_admin():
        return redirect(url_for("admin_page"))

    return render_template(
        "index.html",
        page="register"
    )


@app.route("/admin-login")
def admin_login_page():

    if is_admin():
        return redirect(url_for("admin_page"))

    return render_template(
        "index.html",
        page="admin-login"
    )


@app.route("/submit")
def submit_page():

    if not is_citizen():

        return redirect(
            url_for(
                "citizen_login_page",
                next="submit"
            )
        )

    return render_template(
        "index.html",
        page="submit"
    )


@app.route("/track")
def track_page():

    return render_template(
        "index.html",
        page="track"
    )


@app.route("/admin")
def admin_page():

    if not is_admin():
        return redirect(url_for("admin_login_page"))

    return render_template(
        "index.html",
        page="admin"
    )


# =========================================================
# SERVICE WORKER
# =========================================================

@app.get("/sw.js")
def service_worker():

    response = app.send_static_file("sw.js")

    response.headers["Cache-Control"] = "no-cache"

    return response


# =========================================================
# CURRENT SESSION
# =========================================================

@app.get("/api/session")
def session_info():

    logged_in = is_citizen() or is_admin()

    return jsonify({
        "loggedIn": logged_in,
        "role": session.get("role"),
        "name": session.get("name")
    })


# =========================================================
# CITIZEN REGISTRATION
# =========================================================

@app.post("/api/register")
def register():

    data = request.get_json(silent=True) or {}

    name = clean_text(data.get("name"), 100)
    email = clean_text(data.get("email"), 254).lower()
    password = data.get("password") or ""

    if not name:
        return jsonify(
            error="Please enter your name."
        ), 400

    if not email or "@" not in email:
        return jsonify(
            error="Please enter a valid email address."
        ), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify(
            error="Password must contain at least 8 characters."
        ), 400

    if len(password) > 200:
        return jsonify(
            error="Password is too long."
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

    return jsonify(ok=True)


# =========================================================
# CITIZEN LOGIN
# =========================================================

@app.post("/api/login")
def login():

    data = request.get_json(silent=True) or {}

    email = clean_text(data.get("email"), 254).lower()
    password = data.get("password") or ""

    if not email or not isinstance(password, str):
        return jsonify(
            error="Please enter your email and password."
        ), 400

    with db() as con:

        user = con.execute(
            """
            SELECT *
            FROM users
            WHERE email=?
            """,
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

    return jsonify(ok=True)


# =========================================================
# ADMIN LOGIN
# =========================================================

@app.post("/api/admin-login")
def admin_login():

    data = request.get_json(silent=True) or {}

    username = clean_text(data.get("username"), 100)
    password = data.get("password") or ""

    if not username or not isinstance(password, str):
        return jsonify(
            error="Please enter your Admin username and password."
        ), 400

    with db() as con:

        admin = con.execute(
            """
            SELECT *
            FROM admins
            WHERE username=?
            """,
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

    return jsonify(ok=True)


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
        clean_text(request.form.get("name", ""), 100)
        or "Anonymous citizen"
    )

    category = clean_text(
        request.form.get("category", ""),
        100
    )

    area = clean_text(
        request.form.get("area", ""),
        200
    )

    description = clean_text(
        request.form.get("description", ""),
        5000
    )

    latitude = request.form.get("latitude", "").strip()
    longitude = request.form.get("longitude", "").strip()

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

    mime_type = (photo.mimetype or "").lower()

    if not mime_type.startswith("image/"):

        return jsonify(
            error="Please upload a valid image."
        ), 400

    extension = image_extension(photo)

    filename = uuid.uuid4().hex + extension

    filepath = UPLOAD_DIR / filename

    try:

        photo.save(filepath)

        if not filepath.exists() or filepath.stat().st_size == 0:
            raise OSError("Empty uploaded image")

    except Exception:

        try:
            filepath.unlink(missing_ok=True)
        except OSError:
            pass

        app.logger.exception(
            "Image upload failed"
        )

        return jsonify(
            error="Unable to save the uploaded image. Please try again."
        ), 500

    tracking_id = (
        "DSB-" + uuid.uuid4().hex[:10].upper()
    )

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

        try:
            filepath.unlink(missing_ok=True)
        except OSError:
            pass

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

    tracking_id = tracking_id.strip().upper()

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
            (tracking_id,)
        ).fetchone()

    if not row:

        return jsonify(
            error="No suggestion found for this tracking ID."
        ), 404

    result = row_to_dict(row)

    photo_name = result.pop("photo")

    result["photoUrl"] = url_for(
        "static",
        filename="uploads/" + Path(photo_name).name
    )

    return jsonify(result)


# =========================================================
# ADMIN DASHBOARD API
# =========================================================

@app.get("/api/admin/suggestions")
def admin_suggestions():

    if not is_admin():

        return jsonify(
            error="Admin access required."
        ), 403

    status = clean_text(
        request.args.get("status", ""),
        50
    )

    search = clean_text(
        request.args.get("q", ""),
        200
    )

    valid_statuses = [
        "Submitted",
        "Under Review",
        "In Progress",
        "Resolved"
    ]

    if status and status not in valid_statuses:

        return jsonify(
            error="Invalid status filter."
        ), 400

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

        args.extend([
            f"%{search}%"
        ] * 5)

    sql += " ORDER BY created_at DESC"

    with db() as con:

        rows = [
            row_to_dict(row)
            for row in con.execute(
                sql,
                args
            ).fetchall()
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

            for current_status in valid_statuses
        }

        stats["Total"] = con.execute(
            "SELECT COUNT(*) FROM suggestions"
        ).fetchone()[0]

    for row in rows:

        photo_name = row.pop("photo")

        row["photoUrl"] = url_for(
            "static",
            filename="uploads/" + Path(photo_name).name
        )

    return jsonify(
        items=rows,
        stats=stats
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
    response = data.get("admin_response", "")

    if not isinstance(status, str):
        return jsonify(
            error="Invalid status."
        ), 400

    if not isinstance(response, str):
        return jsonify(
            error="Invalid Admin response."
        ), 400

    status = status.strip()
    response = response.strip()[:5000]

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

    tracking_id = tracking_id.strip().upper()

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
                tracking_id
            )
        )

        updated = cur.rowcount

    if not updated:

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

    tracking_id = tracking_id.strip().upper()

    with db() as con:

        row = con.execute(
            """
            SELECT photo
            FROM suggestions
            WHERE tracking_id=?
            """,
            (tracking_id,)
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
            (tracking_id,)
        )

    try:

        photo_path = (
            UPLOAD_DIR / Path(row["photo"]).name
        )

        photo_path.unlink(missing_ok=True)

    except OSError:

        app.logger.warning(
            "Unable to delete uploaded image for %s",
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
