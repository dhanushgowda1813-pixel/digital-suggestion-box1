from flask import Flask, render_template, request, jsonify, session, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pathlib import Path
import sqlite3
import os
import uuid

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / "suggestions.db"
UPLOAD_DIR = BASE / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.secret_key = os.environ.get(
    "DSB_SECRET_KEY",
    "change-this-secret-before-deployment"
)


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

        username = os.environ.get("DSB_ADMIN_USER", "admin")
        password = os.environ.get("DSB_ADMIN_PASSWORD", "ChangeMe123!")

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
                (username, generate_password_hash(password))
            )


def is_admin():
    return session.get("role") == "admin"


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


@app.route("/")
def home():
    return render_template("index.html")


@app.get("/sw.js")
def service_worker():
    return app.send_static_file("sw.js")


@app.get("/api/session")
def session_info():
    return jsonify({
        "loggedIn": bool(session.get("user_id") or is_admin()),
        "role": session.get("role"),
        "name": session.get("name")
    })


@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or len(password) < 8:
        return jsonify(
            error="Enter your name, valid email, and a password of at least 8 characters."
        ), 400

    try:
        with db() as con:
            cur = con.execute(
                """
                INSERT INTO users(name, email, password_hash)
                VALUES(?, ?, ?)
                """,
                (name, email, generate_password_hash(password))
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


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    with db() as con:
        user = con.execute(
            "SELECT * FROM users WHERE email=?",
            (email,)
        ).fetchone()

    if not user or not check_password_hash(
        user["password_hash"], password
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


@app.post("/api/admin-login")
def admin_login():
    data = request.get_json(silent=True) or {}

    username = data.get("username", "").strip()
    password = data.get("password", "")

    with db() as con:
        admin = con.execute(
            "SELECT * FROM admins WHERE username=?",
            (username,)
        ).fetchone()

    if not admin or not check_password_hash(
        admin["password_hash"], password
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


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.post("/api/suggestions")
def create_suggestion():
    if not session.get("user_id"):
        return jsonify(
            error="Please log in as a citizen before submitting."
        ), 401

    photo = request.files.get("photo")

    name = request.form.get("name", "").strip()
    category = request.form.get("category", "").strip()
    area = request.form.get("area", "").strip()
    description = request.form.get("description", "").strip()

    if not all([
        photo,
        photo.filename,
        name,
        category,
        area,
        description
    ]):
        return jsonify(
            error="All fields and a photo are mandatory."
        ), 400

    # Keep the uploaded filename safe.
    safe_original_name = secure_filename(photo.filename)

    # Do not restrict the photo to only JPG, JPEG, PNG, or WEBP.
    # Store it with a unique name to avoid filename conflicts.
    extension = Path(safe_original_name).suffix.lower()

    if not extension or len(extension) > 15:
        extension = ".upload"

    filename = f"{uuid.uuid4().hex}{extension}"
    filepath = UPLOAD_DIR / filename

    try:
        photo.save(filepath)
    except Exception:
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
                    photo
                )
                VALUES(?, ?, ?, ?, ?, ?, ?)
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

    except Exception:
        try:
            filepath.unlink(missing_ok=True)
        except OSError:
            pass

        return jsonify(
            error="Unable to submit your suggestion. Please try again."
        ), 500

    return jsonify(
        ok=True,
        trackingId=tracking_id
    )


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
            WHERE tracking_id=?
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
        sql += " AND status=?"
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
        args += [f"%{search}%"] * 4

    sql += " ORDER BY created_at DESC"

    with db() as con:
        rows = [
            row_to_dict(row)
            for row in con.execute(sql, args).fetchall()
        ]

        stats = {
            current_status: con.execute(
                "SELECT COUNT(*) FROM suggestions WHERE status=?",
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
        row["photoUrl"] = url_for(
            "static",
            filename="uploads/" + row.pop("photo")
        )

    return jsonify(
        items=rows,
        stats=stats
    )


@app.patch("/api/admin/suggestions/<tracking_id>")
def update_suggestion(tracking_id):
    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    data = request.get_json(silent=True) or {}

    status = data.get("status", "")
    response = data.get("admin_response", "").strip()

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
            SET status=?,
                admin_response=?,
                updated_at=CURRENT_TIMESTAMP
            WHERE tracking_id=?
            """,
            (status, response, tracking_id.upper())
        )

    if not cur.rowcount:
        return jsonify(
            error="Suggestion not found."
        ), 404

    return jsonify(ok=True)


@app.delete("/api/admin/suggestions/<tracking_id>")
def delete_suggestion(tracking_id):
    if not is_admin():
        return jsonify(
            error="Admin access required."
        ), 403

    with db() as con:
        row = con.execute(
            "SELECT photo FROM suggestions WHERE tracking_id=?",
            (tracking_id.upper(),)
        ).fetchone()

        if not row:
            return jsonify(
                error="Suggestion not found."
            ), 404

        con.execute(
            "DELETE FROM suggestions WHERE tracking_id=?",
            (tracking_id.upper(),)
        )

    try:
        (UPLOAD_DIR / row["photo"]).unlink(missing_ok=True)
    except OSError:
        pass

    return jsonify(ok=True)


init_db()


if __name__ == "__main__":
    app.run(debug=True)
