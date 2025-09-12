from flask import Flask
import os


def create_app():
    app = Flask(__name__)

    # Basic config
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static', 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB

    # Ensure directories exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.root_path, '..', 'data'), exist_ok=True)

    from .routes import bp as main_bp
    app.register_blueprint(main_bp)

    return app


