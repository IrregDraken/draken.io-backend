// Dedicated staff application: operational data models stay honest about empty states and permit only valid order transitions.
enum StaffRole { owner, manager, kitchen, delivery }

StaffRole staffRoleFromApi(String value) {
  return switch (value) {
    'OWNER' => StaffRole.owner,
    'MANAGER' => StaffRole.manager,
    'KITCHEN' => StaffRole.kitchen,
    'DELIVERY' => StaffRole.delivery,
    _ => throw FormatException('Unsupported staff role: $value'),
  };
}

enum OrderStatus { pending, accepted, preparing, ready, outForDelivery, completed, rejected, cancelled }

OrderStatus orderStatusFromApi(String value) {
  return switch (value) {
    'PENDING' => OrderStatus.pending,
    'ACCEPTED' => OrderStatus.accepted,
    'PREPARING' => OrderStatus.preparing,
    'READY' => OrderStatus.ready,
    'OUT_FOR_DELIVERY' => OrderStatus.outForDelivery,
    'COMPLETED' => OrderStatus.completed,
    'REJECTED' => OrderStatus.rejected,
    'CANCELLED' => OrderStatus.cancelled,
    _ => throw FormatException('Unsupported order status: $value'),
  };
}

String orderStatusToApi(OrderStatus status) {
  return switch (status) {
    OrderStatus.pending => 'PENDING',
    OrderStatus.accepted => 'ACCEPTED',
    OrderStatus.preparing => 'PREPARING',
    OrderStatus.ready => 'READY',
    OrderStatus.outForDelivery => 'OUT_FOR_DELIVERY',
    OrderStatus.completed => 'COMPLETED',
    OrderStatus.rejected => 'REJECTED',
    OrderStatus.cancelled => 'CANCELLED',
  };
}

String titleForStatus(OrderStatus status) {
  return switch (status) {
    OrderStatus.pending => 'Pending',
    OrderStatus.accepted => 'Accepted',
    OrderStatus.preparing => 'Preparing',
    OrderStatus.ready => 'Ready',
    OrderStatus.outForDelivery => 'Out for delivery',
    OrderStatus.completed => 'Completed',
    OrderStatus.rejected => 'Rejected',
    OrderStatus.cancelled => 'Cancelled',
  };
}

class StaffUser {
  const StaffUser({required this.id, required this.email, required this.displayName, required this.role});

  final String id;
  final String email;
  final String displayName;
  final StaffRole role;

  factory StaffUser.fromJson(Map<String, dynamic> json) => StaffUser(
        id: json['id'] as String,
        email: json['email'] as String,
        displayName: json['displayName'] as String,
        role: staffRoleFromApi(json['role'] as String),
      );
}

class StaffOrderItem {
  const StaffOrderItem({required this.name, required this.quantity, required this.options, this.instructions});

  final String name;
  final int quantity;
  final List<String> options;
  final String? instructions;

  factory StaffOrderItem.fromJson(Map<String, dynamic> json) {
    final rawOptions = (json['options'] as List<dynamic>? ?? const []);
    return StaffOrderItem(
      name: json['name'] as String,
      quantity: json['quantity'] as int,
      options: rawOptions.map((option) => (option as Map<String, dynamic>)['name'] as String).toList(),
      instructions: json['specialInstructions'] as String?,
    );
  }
}

class StaffOrder {
  const StaffOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.fulfillmentType,
    required this.paymentStatus,
    required this.customerName,
    required this.customerPhone,
    required this.totalKobo,
    required this.items,
    required this.createdAt,
    this.deliveryAddress,
    this.note,
  });

  final String id;
  final String orderNumber;
  final OrderStatus status;
  final String fulfillmentType;
  final String paymentStatus;
  final String customerName;
  final String customerPhone;
  final int totalKobo;
  final List<StaffOrderItem> items;
  final DateTime createdAt;
  final String? deliveryAddress;
  final String? note;

  factory StaffOrder.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>;
    final totals = json['totals'] as Map<String, dynamic>;
    final timestamps = json['timestamps'] as Map<String, dynamic>;
    return StaffOrder(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String,
      status: orderStatusFromApi(json['status'] as String),
      fulfillmentType: json['fulfillmentType'] as String,
      paymentStatus: json['paymentStatus'] as String,
      customerName: customer['name'] as String,
      customerPhone: customer['phone'] as String,
      totalKobo: totals['totalKobo'] as int,
      items: (json['items'] as List<dynamic>).map((item) => StaffOrderItem.fromJson(item as Map<String, dynamic>)).toList(),
      createdAt: DateTime.parse(timestamps['createdAt'] as String),
      deliveryAddress: json['deliveryAddress'] as String?,
      note: json['note'] as String?,
    );
  }
}

class DashboardSnapshot {
  const DashboardSnapshot({required this.configured, required this.counts, required this.todaySalesKobo});

  final bool configured;
  final Map<String, int> counts;
  final int todaySalesKobo;

  factory DashboardSnapshot.fromJson(Map<String, dynamic> json) => DashboardSnapshot(
        configured: json['restaurantConfigured'] as bool,
        counts: (json['counts'] as Map<String, dynamic>).map((key, value) => MapEntry(key, value as int)),
        todaySalesKobo: json['todaySalesKobo'] as int,
      );
}

class Category {
  const Category({required this.id, required this.name});
  final String id;
  final String name;
  factory Category.fromJson(Map<String, dynamic> json) => Category(id: json['id'] as String, name: json['name'] as String);
}

class MenuItem {
  const MenuItem({required this.id, required this.name, required this.categoryId, required this.priceKobo, required this.isAvailable, this.description});
  final String id;
  final String name;
  final String categoryId;
  final int priceKobo;
  final bool isAvailable;
  final String? description;
  factory MenuItem.fromJson(Map<String, dynamic> json) => MenuItem(id: json['id'] as String, name: json['name'] as String, categoryId: json['categoryId'] as String, priceKobo: json['priceKobo'] as int, isAvailable: json['isAvailable'] as bool, description: json['description'] as String?);
}

Set<OrderStatus> allowedNextStatuses(StaffOrder order, StaffRole role) {
  final allowedForRole = switch (role) {
    StaffRole.owner || StaffRole.manager => {OrderStatus.accepted, OrderStatus.rejected, OrderStatus.preparing, OrderStatus.ready, OrderStatus.outForDelivery, OrderStatus.completed},
    StaffRole.kitchen => {OrderStatus.preparing, OrderStatus.ready},
    StaffRole.delivery => {OrderStatus.outForDelivery, OrderStatus.completed},
  };
  final validFromCurrent = switch (order.status) {
    OrderStatus.pending => {OrderStatus.accepted, OrderStatus.rejected},
    OrderStatus.accepted => {OrderStatus.preparing},
    OrderStatus.preparing => {OrderStatus.ready},
    OrderStatus.ready => order.fulfillmentType == 'DELIVERY' ? {OrderStatus.outForDelivery} : {OrderStatus.completed},
    OrderStatus.outForDelivery => {OrderStatus.completed},
    _ => <OrderStatus>{},
  };
  return validFromCurrent.intersection(allowedForRole);
}
