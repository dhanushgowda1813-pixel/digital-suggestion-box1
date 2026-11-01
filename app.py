from flask import Flask, render_template, request, jsonify, session, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pathlib import Path
import sqlite3
import os
import uuid

# --------------------------------------------------
# APP CONFIGURATION
# --------------------------------------------------

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

# No application-level photo size limit is set here.


# --------------------------------------------------
# DATABASE
# --------------------------------------------------

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)

        con.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        """)

        admin_username = os.environ.get(
            "DSB_ADMIN_USER",
            "admin"
        )

        admin_password = os.environ.get(
            "DSB_ADMIN_PASSWORD",
            "ChangeMe123!"
        )

        existing_admin = con.execute(
            "SELECT id FROM admins WHERE username = ?",
            (admin_username,)
        ).fetchone()

        if not existing_admin:
            con.execute(
                """
                INSERT INTO admins (username, password_hash)
                VALUES (?, ?)
                """,
                (
                    admin_username,
                    generate_password_hash(admin_password)
                )
            )


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

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


def save_photo(photo):
    original_name = secure_filename(photo.filename or "")
    extension = Path(original_name).suffix.lower()

    if not extension:
        extension = ".img"

    filename = f"{uuid.uuid4().hex}{extension}"

    save_path = UPLOAD_DIR / filename
    photo.save(save_path)

    return filename


# --------------------------------------------------
# HOME PAGE
# --------------------------------------------------

@app.route("/")
def home():
    return render_template("index.html")


# --------------------------------------------------
# SERVICE WORKER
# --------------------------------------------------

@app.get("/sw.js")
def service_worker():
    return app.send_static_file("sw.js")


# --------------------------------------------------
# SESSION INFORMATION
# --------------------------------------------------

@app.get("/api/session")
def session_info():
    return jsonify({
        "loggedIn": is_citizen() or is_admin(),
        "role": session.get("role"),
        "name": session.get("name")
    })


# --------------------------------------------------
# CITIZEN REGISTRATION
# Register only. Do NOT automatically log the user in.
# --------------------------------------------------

@app.post("/api/register")
def register():

    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or len(password) < 8:
        return jsonify(
            error=(
                "Enter your name, valid email, and a password "
                "of at least 8 characters."
            )
        ), 400

    try:
        with db() as con:
            con.execute(
                """
                INSERT INTO users (name, email, password_hash)
                VALUES (?, ?, ?)
                """,
                (
                    name,
                    email,
                    generate_password_hash(password)
                )
            )

    except sqlite3.IntegrityError:
        return jsonify(
            error="An account with this email already exists."
        ), 409

    # Important:
    # Do not set session["user_id"] here.
    # User must log in separately after registration.

    return jsonify(
        ok=True,
        message="Account created. Please log in."
    )


# --------------------------------------------------
# CITIZEN LOGIN
# --------------------------------------------------

@app.post("/api/login")
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    with db() as con:
        user = con.execute(
            "SELECT * FROM users WHERE email = ?",
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
        message="Login successful."
    )


# --------------------------------------------------
# ADMIN LOGIN
# --------------------------------------------------

@app.post("/api/admin-login")
def admin_login():

    data = request.get_json(silent=True) or {}

    username = data.get("username", "").strip()
    password = data.get("password", "")

    with db() as con:
        admin = con.execute(
            "SELECT * FROM admins WHERE username = ?",
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


# --------------------------------------------------
# LOGOUT
# --------------------------------------------------

@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


# --------------------------------------------------
# SUBMIT SUGGESTION
# Citizen login is mandatory.
# --------------------------------------------------

@app.post("/api/suggestions")
def create_suggestion():

    if not is_citizen():
        return jsonify(
            error="Please login first to submit a suggestion."
        ), 401

    photo = request.files.get("photo")

    name = request.form.get("name", "").strip()
    category = request.form.get("category", "").strip()
    state = request.form.get("state", "").strip()
    city = request.form.get("city", "").strip()
    area = request.form.get("area", "").strip()
    description = request.form.get("description", "").strip()

    if (
        not photo
        or not photo.filename
        or not name
        or not category
        or not area
        or not description
    ):
        return jsonify(
            error="All fields and a photo are mandatory."
        ), 400

    try:
        filename = save_photo(photo)

    except Exception:
        return jsonify(
            error="Could not save the uploaded photo."
        ), 500

    tracking_id = (
        "DSB-" + uuid.uuid4().hex[:10].upper()
    )

    with db() as con:
        con.execute(
            """
            INSERT INTO suggestions (
                tracking_id,
                user_id,
                name,
                category,
                area,
                description,
                photo
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tracking_id,
                session["user_id"],
                name,
                category,
                area,
                description,
                filename
            )
        )

    return jsonify(
        ok=True,
        trackingId=tracking_id
    )


# --------------------------------------------------
# TRACK SUGGESTION
# --------------------------------------------------

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
                created_at,
                updated_at
            FROM suggestions
            WHERE tracking_id = ?
            """,
            (tracking_id.strip().upper(),)
        ).fetchone()

    if not row:
        return jsonify(
            error="No suggestion found for this tracking ID."
        ), 404

    result = row_to_dict(row)

    result["photoUrl"] = url_for(
        "static",
        filename="uploads/" + result.pop("photo")
    )

    return jsonify(result)


# --------------------------------------------------
# ADMIN: VIEW SUGGESTIONS
# --------------------------------------------------

@app.get("/api/admin/suggestions")
def admin_suggestions():

    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    status = request.args.get("status", "").strip()
    search = request.args.get("q", "").strip()

    sql = "SELECT * FROM suggestions WHERE 1=1"
    args = []

    if status:
        sql += " AND status = ?"
        args.append(status)

    if search:
        sql += """
            AND (
                tracking_id LIKE ?
                OR name LIKE ?
                OR area LIKE ?
                OR category LIKE ?
            )
        """

        args.extend([
            f"%{search}%",
            f"%{search}%",
            f"%{search}%",
            f"%{search}%"
        ])

    sql += " ORDER BY created_at DESC"

    with db() as con:

        rows = [
            row_to_dict(row)
            for row in con.execute(sql, args).fetchall()
        ]

        stats = {
            status_name: con.execute(
                "SELECT COUNT(*) FROM suggestions WHERE status = ?",
                (status_name,)
            ).fetchone()[0]
            for status_name in [
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
        row["photoUrl"] = url_for(
            "static",
            filename="uploads/" + row.pop("photo")
        )

    return jsonify(
        items=rows,
        stats=stats
    )


# --------------------------------------------------
# ADMIN: UPDATE SUGGESTION
# --------------------------------------------------

@app.patch("/api/admin/suggestions/<tracking_id>")
def update_suggestion(tracking_id):

    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    data = request.get_json(silent=True) or {}

    status = data.get("status", "")

    admin_response = data.get(
        "admin_response",
        ""
    ).strip()

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
                status = ?,
                admin_response = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE tracking_id = ?
            """,
            (
                status,
                admin_response,
                tracking_id.upper()
            )
        )

    if not cur.rowcount:
        return jsonify(
            error="Suggestion not found."
        ), 404

    return jsonify(ok=True)


# --------------------------------------------------
# ADMIN: DELETE SUGGESTION
# --------------------------------------------------

@app.delete("/api/admin/suggestions/<tracking_id>")
def delete_suggestion(tracking_id):

    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    with db() as con:

        row = con.execute(
            "SELECT photo FROM suggestions WHERE tracking_id = ?",
            (tracking_id.upper(),)
        ).fetchone()

        if not row:
            return jsonify(
                error="Suggestion not found."
            ), 404

        con.execute(
            "DELETE FROM suggestions WHERE tracking_id = ?",
            (tracking_id.upper(),)
        )

    try:
        photo_path = UPLOAD_DIR / row["photo"]
        photo_path.unlink(missing_ok=True)

    except OSError:
        pass

    return jsonify(ok=True)


# --------------------------------------------------
# UPLOAD ERROR HANDLER
# --------------------------------------------------

@app.errorhandler(413)
def too_large(_):
    return jsonify(
        error=(
            "The uploaded file is too large for the server "
            "or hosting provider to accept."
        )
    ), 413


# --------------------------------------------------
# INITIALIZE DATABASE
# --------------------------------------------------

init_db()


# --------------------------------------------------
# RUN APP
# --------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)
