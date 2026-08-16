import re
from datetime import timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from sqlalchemy import text

from app import db, limiter
from app.models import (
    Address,
    Category,
    IdempotencyKey,
    MenuItem,
    MenuItemOption,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentStatus,
    Restaurant,
    RestaurantSettings,
    User,
    UserRole,
)
from app.orders import TransitionError, order_payload, transition_order
from app.payments import PaymentUnavailable, PaystackClient, payment_reference
from app.security import current_user, error, roles_required

api = Blueprint("api", __name__)


def body() -> dict:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise ValueError("A JSON object is required.")
    return payload


def string_value(payload: dict, key: str, *, min_length: int = 1, maximum: int = 255, required: bool = True) -> str | None:
    value = payload.get(key)
    if value is None and not required:
        return None
    if not isinstance(value, str) or not min_length <= len(value.strip()) <= maximum:
        raise ValueError(f"{key} must be between {min_length} and {maximum} characters.")
    return value.strip()


def current_restaurant() -> Restaurant | None:
    return Restaurant.query.order_by(Restaurant.created_at.asc()).first()


def menu_item_payload(item: MenuItem) -> dict:
    return {
        "id": item.id,
        "categoryId": item.category_id,
        "name": item.name,
        "description": item.description,
        "priceKobo": item.price_kobo,
        "prepMinutes": item.prep_minutes,
        "isAvailable": item.is_available and not item.is_archived,
        "imageUrl": item.image_url,
        "options": [{"id": option.id, "name": option.name, "priceDeltaKobo": option.price_delta_kobo, "isAvailable": option.is_available} for option in item.options],
    }


@api.get("/health/live")
def live():
    return jsonify(status="ok")


@api.get("/health/ready")
def ready():
    try:
        db.session.execute(text("SELECT 1"))
        configured = bool(current_app.config["JWT_SECRET_KEY"] != "unsafe-development-only")
        return jsonify(status="ok" if configured else "unconfigured", database="ok", payment="configured" if current_app.config["PAYSTACK_SECRET_KEY"] else "unconfigured"), 200 if configured else 503
    except Exception:
        return jsonify(status="error", database="unavailable"), 503


@api.post("/api/v1/auth/register")
@limiter.limit("8 per hour")
def register():
    try:
        payload = body()
        email = string_value(payload, "email", maximum=254).lower()
        password = string_value(payload, "password", min_length=12, maximum=128)
        display_name = string_value(payload, "displayName", maximum=120)
    except ValueError as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return error("VALIDATION_ERROR", "email must be a valid email address.", 422)
    if User.query.filter_by(email=email).first():
        return error("EMAIL_IN_USE", "An account already exists for this email address.", 409)
    user = User(email=email, display_name=display_name, role=UserRole.CUSTOMER)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(user={"id": user.id, "email": user.email, "displayName": user.display_name, "role": user.role.value}), 201


@api.post("/api/v1/auth/login")
@limiter.limit("10 per hour")
def login():
    try:
        payload = body()
        email = string_value(payload, "email", maximum=254).lower()
        password = string_value(payload, "password", min_length=1, maximum=128)
    except ValueError as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    user = User.query.filter_by(email=email).first()
    if not user or not user.is_active or not user.verifies_password(password):
        return error("AUTH_INVALID", "Email or password is incorrect.", 401)
    token = create_access_token(identity=user.id, expires_delta=timedelta(seconds=current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]))
    return jsonify(accessToken=token, user={"id": user.id, "email": user.email, "displayName": user.display_name, "role": user.role.value})


@api.get("/api/v1/me")
@jwt_required()
def me():
    user = current_user()
    if not user or not user.is_active:
        return error("AUTH_INVALID", "Your session is no longer valid.", 401)
    return jsonify(user={"id": user.id, "email": user.email, "displayName": user.display_name, "role": user.role.value})


@api.get("/api/v1/restaurant")
def restaurant_details():
    restaurant = current_restaurant()
    if not restaurant:
        return jsonify(restaurant=None, isConfigured=False)
    settings = restaurant.settings
    return jsonify(
        restaurant={
            "id": restaurant.id,
            "name": restaurant.name,
            "isConfigured": restaurant.is_configured,
            "settings": None if not settings else {"isOpen": settings.is_open, "pickupEnabled": settings.pickup_enabled, "deliveryEnabled": settings.delivery_enabled, "address": settings.address, "phone": settings.phone, "hoursNote": settings.hours_note},
        }
    )


@api.get("/api/v1/menu")
def menu():
    restaurant = current_restaurant()
    if not restaurant:
        return jsonify(items=[], categories=[], isConfigured=False)
    query = MenuItem.query.filter_by(restaurant_id=restaurant.id, is_archived=False, is_available=True)
    search = request.args.get("search", "").strip()
    category_id = request.args.get("category")
    if search:
        query = query.filter(MenuItem.name.ilike(f"%{search}%"))
    if category_id:
        query = query.filter_by(category_id=category_id)
    categories = Category.query.filter_by(restaurant_id=restaurant.id, is_archived=False).order_by(Category.sort_order.asc()).all()
    return jsonify(items=[menu_item_payload(item) for item in query.order_by(MenuItem.name.asc()).all()], categories=[{"id": category.id, "name": category.name} for category in categories], isConfigured=restaurant.is_configured)


@api.get("/api/v1/menu/items/<item_id>")
def menu_item(item_id: str):
    item = db.session.get(MenuItem, item_id)
    if not item or item.is_archived or not item.is_available:
        return error("MENU_ITEM_NOT_FOUND", "That menu item is not available.", 404)
    return jsonify(item=menu_item_payload(item))


@api.post("/api/v1/orders")
@jwt_required()
def create_order():
    user = current_user()
    if not user or user.role != UserRole.CUSTOMER:
        return error("FORBIDDEN", "Customer authentication is required to place an order.", 403)
    idempotency_key = request.headers.get("Idempotency-Key", "").strip()
    if not idempotency_key or len(idempotency_key) > 160:
        return error("IDEMPOTENCY_REQUIRED", "A valid Idempotency-Key header is required to place an order.", 422)
    existing = db.session.get(IdempotencyKey, idempotency_key)
    if existing:
        return jsonify(existing.response_body), existing.response_code
    try:
        payload = body()
        restaurant_id = string_value(payload, "restaurantId", maximum=36)
        fulfillment_type = string_value(payload, "fulfillmentType", maximum=16).upper()
        customer_name = string_value(payload, "customerName", maximum=120)
        customer_phone = string_value(payload, "customerPhone", maximum=32)
        delivery_address = string_value(payload, "deliveryAddress", maximum=1000, required=False)
        note = string_value(payload, "note", maximum=1000, required=False)
        raw_items = payload.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise ValueError("items must include at least one menu item.")
    except ValueError as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    restaurant = db.session.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.settings or not restaurant.is_configured:
        return error("RESTAURANT_UNCONFIGURED", "Ordering is not available until the restaurant completes setup.", 409)
    settings = restaurant.settings
    if not settings.is_open:
        return error("RESTAURANT_CLOSED", "The restaurant is not accepting orders right now.", 409)
    if fulfillment_type not in {"PICKUP", "DELIVERY"}:
        return error("VALIDATION_ERROR", "fulfillmentType must be PICKUP or DELIVERY.", 422)
    if fulfillment_type == "PICKUP" and not settings.pickup_enabled:
        return error("PICKUP_UNAVAILABLE", "Pickup is not currently available.", 409)
    if fulfillment_type == "DELIVERY" and (not settings.delivery_enabled or not delivery_address):
        return error("DELIVERY_UNAVAILABLE", "Delivery is not currently available for this order.", 409)

    item_ids = [line.get("menuItemId") for line in raw_items if isinstance(line, dict)]
    if len(item_ids) != len(raw_items) or any(not isinstance(item_id, str) for item_id in item_ids):
        return error("VALIDATION_ERROR", "Each order item must include menuItemId.", 422)
    menu_items = {item.id: item for item in MenuItem.query.filter(MenuItem.id.in_(item_ids), MenuItem.restaurant_id == restaurant.id).with_for_update().all()}
    if len(menu_items) != len(set(item_ids)):
        return error("MENU_ITEM_NOT_FOUND", "One or more menu items are no longer available.", 409)

    subtotal = 0
    order_items = []
    for raw_line in raw_items:
        item = menu_items[raw_line["menuItemId"]]
        quantity = raw_line.get("quantity")
        if not isinstance(quantity, int) or quantity < 1 or quantity > 20:
            return error("VALIDATION_ERROR", "Each item quantity must be between 1 and 20.", 422)
        if not item.is_available or item.is_archived:
            return error("OUT_OF_STOCK", f"{item.name} is no longer available.", 409)
        requested_option_ids = raw_line.get("optionIds", [])
        if not isinstance(requested_option_ids, list) or any(not isinstance(option_id, str) for option_id in requested_option_ids):
            return error("VALIDATION_ERROR", "optionIds must be a list of option IDs.", 422)
        options = [option for option in item.options if option.id in requested_option_ids]
        if len(options) != len(set(requested_option_ids)) or any(not option.is_available for option in options):
            return error("OPTION_UNAVAILABLE", f"A selected option for {item.name} is no longer available.", 409)
        unit_price = item.price_kobo + sum(option.price_delta_kobo for option in options)
        subtotal += unit_price * quantity
        order_items.append(OrderItem(menu_item_id=item.id, name_snapshot=item.name, unit_price_kobo=unit_price, quantity=quantity, options_snapshot=[{"id": option.id, "name": option.name, "priceDeltaKobo": option.price_delta_kobo} for option in options], special_instructions=str(raw_line.get("specialInstructions", "")).strip()[:1000] or None))
    if settings.minimum_order_kobo and subtotal < settings.minimum_order_kobo:
        return error("MINIMUM_ORDER", "The order does not meet the restaurant's minimum order amount.", 409)
    delivery_fee = settings.delivery_fee_kobo if fulfillment_type == "DELIVERY" else 0
    order = Order(public_number=f"HP-{__import__('uuid').uuid4().hex[:8].upper()}", restaurant_id=restaurant.id, customer_id=user.id, fulfillment_type=fulfillment_type, customer_name=customer_name, customer_phone=customer_phone, customer_email=user.email, delivery_address=delivery_address, customer_note=note, subtotal_kobo=subtotal, delivery_fee_kobo=delivery_fee, total_kobo=subtotal + delivery_fee)
    order.items = order_items
    db.session.add(order)
    db.session.flush()
    db.session.add(OrderStatusHistory(order=order, from_status=None, to_status=OrderStatus.PENDING.value, actor_id=user.id, note="Order created"))
    response_body = {"order": order_payload(order)}
    db.session.add(IdempotencyKey(key=idempotency_key, user_id=user.id, route="POST /api/v1/orders", response_code=201, response_body=response_body))
    db.session.commit()
    return jsonify(response_body), 201


@api.get("/api/v1/orders")
@jwt_required()
def customer_orders():
    user = current_user()
    if not user or user.role != UserRole.CUSTOMER:
        return error("FORBIDDEN", "Customer authentication is required.", 403)
    orders = Order.query.filter_by(customer_id=user.id).order_by(Order.created_at.desc()).all()
    return jsonify(orders=[order_payload(order) for order in orders])


@api.get("/api/v1/orders/<order_id>")
@jwt_required()
def customer_order(order_id: str):
    user = current_user()
    order = db.session.get(Order, order_id)
    if not user or not order or (user.role == UserRole.CUSTOMER and order.customer_id != user.id):
        return error("ORDER_NOT_FOUND", "That order could not be found.", 404)
    return jsonify(order=order_payload(order))


@api.post("/api/v1/orders/<order_id>/cancel")
@jwt_required()
def cancel_order(order_id: str):
    user = current_user()
    order = db.session.get(Order, order_id)
    if not user or not order or order.customer_id != user.id:
        return error("ORDER_NOT_FOUND", "That order could not be found.", 404)
    if order.status != OrderStatus.PENDING:
        return error("CANCELLATION_UNAVAILABLE", "This order can no longer be cancelled online.", 409)
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
    order.version += 1
    db.session.add(OrderStatusHistory(order=order, from_status=OrderStatus.PENDING.value, to_status=OrderStatus.CANCELLED.value, actor_id=user.id, note="Cancelled by customer"))
    db.session.commit()
    return jsonify(order=order_payload(order))


@api.get("/api/v1/staff/dashboard")
@roles_required(UserRole.OWNER, UserRole.MANAGER, UserRole.KITCHEN, UserRole.DELIVERY)
def staff_dashboard():
    restaurant = current_restaurant()
    if not restaurant:
        return jsonify(restaurantConfigured=False, counts={"pending": 0, "preparing": 0, "ready": 0, "completed": 0}, todaySalesKobo=0)
    orders = Order.query.filter_by(restaurant_id=restaurant.id).all()
    return jsonify(
        restaurantConfigured=restaurant.is_configured,
        counts={
            "pending": sum(order.status == OrderStatus.PENDING for order in orders),
            "preparing": sum(order.status == OrderStatus.PREPARING for order in orders),
            "ready": sum(order.status == OrderStatus.READY for order in orders),
            "completed": sum(order.status == OrderStatus.COMPLETED for order in orders),
        },
        todaySalesKobo=sum(order.total_kobo for order in orders if order.status == OrderStatus.COMPLETED),
    )


@api.get("/api/v1/staff/orders")
@roles_required(UserRole.OWNER, UserRole.MANAGER, UserRole.KITCHEN, UserRole.DELIVERY)
def staff_orders():
    restaurant = current_restaurant()
    if not restaurant:
        return jsonify(orders=[])
    orders = Order.query.filter_by(restaurant_id=restaurant.id).order_by(Order.created_at.desc()).all()
    return jsonify(orders=[order_payload(order) for order in orders])


@api.get("/api/v1/staff/orders/<order_id>")
@roles_required(UserRole.OWNER, UserRole.MANAGER, UserRole.KITCHEN, UserRole.DELIVERY)
def staff_order(order_id: str):
    restaurant = current_restaurant()
    order = db.session.get(Order, order_id)
    if not restaurant or not order or order.restaurant_id != restaurant.id:
        return error("ORDER_NOT_FOUND", "That order could not be found.", 404)
    return jsonify(order=order_payload(order))


@api.patch("/api/v1/staff/orders/<order_id>/status")
@roles_required(UserRole.OWNER, UserRole.MANAGER, UserRole.KITCHEN, UserRole.DELIVERY)
def update_order_status(order_id: str):
    restaurant = current_restaurant()
    order = db.session.get(Order, order_id)
    if not restaurant or not order or order.restaurant_id != restaurant.id:
        return error("ORDER_NOT_FOUND", "That order could not be found.", 404)
    try:
        payload = body()
        status = OrderStatus(string_value(payload, "status", maximum=32).upper())
    except (ValueError, KeyError) as exc:
        return error("VALIDATION_ERROR", f"status is invalid: {exc}", 422)
    try:
        actor = current_user()
        transition_order(order, status, actor.id, actor.role, string_value(payload, "note", maximum=1000, required=False))
    except TransitionError as exc:
        return error("INVALID_TRANSITION", str(exc), 409)
    db.session.commit()
    return jsonify(order=order_payload(order))


@api.get("/api/v1/staff/categories")
@roles_required(UserRole.OWNER, UserRole.MANAGER)
def staff_categories():
    restaurant = current_restaurant()
    categories = [] if not restaurant else Category.query.filter_by(restaurant_id=restaurant.id, is_archived=False).order_by(Category.sort_order.asc()).all()
    return jsonify(categories=[{"id": category.id, "name": category.name, "sortOrder": category.sort_order} for category in categories])


@api.post("/api/v1/staff/categories")
@roles_required(UserRole.OWNER, UserRole.MANAGER)
def create_category():
    restaurant = current_restaurant()
    if not restaurant:
        return error("RESTAURANT_UNCONFIGURED", "Create restaurant configuration before adding a category.", 409)
    try:
        payload = body()
        category = Category(restaurant_id=restaurant.id, name=string_value(payload, "name", maximum=100), sort_order=int(payload.get("sortOrder", 0)))
    except (ValueError, TypeError) as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    db.session.add(category)
    db.session.commit()
    return jsonify(category={"id": category.id, "name": category.name, "sortOrder": category.sort_order}), 201


@api.get("/api/v1/staff/menu-items")
@roles_required(UserRole.OWNER, UserRole.MANAGER)
def staff_menu_items():
    restaurant = current_restaurant()
    items = [] if not restaurant else MenuItem.query.filter_by(restaurant_id=restaurant.id, is_archived=False).order_by(MenuItem.name.asc()).all()
    return jsonify(items=[menu_item_payload(item) for item in items])


@api.post("/api/v1/staff/menu-items")
@roles_required(UserRole.OWNER, UserRole.MANAGER)
def create_menu_item():
    restaurant = current_restaurant()
    if not restaurant:
        return error("RESTAURANT_UNCONFIGURED", "Create restaurant configuration before adding a menu item.", 409)
    try:
        payload = body()
        category_id = string_value(payload, "categoryId", maximum=36)
        category = db.session.get(Category, category_id)
        if not category or category.restaurant_id != restaurant.id or category.is_archived:
            raise ValueError("categoryId does not reference an active restaurant category.")
        price_kobo = payload.get("priceKobo")
        if not isinstance(price_kobo, int) or price_kobo < 0:
            raise ValueError("priceKobo must be a non-negative integer in kobo.")
        item = MenuItem(restaurant_id=restaurant.id, category_id=category_id, name=string_value(payload, "name", maximum=160), description=string_value(payload, "description", maximum=2000, required=False), price_kobo=price_kobo, prep_minutes=payload.get("prepMinutes") if isinstance(payload.get("prepMinutes"), int) else None, is_available=bool(payload.get("isAvailable", False)))
    except ValueError as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    db.session.add(item)
    db.session.commit()
    return jsonify(item=menu_item_payload(item)), 201


@api.patch("/api/v1/staff/menu-items/<item_id>")
@roles_required(UserRole.OWNER, UserRole.MANAGER)
def update_menu_item(item_id: str):
    restaurant = current_restaurant()
    item = db.session.get(MenuItem, item_id)
    if not restaurant or not item or item.restaurant_id != restaurant.id:
        return error("MENU_ITEM_NOT_FOUND", "That menu item could not be found.", 404)
    try:
        payload = body()
        if "name" in payload:
            item.name = string_value(payload, "name", maximum=160)
        if "description" in payload:
            item.description = string_value(payload, "description", maximum=2000, required=False)
        if "priceKobo" in payload:
            if not isinstance(payload["priceKobo"], int) or payload["priceKobo"] < 0:
                raise ValueError("priceKobo must be a non-negative integer in kobo.")
            item.price_kobo = payload["priceKobo"]
        for input_key, field in {"prepMinutes": "prep_minutes", "isAvailable": "is_available", "isArchived": "is_archived"}.items():
            if input_key in payload:
                setattr(item, field, payload[input_key])
    except ValueError as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    db.session.commit()
    return jsonify(item=menu_item_payload(item))


@api.get("/api/v1/staff/settings")
@roles_required(UserRole.OWNER, UserRole.MANAGER)
def staff_settings():
    restaurant = current_restaurant()
    if not restaurant or not restaurant.settings:
        return jsonify(settings=None)
    settings = restaurant.settings
    return jsonify(settings={"isOpen": settings.is_open, "pickupEnabled": settings.pickup_enabled, "deliveryEnabled": settings.delivery_enabled, "deliveryFeeKobo": settings.delivery_fee_kobo, "minimumOrderKobo": settings.minimum_order_kobo, "address": settings.address, "phone": settings.phone, "hoursNote": settings.hours_note})


@api.patch("/api/v1/staff/settings")
@roles_required(UserRole.OWNER, UserRole.MANAGER)
def update_settings():
    restaurant = current_restaurant()
    if not restaurant:
        return error("RESTAURANT_UNCONFIGURED", "A restaurant record must be created first.", 409)
    settings = restaurant.settings or RestaurantSettings(restaurant_id=restaurant.id)
    try:
        payload = body()
        mappings = {"isOpen": "is_open", "pickupEnabled": "pickup_enabled", "deliveryEnabled": "delivery_enabled", "deliveryFeeKobo": "delivery_fee_kobo", "minimumOrderKobo": "minimum_order_kobo", "address": "address", "phone": "phone", "hoursNote": "hours_note"}
        for input_key, field in mappings.items():
            if input_key in payload:
                setattr(settings, field, payload[input_key])
        if settings.delivery_fee_kobo < 0 or (settings.minimum_order_kobo is not None and settings.minimum_order_kobo < 0):
            raise ValueError("Delivery fee and minimum order must not be negative.")
    except (TypeError, ValueError) as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    db.session.add(settings)
    db.session.commit()
    return staff_settings()


@api.post("/api/v1/payments/initialize")
@jwt_required()
def initialize_payment():
    user = current_user()
    try:
        payload = body()
        order_id = string_value(payload, "orderId", maximum=36)
    except ValueError as exc:
        return error("VALIDATION_ERROR", str(exc), 422)
    order = db.session.get(Order, order_id)
    if not user or not order or order.customer_id != user.id:
        return error("ORDER_NOT_FOUND", "That order could not be found.", 404)
    if order.payment_status == PaymentStatus.SUCCEEDED:
        return error("PAYMENT_ALREADY_SETTLED", "This order has already been paid.", 409)
    payment = Payment(order_id=order.id, provider="PAYSTACK", reference=payment_reference(order.id), amount_kobo=order.total_kobo)
    try:
        provider_response = PaystackClient().initialize(user.email, payment.amount_kobo, payment.reference, {"order_id": order.id, "order_number": order.public_number})
    except PaymentUnavailable as exc:
        return error("PAYMENT_UNAVAILABLE", str(exc), 503)
    except Exception:
        return error("PAYMENT_INITIALIZATION_FAILED", "The payment provider could not start this transaction. Please try again later.", 502)
    payment.provider_response = provider_response
    db.session.add(payment)
    db.session.commit()
    return jsonify(reference=payment.reference, authorizationUrl=provider_response.get("data", {}).get("authorization_url")), 201


def settle_payment_from_provider(reference: str) -> Payment:
    payment = Payment.query.filter_by(reference=reference, provider="PAYSTACK").first()
    if not payment:
        raise LookupError("Payment reference was not found.")
    provider_response = PaystackClient().verify(reference)
    data = provider_response.get("data", {})
    payment.provider_response = provider_response
    payment.status = PaymentStatus.SUCCEEDED if data.get("status") == "success" else PaymentStatus.FAILED
    order = db.session.get(Order, payment.order_id)
    order.payment_status = payment.status
    db.session.commit()
    return payment


@api.post("/api/v1/payments/verify")
@jwt_required()
def verify_payment():
    try:
        payload = body()
        reference = string_value(payload, "reference", maximum=160)
        payment = Payment.query.filter_by(reference=reference).first()
        user = current_user()
        order = db.session.get(Order, payment.order_id) if payment else None
        if not payment or not order or order.customer_id != user.id:
            return error("PAYMENT_NOT_FOUND", "That payment could not be found.", 404)
        payment = settle_payment_from_provider(reference)
    except PaymentUnavailable as exc:
        return error("PAYMENT_UNAVAILABLE", str(exc), 503)
    except LookupError:
        return error("PAYMENT_NOT_FOUND", "That payment could not be found.", 404)
    except Exception:
        return error("PAYMENT_VERIFICATION_FAILED", "The payment could not be verified. Please contact the restaurant if you were charged.", 502)
    return jsonify(payment={"reference": payment.reference, "status": payment.status.value})


@api.post("/api/v1/payments/webhook/paystack")
def paystack_webhook():
    raw_body = request.get_data(cache=True)
    if not PaystackClient.webhook_is_valid(raw_body, request.headers.get("x-paystack-signature")):
        return error("WEBHOOK_SIGNATURE_INVALID", "Webhook signature is invalid.", 401)
    event = request.get_json(silent=True) or {}
    reference = event.get("data", {}).get("reference")
    if not isinstance(reference, str):
        return jsonify(received=True)
    try:
        settle_payment_from_provider(reference)
    except (LookupError, PaymentUnavailable):
        return jsonify(received=True)
    except Exception:
        return error("WEBHOOK_PROCESSING_FAILED", "Payment event could not be processed.", 502)
    return jsonify(received=True)
