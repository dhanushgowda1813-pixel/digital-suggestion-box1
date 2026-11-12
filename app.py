
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    send_from_directory
)

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from werkzeug.utils import secure_filename

from pathlib import Path
from datetime import datetime
import sqlite3
import os
import uuid


# =========================================================
# JANASETU - DIGITAL CITIZEN FEEDBACK SYSTEM
# Complete Flask Backend
# =========================================================


# ==================== APP CONFIGURATION ====================

BASE_DIR = Path(__file__).resolve().parent

DB_PATH = BASE_DIR / "suggestions.db"

UPLOAD_DIR = BASE_DIR / "static" / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)

app.secret_key = os.environ.get(
    "DSB_SECRET_KEY",
    "janasetu-development-secret-change-before-production"
)

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# No application-level 5 MB upload limit.
# Actual upload limits may still be imposed by the hosting provider.


# ==================== ADMIN CONFIGURATION ====================

ADMIN_USERNAME = os.environ.get(
    "ADMIN_USERNAME",
    "admin"
)

ADMIN_PASSWORD = os.environ.get(
    "ADMIN_PASSWORD",
    "ChangeMe123!"
)


# ==================== DATABASE ====================

def get_db():

    connection = sqlite3.connect(DB_PATH)

    connection.row_factory = sqlite3.Row

    return connection


def ensure_column(connection, table, column, definition):

    columns = [
        row["name"]
        for row in connection.execute(
            f"PRAGMA table_info({table})"
        ).fetchall()
    ]

    if column not in columns:

        connection.execute(
            f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
        )


def initialize_database():

    connection = get_db()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS users (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT,

            email TEXT UNIQUE NOT NULL,

            password_hash TEXT NOT NULL,

            created_at TEXT

        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS suggestions (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            tracking_id TEXT UNIQUE NOT NULL,

            user_id INTEGER,

            name TEXT,

            category TEXT NOT NULL,

            area TEXT NOT NULL,

            description TEXT NOT NULL,

            photo TEXT NOT NULL,

            status TEXT DEFAULT 'Submitted',

            admin_response TEXT DEFAULT '',

            latitude TEXT,

            longitude TEXT,

            created_at TEXT,

            updated_at TEXT,

            FOREIGN KEY(user_id) REFERENCES users(id)

        )
    """)

    # Support databases created by earlier project versions.

    user_columns = {
        "name": "TEXT",
        "email": "TEXT",
        "password_hash": "TEXT",
        "created_at": "TEXT"
    }

    suggestion_columns = {
        "tracking_id": "TEXT",
        "user_id": "INTEGER",
        "name": "TEXT",
        "category": "TEXT",
        "area": "TEXT",
        "description": "TEXT",
        "photo": "TEXT",
        "status": "TEXT DEFAULT 'Submitted'",
        "admin_response": "TEXT DEFAULT ''",
        "latitude": "TEXT",
        "longitude": "TEXT",
        "created_at": "TEXT",
        "updated_at": "TEXT"
    }

    for column, definition in user_columns.items():

        ensure_column(
            connection,
            "users",
            column,
            definition
        )

    for column, definition in suggestion_columns.items():

        ensure_column(
            connection,
            "suggestions",
            column,
            definition
        )

    connection.commit()

    connection.close()


initialize_database()


# ==================== COMMON HELPERS ====================

def current_time():

    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def json_error(message, status_code=400):

    return jsonify({
        "success": False,
        "error": message
    }), status_code


def get_json_data():

    return request.get_json(silent=True) or {}


def is_admin():

    return session.get("role") == "admin"


def is_citizen():

    return session.get("role") == "citizen"


def suggestion_to_dict(row):

    item = dict(row)

    photo = item.get("photo")

    photo_url = (
        "/static/uploads/" + photo
        if photo else None
    )

    item["photoUrl"] = photo_url

    item["photo_url"] = photo_url

    item["trackingId"] = item.get("tracking_id")

    item["adminResponse"] = item.get("admin_response")

    return item


# ==================== HOME PAGE ====================

@app.route("/")
def home():

    return render_template("index.html")


# ==================== SERVICE WORKER ====================

@app.route("/sw.js")
def service_worker():

    return send_from_directory(
        BASE_DIR / "static",
        "sw.js",
        mimetype="application/javascript"
    )


# ==================== SESSION CHECK ====================

@app.route("/api/session", methods=["GET"])
def check_session():

    if is_admin():

        return jsonify({

            "success": True,

            "logged_in": True,

            "role": "admin",

            "user": {
                "name": "Admin",
                "role": "admin"
            }

        })

    if is_citizen():

        user_id = session.get("user_id")

        connection = get_db()

        user = connection.execute(
            "SELECT id, name, email FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        connection.close()

        if user:

            return jsonify({

                "success": True,

                "logged_in": True,

                "role": "citizen",

                "user": dict(user)

            })

    session.clear()

    return jsonify({

        "success": True,

        "logged_in": False,

        "role": None,

        "user": None

    })


# ==================== CITIZEN REGISTRATION ====================

@app.route("/api/register", methods=["POST"])
def register():

    data = get_json_data()

    name = (data.get("name") or "").strip()

    email = (data.get("email") or "").strip().lower()

    password = data.get("password") or ""

    if not email or not password:

        return json_error(
            "Email and password are required."
        )

    if len(password) < 6:

        return json_error(
            "Password must contain at least 6 characters."
        )

    password_hash = generate_password_hash(password)

    connection = get_db()

    try:

        connection.execute("""

            INSERT INTO users (
                name,
                email,
                password_hash,
                created_at
            )

            VALUES (?, ?, ?, ?)

        """, (
            name or "Citizen",
            email,
            password_hash,
            current_time()
        ))

        connection.commit()

        return jsonify({

            "success": True,

            "message": "Registration successful."

        }), 201

    except sqlite3.IntegrityError:

        return json_error(
            "An account with this email already exists."
        )

    finally:

        connection.close()


# ==================== CITIZEN LOGIN ====================

@app.route("/api/login", methods=["POST"])
def login():

    data = get_json_data()

    email = (
        data.get("email") or
        data.get("identity") or ""
    ).strip().lower()

    password = data.get("password") or ""

    if not email or not password:

        return json_error(
            "Please enter your email and password."
        )

    connection = get_db()

    user = connection.execute("""

        SELECT *
        FROM users
        WHERE email = ?

    """, (email,)).fetchone()

    connection.close()

    if not user:

        return json_error(
            "Invalid email or password.",
            401
        )

    if not check_password_hash(
        user["password_hash"],
        password
    ):

        return json_error(
            "Invalid email or password.",
            401
        )

    session.clear()

    session["role"] = "citizen"

    session["user_id"] = user["id"]

    return jsonify({

        "success": True,

        "message": "Login successful.",

        "role": "citizen",

        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }

    })


# ==================== ADMIN LOGIN ====================

@app.route("/api/admin-login", methods=["POST"])
def admin_login():

    data = get_json_data()

    username = (data.get("username") or "").strip()

    password = data.get("password") or ""

    if (
        username != ADMIN_USERNAME or
        password != ADMIN_PASSWORD
    ):

        return json_error(
            "Invalid admin username or password.",
            401
        )

    session.clear()

    session["role"] = "admin"

    return jsonify({

        "success": True,

        "message": "Admin login successful.",

        "role": "admin"

    })


# ==================== LOGOUT ====================

@app.route("/api/logout", methods=["POST"])
def logout():

    session.clear()

    return jsonify({

        "success": True,

        "message": "Logged out successfully."

    })


# ==================== SUBMIT FEEDBACK ====================

@app.route("/api/suggestions", methods=["POST"])
def submit_suggestion():

    category = (request.form.get("category") or "").strip()

    area = (request.form.get("area") or "").strip()

    description = (
        request.form.get("description") or ""
    ).strip()

    name = (request.form.get("citizenName") or "").strip()

    latitude = request.form.get("latitude") or None

    longitude = request.form.get("longitude") or None

    photo = request.files.get("photo")

    if not category or not area or not description:

        return json_error(
            "Please fill in all required feedback details."
        )

    if len(description) < 5:

        return json_error(
            "Please provide a more detailed description."
        )

    if not photo or not photo.filename:

        return json_error(
            "Please upload a supporting photo."
        )

    # Accept image formats supported by the browser.
    # No fixed 5 MB application limit is imposed.

    if not photo.mimetype or not photo.mimetype.startswith("image/"):

        return json_error(
            "Please upload a valid image file."
        )

    original_name = secure_filename(photo.filename)

    extension = Path(original_name).suffix.lower()

    if not extension:
        extension = ".img"

    filename = str(uuid.uuid4()) + extension

    filepath = UPLOAD_DIR / filename

    try:

        photo.save(filepath)

    except Exception:

        return json_error(
            "Unable to save the uploaded photo.",
            500
        )

    tracking_id = "JAN-" + uuid.uuid4().hex[:10].upper()

    user_id = (
        session.get("user_id")
        if is_citizen()
        else None
    )

    timestamp = current_time()

    connection = get_db()

    try:

        connection.execute("""

            INSERT INTO suggestions (

                tracking_id,
                user_id,
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

            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

        """, (

            tracking_id,
            user_id,
            name or "Citizen",
            category,
            area,
            description,
            filename,
            "Submitted",
            "",
            latitude,
            longitude,
            timestamp,
            timestamp

        ))

        connection.commit()

    except Exception:

        connection.close()

        if filepath.exists():
            filepath.unlink()

        return json_error(
            "Unable to submit feedback. Please try again.",
            500
        )

    connection.close()

    return jsonify({

        "success": True,

        "message": "Feedback submitted successfully.",

        "tracking_id": tracking_id,

        "trackingId": tracking_id,

        "photoUrl": "/static/uploads/" + filename

    }), 201


# ==================== PUBLIC FEEDBACK TRACKING ====================

@app.route("/api/track/<tracking_id>", methods=["GET"])
def track_suggestion(tracking_id):

    connection = get_db()

    row = connection.execute("""

        SELECT *
        FROM suggestions
        WHERE tracking_id = ?

    """, (tracking_id.strip().upper(),)).fetchone()

    connection.close()

    if not row:

        return json_error(
            "No feedback found with this tracking ID.",
            404
        )

    item = suggestion_to_dict(row)

    return jsonify({

        "success": True,

        "suggestion": item,

        **item

    })


# ==================== ADMIN / CITIZEN FEEDBACK LIST ====================

@app.route("/api/admin/suggestions", methods=["GET"])
def get_suggestions():

    if not is_admin() and not is_citizen():

        return json_error(
            "Please login to view feedback.",
            401
        )

    connection = get_db()

    if is_admin():

        rows = connection.execute("""

            SELECT *
            FROM suggestions
            ORDER BY id DESC

        """).fetchall()

    else:

        # Citizens can only view their own submissions.

        rows = connection.execute("""

            SELECT *
            FROM suggestions
            WHERE user_id = ?
            ORDER BY id DESC

        """, (session.get("user_id"),)).fetchall()

    records = [
        suggestion_to_dict(row)
        for row in rows
    ]

    counts = {
        "Submitted": 0,
        "Under Review": 0,
        "In Progress": 0,
        "Resolved": 0
    }

    for item in records:

        status = item.get("status") or "Submitted"

        if status in counts:
            counts[status] += 1

    stats = {

        "Total": len(records),

        "Submitted": counts["Submitted"],

        "Under Review": counts["Under Review"],

        "In Progress": counts["In Progress"],

        "Resolved": counts["Resolved"],

        "total": len(records),

        "submitted": counts["Submitted"],

        "under_review": counts["Under Review"],

        "in_progress": counts["In Progress"],

        "resolved": counts["Resolved"]

    }

    connection.close()

    return jsonify({

        "success": True,

        "suggestions": records,

        "records": records,

        "items": records,

        "stats": stats

    })


# ==================== UPDATE FEEDBACK ====================

@app.route(
    "/api/admin/suggestions/<int:suggestion_id>",
    methods=["PATCH"]
)
def update_suggestion(suggestion_id):

    if not is_admin():

        return json_error(
            "Admin access required.",
            403
        )

    data = get_json_data()

    status = (data.get("status") or "").strip()

    admin_response = (
        data.get("admin_response") or
        data.get("response") or ""
    ).strip()

    allowed_statuses = [
        "Submitted",
        "Under Review",
        "In Progress",
        "Resolved"
    ]

    if status not in allowed_statuses:

        return json_error(
            "Invalid feedback status."
        )

    connection = get_db()

    existing = connection.execute("""

        SELECT id
        FROM suggestions
        WHERE id = ?

    """, (suggestion_id,)).fetchone()

    if not existing:

        connection.close()

        return json_error(
            "Feedback record not found.",
            404
        )

    connection.execute("""

        UPDATE suggestions

        SET
            status = ?,
            admin_response = ?,
            updated_at = ?

        WHERE id = ?

    """, (

        status,
        admin_response,
        current_time(),
        suggestion_id

    ))

    connection.commit()

    connection.close()

    return jsonify({

        "success": True,

        "message": "Feedback updated successfully."

    })


# ==================== DELETE FEEDBACK ====================

@app.route(
    "/api/admin/suggestions/<int:suggestion_id>",
    methods=["DELETE"]
)
def delete_suggestion(suggestion_id):

    if not is_admin():

        return json_error(
            "Admin access required.",
            403
        )

    connection = get_db()

    row = connection.execute("""

        SELECT photo
        FROM suggestions
        WHERE id = ?

    """, (suggestion_id,)).fetchone()

    if not row:

        connection.close()

        return json_error(
            "Feedback record not found.",
            404
        )

    photo_filename = row["photo"]

    connection.execute("""

        DELETE FROM suggestions
        WHERE id = ?

    """, (suggestion_id,))

    connection.commit()

    connection.close()

    if photo_filename:

        photo_path = UPLOAD_DIR / Path(photo_filename).name

        if photo_path.exists():

            try:
                photo_path.unlink()
            except OSError:
                pass

    return jsonify({

        "success": True,

        "message": "Feedback deleted successfully."

    })


# ==================== ERROR HANDLING ====================

@app.errorhandler(404)
def page_not_found(error):

    if request.path.startswith("/api/"):

        return json_error(
            "Requested API endpoint was not found.",
            404
        )

    return "Page not found.", 404


@app.errorhandler(500)
def internal_server_error(error):

    if request.path.startswith("/api/"):

        return json_error(
            "Internal server error. Please try again.",
            500
        )

    return "Something went wrong.", 500


# ==================== RUN APPLICATION ====================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
