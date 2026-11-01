from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pathlib import Path
import sqlite3, os, uuid

BASE = Path(__file__).resolve().parent
DB_PATH = BASE / 'suggestions.db'
UPLOAD_DIR = BASE / 'static' / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED = {'png', 'jpg', 'jpeg', 'webp'}
MAX_PHOTO_BYTES = 5 * 1024 * 1024
app = Flask(__name__)
app.secret_key = os.environ.get('DSB_SECRET_KEY', 'change-this-secret-before-deployment')
app.config['MAX_CONTENT_LENGTH'] = MAX_PHOTO_BYTES + 1024 * 1024


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as con:
        con.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
        con.execute('''CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, tracking_id TEXT UNIQUE NOT NULL,
            user_id INTEGER, name TEXT NOT NULL, category TEXT NOT NULL, area TEXT NOT NULL,
            description TEXT NOT NULL, photo TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Submitted',
            admin_response TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id))''')
        con.execute('''CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)''')
        # First-run admin can be configured using environment variables.
        username = os.environ.get('DSB_ADMIN_USER', 'admin')
        password = os.environ.get('DSB_ADMIN_PASSWORD', 'ChangeMe123!')
        if not con.execute('SELECT id FROM admins WHERE username=?', (username,)).fetchone():
            con.execute('INSERT INTO admins(username,password_hash) VALUES(?,?)',
                        (username, generate_password_hash(password)))


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED


def is_admin():
    return session.get('role') == 'admin'


@app.route('/')
def home():
    return render_template('index.html')

@app.get('/sw.js')
def service_worker():
    return app.send_static_file('sw.js')


@app.get('/api/session')
def session_info():
    return jsonify({'loggedIn': bool(session.get('user_id') or is_admin()),
                    'role': session.get('role'), 'name': session.get('name')})


@app.post('/api/register')
def register():
    data = request.get_json(silent=True) or {}
    name, email, password = (data.get('name','').strip(), data.get('email','').strip().lower(), data.get('password',''))
    if not name or not email or len(password) < 8:
        return jsonify(error='Enter your name, valid email, and a password of at least 8 characters.'), 400
    try:
        with db() as con:
            cur = con.execute('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)',
                              (name, email, generate_password_hash(password)))
            session.update(user_id=cur.lastrowid, role='citizen', name=name)
    except sqlite3.IntegrityError:
        return jsonify(error='An account with this email already exists.'), 409
    return jsonify(ok=True)


@app.post('/api/login')
def login():
    data = request.get_json(silent=True) or {}
    email, password = data.get('email','').strip().lower(), data.get('password','')
    with db() as con:
        user = con.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify(error='Email or password is incorrect.'), 401
    session.clear(); session.update(user_id=user['id'], role='citizen', name=user['name'])
    return jsonify(ok=True)


@app.post('/api/admin-login')
def admin_login():
    data = request.get_json(silent=True) or {}
    with db() as con:
        admin = con.execute('SELECT * FROM admins WHERE username=?', (data.get('username','').strip(),)).fetchone()
    if not admin or not check_password_hash(admin['password_hash'], data.get('password','')):
        return jsonify(error='Admin username or password is incorrect.'), 401
    session.clear(); session.update(role='admin', name=admin['username'])
    return jsonify(ok=True)


@app.post('/api/logout')
def logout():
    session.clear(); return jsonify(ok=True)


@app.post('/api/suggestions')
def create_suggestion():
    if not session.get('user_id'):
        return jsonify(error='Please log in as a citizen before submitting.'), 401
    photo = request.files.get('photo')
    name = request.form.get('name','').strip()
    category = request.form.get('category','').strip()
    area = request.form.get('area','').strip()
    description = request.form.get('description','').strip()
    if not all([photo, photo.filename, name, category, area, description]):
        return jsonify(error='All fields and a photo are mandatory.'), 400
    if not allowed_file(photo.filename):
        return jsonify(error='Photo must be PNG, JPG, JPEG, or WEBP.'), 400
    photo.stream.seek(0, os.SEEK_END); size = photo.stream.tell(); photo.stream.seek(0)
    if size > MAX_PHOTO_BYTES:
        return jsonify(error='Photo must be 5 MB or smaller.'), 400
    ext = secure_filename(photo.filename).rsplit('.',1)[1].lower()
    filename = f'{uuid.uuid4().hex}.{ext}'
    photo.save(UPLOAD_DIR / filename)
    tracking_id = 'DSB-' + uuid.uuid4().hex[:10].upper()
    with db() as con:
        con.execute('''INSERT INTO suggestions(tracking_id,user_id,name,category,area,description,photo)
                        VALUES(?,?,?,?,?,?,?)''',
                    (tracking_id, session['user_id'], name, category, area, description, filename))
    return jsonify(ok=True, trackingId=tracking_id)


def row_to_dict(row):
    return {k: row[k] for k in row.keys()}


@app.get('/api/track/<tracking_id>')
def track(tracking_id):
    with db() as con:
        row = con.execute('SELECT tracking_id,name,category,area,description,photo,status,admin_response,created_at,updated_at FROM suggestions WHERE tracking_id=?',
                          (tracking_id.strip().upper(),)).fetchone()
    if not row: return jsonify(error='No suggestion found for this tracking ID.'), 404
    result = row_to_dict(row); result['photoUrl'] = url_for('static', filename='uploads/' + result.pop('photo'))
    return jsonify(result)


@app.get('/api/admin/suggestions')
def admin_suggestions():
    if not is_admin(): return jsonify(error='Admin access required.'), 403
    status = request.args.get('status','').strip()
    search = request.args.get('q','').strip()
    sql = 'SELECT * FROM suggestions WHERE 1=1'; args=[]
    if status: sql += ' AND status=?'; args.append(status)
    if search:
        sql += ' AND (tracking_id LIKE ? OR name LIKE ? OR area LIKE ? OR category LIKE ?)'
        args += [f'%{search}%']*4
    sql += ' ORDER BY created_at DESC'
    with db() as con:
        rows = [row_to_dict(r) for r in con.execute(sql,args).fetchall()]
        stats = {s: con.execute('SELECT COUNT(*) FROM suggestions WHERE status=?',(s,)).fetchone()[0]
                 for s in ['Submitted','Under Review','In Progress','Resolved']}
        stats['Total'] = con.execute('SELECT COUNT(*) FROM suggestions').fetchone()[0]
    for r in rows: r['photoUrl'] = url_for('static', filename='uploads/' + r.pop('photo'))
    return jsonify(items=rows, stats=stats)


@app.patch('/api/admin/suggestions/<tracking_id>')
def update_suggestion(tracking_id):
    if not is_admin(): return jsonify(error='Admin access required.'), 403
    data = request.get_json(silent=True) or {}; status=data.get('status',''); response=data.get('admin_response','').strip()
    if status not in ['Submitted','Under Review','In Progress','Resolved']:
        return jsonify(error='Choose a valid status.'), 400
    with db() as con:
        cur = con.execute('UPDATE suggestions SET status=?, admin_response=?, updated_at=CURRENT_TIMESTAMP WHERE tracking_id=?',
                          (status,response,tracking_id.upper()))
    if not cur.rowcount: return jsonify(error='Suggestion not found.'), 404
    return jsonify(ok=True)


@app.delete('/api/admin/suggestions/<tracking_id>')
def delete_suggestion(tracking_id):
    if not is_admin(): return jsonify(error='Admin access required.'), 403
    with db() as con:
        row = con.execute('SELECT photo FROM suggestions WHERE tracking_id=?',(tracking_id.upper(),)).fetchone()
        if not row: return jsonify(error='Suggestion not found.'), 404
        con.execute('DELETE FROM suggestions WHERE tracking_id=?',(tracking_id.upper(),))
    try: (UPLOAD_DIR / row['photo']).unlink(missing_ok=True)
    except OSError: pass
    return jsonify(ok=True)


@app.errorhandler(413)
def too_large(_): return jsonify(error='Upload too large. Photo must be 5 MB or smaller.'), 413


init_db()
if __name__ == '__main__':
    app.run(debug=True)
