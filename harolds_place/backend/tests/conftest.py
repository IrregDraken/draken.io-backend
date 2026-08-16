import pytest

from app import create_app, db


@pytest.fixture()
def app(tmp_path):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path}/test.db", "JWT_SECRET_KEY": "test-secret-key-with-adequate-length-123", "RATELIMIT_ENABLED": False})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()
