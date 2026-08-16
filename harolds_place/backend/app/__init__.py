import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address, default_limits=["300 per hour"])


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    database_url = os.getenv("DATABASE_URL", "sqlite:///harolds-place.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        JWT_SECRET_KEY=os.getenv("JWT_SECRET_KEY", "unsafe-development-only"),
        JWT_ACCESS_TOKEN_EXPIRES=int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "30")) * 60,
        CORS_ORIGINS=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()],
        PAYSTACK_PUBLIC_KEY=os.getenv("PAYSTACK_PUBLIC_KEY", ""),
        PAYSTACK_SECRET_KEY=os.getenv("PAYSTACK_SECRET_KEY", ""),
        PAYSTACK_CALLBACK_URL=os.getenv("PAYSTACK_CALLBACK_URL", ""),
        IMAGE_STORAGE_MODE=os.getenv("IMAGE_STORAGE_MODE", "unconfigured"),
        MAX_CONTENT_LENGTH=int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", "5242880")),
        RATELIMIT_STORAGE_URI=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
        TESTING=False,
    )
    if test_config:
        app.config.update(test_config)

    if app.config["ENV"] if "ENV" in app.config else os.getenv("FLASK_ENV") == "production":
        if app.config["JWT_SECRET_KEY"] == "unsafe-development-only":
            raise RuntimeError("JWT_SECRET_KEY must be configured in production")

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=False)

    from app.routes import api

    app.register_blueprint(api)

    @app.errorhandler(404)
    def not_found(_: Exception):
        return jsonify(error={"code": "NOT_FOUND", "message": "The requested resource was not found."}), 404

    @app.errorhandler(413)
    def file_too_large(_: Exception):
        return jsonify(error={"code": "FILE_TOO_LARGE", "message": "The uploaded image exceeds the configured size limit."}), 413

    return app
