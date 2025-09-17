import json
import os
import uuid
from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, make_response
from werkzeug.utils import secure_filename
from .utils import fetch_all, fetch_one, execute, create_session, get_current_user

bp = Blueprint('main', __name__)


DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
SUBMISSIONS_FILE = os.path.abspath(os.path.join(DATA_DIR, 'submissions.json'))
MESSAGES_FILE = os.path.abspath(os.path.join(DATA_DIR, 'messages.json'))

ALLOWED_EXTENSIONS = {
    'image': {'png', 'jpg', 'jpeg', 'gif', 'webp'},
    'video': {'mp4', 'webm', 'mov'},
    'audio': {'mp3', 'wav', 'ogg'},
    'text': {'txt', 'md'}
}


def load_json(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def allowed_file(filename):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    for _cat, exts in ALLOWED_EXTENSIONS.items():
        if ext in exts:
            return True
    return False


def detect_media_type(filename):
    ext = filename.rsplit('.', 1)[1].lower()
    for cat, exts in ALLOWED_EXTENSIONS.items():
        if ext in exts:
            return cat
    return 'file'


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/about')
def about():
    return render_template('about.html')


def login_required():
    user = get_current_user()
    if not user:
        return False
    return True


@bp.route('/submit', methods=['GET', 'POST'])
def submit():
    if not login_required():
        flash('Please log in to submit your work.', 'error')
        return redirect(url_for('main.login'))
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        age = request.form.get('age', '').strip()
        country = request.form.get('country', '').strip()
        category = request.form.get('category', '').strip()
        theme = request.form.get('theme', '').strip()
        description = request.form.get('description', '').strip()
        file = request.files.get('file')

        if not name or not age or not country or not category or not description or not file:
            flash('Please complete all required fields and attach a file.', 'error')
            return redirect(url_for('main.submit'))

        try:
            age_int = int(age)
        except ValueError:
            flash('Age must be a number.', 'error')
            return redirect(url_for('main.submit'))

        if not allowed_file(file.filename):
            flash('Unsupported file type.', 'error')
            return redirect(url_for('main.submit'))

        filename = secure_filename(file.filename)
        unique_name = f"{uuid.uuid4().hex}_{filename}"

        upload_folder = bp._get_current_object().app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        save_path = os.path.join(upload_folder, unique_name)
        file.save(save_path)

        media_type = detect_media_type(filename)

        # store to projects and uploads tables if present
        project_id = execute(
            "INSERT INTO projects(title, description, theme, created_at, status) VALUES(?, ?, ?, ?, ?)",
            (category, description, theme, datetime.utcnow().isoformat() + 'Z', 'pending')
        )
        execute(
            "INSERT INTO uploads(project_id, file_name, media_type, created_at) VALUES(?, ?, ?, ?)",
            (project_id, unique_name, media_type, datetime.utcnow().isoformat() + 'Z')
        )

        flash('Thank you! Your submission was received.', 'success')
        return redirect(url_for('main.gallery'))

    return render_template('submit.html')


@bp.route('/gallery')
def gallery():
    if not login_required():
        flash('Please log in to view the gallery.', 'error')
        return redirect(url_for('main.login'))
    theme = request.args.get('theme', '').strip()
    try:
        rows = fetch_all(
            "SELECT p.id, p.title as category, p.description, p.theme, u.file_name as filename, u.media_type, p.created_at FROM projects p LEFT JOIN uploads u ON u.project_id = p.id WHERE p.status = 'approved'"
        )
        submissions = []
        for r in rows:
            submissions.append({
                'category': r['category'],
                'description': r['description'],
                'theme': r['theme'],
                'filename': r['filename'],
                'media_type': r['media_type'],
                'created_at': r['created_at']
            })
    except Exception:
        submissions = []
    if theme:
        submissions = [s for s in submissions if (s.get('theme') or '').lower() == theme.lower()]
    submissions.sort(key=lambda s: s.get('created_at', ''), reverse=True)
    themes = sorted({(s.get('theme') or '').strip() for s in submissions if s.get('theme')})
    return render_template('gallery.html', submissions=submissions, theme=theme, themes=themes)


@bp.route('/events')
def events():
    return render_template('events.html')


@bp.route('/partners')
def partners():
    # Example partners; in real usage, populate dynamically or from config
    sample_partners = [
        {'name': 'Earth Partner', 'logo': 'logos/earth-partner.png', 'url': '#'},
        {'name': 'Youth Climate Network', 'logo': 'logos/ycn.png', 'url': '#'},
        {'name': 'Green Schools', 'logo': 'logos/greens.png', 'url': '#'}
    ]
    return render_template('partners.html', partners=sample_partners)


@bp.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        message = request.form.get('message', '').strip()
        if not name or not email or not message:
            flash('Please fill in all fields.', 'error')
            return redirect(url_for('main.contact'))

        messages = load_json(MESSAGES_FILE)
        messages.append({
            'id': uuid.uuid4().hex,
            'name': name,
            'email': email,
            'message': message,
            'created_at': datetime.utcnow().isoformat() + 'Z'
        })
        save_json(MESSAGES_FILE, messages)
        flash('Thanks! We will get back to you soon.', 'success')
        return redirect(url_for('main.contact'))

    return render_template('contact.html')


# Authentication routes
@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        if not email or not password:
            flash('Email and password are required.', 'error')
            return redirect(url_for('main.login'))
        user = fetch_one("SELECT * FROM users WHERE email = ?", (email,))
        if not user or (user and user.get('password') and user['password'] != password):
            flash('Invalid credentials.', 'error')
            return redirect(url_for('main.login'))
        token, _ = create_session(user['id'])
        resp = make_response(redirect(url_for('main.index')))
        resp.set_cookie('session_token', token, httponly=True, samesite='Lax')
        return resp
    return render_template('login.html')


@bp.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        country = request.form.get('country', '').strip()
        dob = request.form.get('dob', '').strip()
        password = request.form.get('password', '').strip()
        terms = request.form.get('terms')
        if not name or not email or not country or not dob or not password or not terms:
            flash('All fields and terms acceptance are required.', 'error')
            return redirect(url_for('main.signup'))
        # naive age check from dob (YYYY-MM-DD)
        try:
            year = int(dob.split('-')[0])
            age = datetime.utcnow().year - year
            if age < 14 or age > 30:
                flash('Age must be between 14 and 30.', 'error')
                return redirect(url_for('main.signup'))
        except Exception:
            flash('Invalid date of birth.', 'error')
            return redirect(url_for('main.signup'))
        try:
            execute(
                "INSERT INTO users(name, email, country, dob, password, created_at) VALUES(?, ?, ?, ?, ?, ?)",
                (name, email, country, dob, password, datetime.utcnow().isoformat() + 'Z')
            )
        except Exception:
            flash('Email already exists or database error.', 'error')
            return redirect(url_for('main.signup'))
        flash('Account created. Please log in.', 'success')
        return redirect(url_for('main.login'))
    return render_template('signup.html')


@bp.route('/logout')
def logout():
    resp = make_response(redirect(url_for('main.index')))
    resp.delete_cookie('session_token')
    return resp


