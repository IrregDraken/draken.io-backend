import enum
import uuid
from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from app import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    KITCHEN = "KITCHEN"
    DELIVERY = "DELIVERY"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    PREPARING = "PREPARING"
    READY = "READY"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    VERIFYING = "VERIFYING"


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    email = db.Column(db.String(254), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum(UserRole, native_enum=False), nullable=False, default=UserRole.CUSTOMER, index=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def verifies_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Restaurant(db.Model):
    __tablename__ = "restaurants"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    name = db.Column(db.String(160), nullable=False)
    is_configured = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    settings = db.relationship("RestaurantSettings", back_populates="restaurant", uselist=False, cascade="all, delete-orphan")


class RestaurantSettings(db.Model):
    __tablename__ = "restaurant_settings"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    restaurant_id = db.Column(db.String(36), db.ForeignKey("restaurants.id", ondelete="CASCADE"), unique=True, nullable=False)
    is_open = db.Column(db.Boolean, nullable=False, default=False)
    pickup_enabled = db.Column(db.Boolean, nullable=False, default=False)
    delivery_enabled = db.Column(db.Boolean, nullable=False, default=False)
    delivery_fee_kobo = db.Column(db.Integer, nullable=False, default=0)
    minimum_order_kobo = db.Column(db.Integer, nullable=True)
    address = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(32), nullable=True)
    hours_note = db.Column(db.String(255), nullable=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    restaurant = db.relationship("Restaurant", back_populates="settings")


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    restaurant_id = db.Column(db.String(36), db.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_archived = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class MenuItem(db.Model):
    __tablename__ = "menu_items"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    restaurant_id = db.Column(db.String(36), db.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.String(36), db.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price_kobo = db.Column(db.Integer, nullable=False)
    prep_minutes = db.Column(db.Integer, nullable=True)
    is_available = db.Column(db.Boolean, nullable=False, default=False)
    is_archived = db.Column(db.Boolean, nullable=False, default=False)
    image_url = db.Column(db.String(1024), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    options = db.relationship("MenuItemOption", back_populates="menu_item", cascade="all, delete-orphan")


class MenuItemOption(db.Model):
    __tablename__ = "menu_item_options"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    menu_item_id = db.Column(db.String(36), db.ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    price_delta_kobo = db.Column(db.Integer, nullable=False, default=0)
    is_available = db.Column(db.Boolean, nullable=False, default=True)
    menu_item = db.relationship("MenuItem", back_populates="options")


class Address(db.Model):
    __tablename__ = "addresses"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    label = db.Column(db.String(80), nullable=False)
    address_line = db.Column(db.String(255), nullable=False)
    landmark = db.Column(db.String(255), nullable=True)
    phone = db.Column(db.String(32), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class Order(db.Model):
    __tablename__ = "orders"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    public_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    restaurant_id = db.Column(db.String(36), db.ForeignKey("restaurants.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    fulfillment_type = db.Column(db.String(16), nullable=False)
    status = db.Column(db.Enum(OrderStatus, native_enum=False), nullable=False, default=OrderStatus.PENDING, index=True)
    payment_status = db.Column(db.Enum(PaymentStatus, native_enum=False), nullable=False, default=PaymentStatus.PENDING)
    customer_name = db.Column(db.String(120), nullable=False)
    customer_phone = db.Column(db.String(32), nullable=False)
    customer_email = db.Column(db.String(254), nullable=True)
    delivery_address = db.Column(db.Text, nullable=True)
    customer_note = db.Column(db.Text, nullable=True)
    subtotal_kobo = db.Column(db.Integer, nullable=False)
    delivery_fee_kobo = db.Column(db.Integer, nullable=False, default=0)
    total_kobo = db.Column(db.Integer, nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    accepted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    preparing_at = db.Column(db.DateTime(timezone=True), nullable=True)
    ready_at = db.Column(db.DateTime(timezone=True), nullable=True)
    dispatched_at = db.Column(db.DateTime(timezone=True), nullable=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    cancelled_at = db.Column(db.DateTime(timezone=True), nullable=True)
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    history = db.relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")


class OrderItem(db.Model):
    __tablename__ = "order_items"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    order_id = db.Column(db.String(36), db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_item_id = db.Column(db.String(36), db.ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True)
    name_snapshot = db.Column(db.String(160), nullable=False)
    unit_price_kobo = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    options_snapshot = db.Column(db.JSON, nullable=False, default=list)
    special_instructions = db.Column(db.Text, nullable=True)
    order = db.relationship("Order", back_populates="items")


class OrderStatusHistory(db.Model):
    __tablename__ = "order_status_history"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    order_id = db.Column(db.String(36), db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = db.Column(db.String(32), nullable=True)
    to_status = db.Column(db.String(32), nullable=False)
    actor_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    order = db.relationship("Order", back_populates="history")


class Payment(db.Model):
    __tablename__ = "payments"
    id = db.Column(db.String(36), primary_key=True, default=new_id)
    order_id = db.Column(db.String(36), db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = db.Column(db.String(32), nullable=False)
    reference = db.Column(db.String(160), unique=True, nullable=False)
    amount_kobo = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Enum(PaymentStatus, native_enum=False), nullable=False, default=PaymentStatus.PENDING)
    provider_response = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class IdempotencyKey(db.Model):
    __tablename__ = "idempotency_keys"
    key = db.Column(db.String(160), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    route = db.Column(db.String(160), nullable=False)
    response_code = db.Column(db.Integer, nullable=False)
    response_body = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
