import 'package:flutter_test/flutter_test.dart';
import 'package:harolds_place_staff/models.dart';

void main() {
  StaffOrder order({required OrderStatus status, required String fulfillmentType}) => StaffOrder(id: '1', orderNumber: 'HP-1', status: status, fulfillmentType: fulfillmentType, paymentStatus: 'PENDING', customerName: 'Customer', customerPhone: '1', totalKobo: 0, items: const [], createdAt: DateTime(2026));

  test('kitchen can start preparing accepted orders but cannot dispatch them', () {
    expect(allowedNextStatuses(order(status: OrderStatus.accepted, fulfillmentType: 'PICKUP'), StaffRole.kitchen), {OrderStatus.preparing});
  });

  test('delivery completion requires a dispatched delivery order', () {
    expect(allowedNextStatuses(order(status: OrderStatus.ready, fulfillmentType: 'DELIVERY'), StaffRole.delivery), {OrderStatus.outForDelivery});
    expect(allowedNextStatuses(order(status: OrderStatus.outForDelivery, fulfillmentType: 'DELIVERY'), StaffRole.delivery), {OrderStatus.completed});
  });
}
