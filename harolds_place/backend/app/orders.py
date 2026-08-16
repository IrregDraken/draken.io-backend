from datetime import datetime, timezone

from app import db
from app.models import Order, OrderStatus, OrderStatusHistory, UserRole


class TransitionError(ValueError):
    pass


TRANSITIONS = {
    OrderStatus.PENDING: {OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED},
    OrderStatus.ACCEPTED: {OrderStatus.PREPARING, OrderStatus.CANCELLED},
    OrderStatus.PREPARING: {OrderStatus.READY},
    OrderStatus.READY: {OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED},
    OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.COMPLETED},
}

ROLE_ACTIONS = {
    OrderStatus.ACCEPTED: {UserRole.OWNER, UserRole.MANAGER},
    OrderStatus.REJECTED: {UserRole.OWNER, UserRole.MANAGER},
    OrderStatus.PREPARING: {UserRole.OWNER, UserRole.MANAGER, UserRole.KITCHEN},
    OrderStatus.READY: {UserRole.OWNER, UserRole.MANAGER, UserRole.KITCHEN},
    OrderStatus.OUT_FOR_DELIVERY: {UserRole.OWNER, UserRole.MANAGER, UserRole.DELIVERY},
    OrderStatus.COMPLETED: {UserRole.OWNER, UserRole.MANAGER, UserRole.DELIVERY},
}


def transition_order(order: Order, next_status: OrderStatus, actor_id: str, actor_role: UserRole, note: str | None = None) -> None:
    if next_status not in TRANSITIONS.get(order.status, set()):
        raise TransitionError("That status change is not valid for this order.")
    if actor_role not in ROLE_ACTIONS.get(next_status, set()):
        raise TransitionError("Your role cannot perform that status change.")
    if next_status == OrderStatus.OUT_FOR_DELIVERY and order.fulfillment_type != "DELIVERY":
        raise TransitionError("Only delivery orders can be dispatched.")
    if next_status == OrderStatus.COMPLETED and order.fulfillment_type == "DELIVERY" and order.status != OrderStatus.OUT_FOR_DELIVERY:
        raise TransitionError("A delivery order must be dispatched before completion.")

    previous = order.status
    order.status = next_status
    order.version += 1
    now = datetime.now(timezone.utc)
    stamp_column = {
        OrderStatus.ACCEPTED: "accepted_at",
        OrderStatus.PREPARING: "preparing_at",
        OrderStatus.READY: "ready_at",
        OrderStatus.OUT_FOR_DELIVERY: "dispatched_at",
        OrderStatus.COMPLETED: "completed_at",
        OrderStatus.REJECTED: "cancelled_at",
        OrderStatus.CANCELLED: "cancelled_at",
    }.get(next_status)
    if stamp_column:
        setattr(order, stamp_column, now)
    db.session.add(OrderStatusHistory(order=order, from_status=previous.value, to_status=next_status.value, actor_id=actor_id, note=note))


def order_payload(order: Order) -> dict:
    return {
        "id": order.id,
        "orderNumber": order.public_number,
        "restaurantId": order.restaurant_id,
        "fulfillmentType": order.fulfillment_type,
        "status": order.status.value,
        "paymentStatus": order.payment_status.value,
        "customer": {"name": order.customer_name, "phone": order.customer_phone, "email": order.customer_email},
        "deliveryAddress": order.delivery_address,
        "note": order.customer_note,
        "totals": {"subtotalKobo": order.subtotal_kobo, "deliveryFeeKobo": order.delivery_fee_kobo, "totalKobo": order.total_kobo, "currency": "NGN"},
        "items": [
            {"id": item.id, "name": item.name_snapshot, "quantity": item.quantity, "unitPriceKobo": item.unit_price_kobo, "options": item.options_snapshot, "specialInstructions": item.special_instructions}
            for item in order.items
        ],
        "timestamps": {
            "createdAt": order.created_at.isoformat(),
            "acceptedAt": order.accepted_at.isoformat() if order.accepted_at else None,
            "preparingAt": order.preparing_at.isoformat() if order.preparing_at else None,
            "readyAt": order.ready_at.isoformat() if order.ready_at else None,
            "dispatchedAt": order.dispatched_at.isoformat() if order.dispatched_at else None,
            "completedAt": order.completed_at.isoformat() if order.completed_at else None,
            "cancelledAt": order.cancelled_at.isoformat() if order.cancelled_at else None,
        },
        "version": order.version,
    }
