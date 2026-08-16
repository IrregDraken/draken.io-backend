from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app import db
from app.models import User, UserRole


def error(code: str, message: str, status: int, field_errors: dict | None = None):
    payload = {"error": {"code": code, "message": message}}
    if field_errors:
        payload["error"]["fieldErrors"] = field_errors
    return jsonify(payload), status


def current_user() -> User | None:
    identity = get_jwt_identity()
    return db.session.get(User, identity) if identity else None


def roles_required(*roles: UserRole):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            verify_jwt_in_request()
            user = current_user()
            if not user or not user.is_active:
                return error("AUTH_INVALID", "Your session is no longer valid.", 401)
            if user.role not in roles:
                return error("FORBIDDEN", "You do not have permission to perform this action.", 403)
            return fn(*args, **kwargs)

        return wrapped

    return decorator
