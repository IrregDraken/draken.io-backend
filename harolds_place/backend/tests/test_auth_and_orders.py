from app import db
from app.models import Category, MenuItem, OrderStatus, Restaurant, RestaurantSettings, User, UserRole
import hashlib
import hmac

from app.orders import TransitionError, transition_order
from app.payments import PaystackClient


def register_and_login(client, email="customer@example.test"):
    register = client.post("/api/v1/auth/register", json={"email": email, "password": "very-secure-password", "displayName": "Test Customer"})
    assert register.status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "very-secure-password"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json['accessToken']}"}


def configured_menu(app):
    with app.app_context():
        restaurant = Restaurant(name="THE HAROLD'S PLACE", is_configured=True)
        restaurant.settings = RestaurantSettings(is_open=True, pickup_enabled=True, delivery_enabled=True, delivery_fee_kobo=500)
        db.session.add(restaurant)
        db.session.flush()
        category = Category(restaurant_id=restaurant.id, name="Confirmed category")
        db.session.add(category)
        db.session.flush()
        item = MenuItem(restaurant_id=restaurant.id, category_id=category.id, name="Confirmed item", price_kobo=1500, is_available=True)
        db.session.add(item)
        db.session.commit()
        return restaurant.id, item.id


def test_register_and_menu_empty_state(client):
    headers = register_and_login(client)
    assert client.get("/api/v1/me", headers=headers).status_code == 200
    response = client.get("/api/v1/menu")
    assert response.status_code == 200
    assert response.json["items"] == []
    assert response.json["isConfigured"] is False


def test_order_creation_recalculates_server_total(app, client):
    restaurant_id, item_id = configured_menu(app)
    headers = register_and_login(client)
    response = client.post("/api/v1/orders", headers={**headers, "Idempotency-Key": "test-order-key"}, json={"restaurantId": restaurant_id, "fulfillmentType": "DELIVERY", "customerName": "Test Customer", "customerPhone": "+2347000000000", "deliveryAddress": "Confirmed test address", "items": [{"menuItemId": item_id, "quantity": 2}], "totalKobo": 1})
    assert response.status_code == 201
    assert response.json["order"]["totals"] == {"subtotalKobo": 3000, "deliveryFeeKobo": 500, "totalKobo": 3500, "currency": "NGN"}
    replay = client.post("/api/v1/orders", headers={**headers, "Idempotency-Key": "test-order-key"}, json={"restaurantId": restaurant_id, "fulfillmentType": "DELIVERY", "customerName": "Test Customer", "customerPhone": "+2347000000000", "deliveryAddress": "Confirmed test address", "items": [{"menuItemId": item_id, "quantity": 2}]})
    assert replay.status_code == 201
    assert replay.json == response.json


def test_state_machine_blocks_invalid_delivery_completion(app):
    with app.app_context():
        restaurant = Restaurant(name="x", is_configured=True)
        restaurant.settings = RestaurantSettings(is_open=True)
        manager = User(email="manager@example.test", display_name="Manager", role=UserRole.MANAGER)
        manager.set_password("very-secure-password")
        from app.models import Order
        db.session.add_all([restaurant, manager])
        db.session.flush()
        order = Order(public_number="HP-TEST", restaurant_id=restaurant.id, fulfillment_type="DELIVERY", status=OrderStatus.READY, customer_name="Customer", customer_phone="1", subtotal_kobo=0, total_kobo=0)
        db.session.add(order)
        db.session.flush()
        try:
            transition_order(order, OrderStatus.COMPLETED, manager.id, manager.role)
            assert False, "delivery completion must be rejected before dispatch"
        except TransitionError:
            assert order.status == OrderStatus.READY


def test_paystack_signature_requires_the_raw_body_and_secret(app):
    with app.app_context():
        app.config['PAYSTACK_SECRET_KEY'] = 'paystack-test-secret'
        raw_body = b'{"event":"charge.success"}'
        signature = hmac.new(b'paystack-test-secret', raw_body, hashlib.sha512).hexdigest()
        assert PaystackClient.webhook_is_valid(raw_body, signature)
        assert not PaystackClient.webhook_is_valid(raw_body, 'not-a-signature')
