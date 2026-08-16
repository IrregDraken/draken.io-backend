// Dedicated staff application: ChangeNotifier is a deliberate lightweight state-management choice for a bounded operational app.
import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'models.dart';
import 'session_store.dart';

class StaffController extends ChangeNotifier {
  StaffController({required this.api, required this.sessions});

  final ApiClient api;
  final SessionStore sessions;
  String? _token;
  StaffUser? user;
  DashboardSnapshot? dashboard;
  List<StaffOrder> orders = const [];
  List<Category> categories = const [];
  List<MenuItem> menuItems = const [];
  bool loading = false;
  String? errorMessage;

  bool get isSignedIn => _token != null && user != null;

  Future<void> login(String email, String password) async {
    await _run(() async {
      final session = await api.login(email: email, password: password);
      if (session.user.role == StaffRole.customer) {
        throw const ApiException('This account is not authorised for restaurant staff operations.', statusCode: 403);
      }
      _token = session.token;
      user = session.user;
      await sessions.saveToken(_token!);
      await refresh();
    });
  }

  Future<void> restoreSession() async {
    final savedToken = await sessions.readToken();
    if (savedToken == null) return;
    _token = savedToken;
    await refresh();
  }

  Future<void> refresh() async {
    if (_token == null) return;
    await _run(() async {
      dashboard = await api.dashboard(_token!);
      orders = await api.orders(_token!);
      if (user?.role == StaffRole.owner || user?.role == StaffRole.manager) {
        categories = await api.categories(_token!);
        menuItems = await api.menuItems(_token!);
      }
    }, clearSessionOn401: true);
  }

  Future<void> moveOrder(StaffOrder order, OrderStatus status) async {
    if (_token == null) return;
    await _run(() async {
      final updated = await api.updateOrderStatus(_token!, order.id, status);
      orders = orders.map((item) => item.id == updated.id ? updated : item).toList();
      dashboard = await api.dashboard(_token!);
    });
  }

  Future<void> addCategory(String name) async {
    if (_token == null) return;
    await _run(() async {
      final category = await api.createCategory(_token!, name);
      categories = [...categories, category];
    });
  }

  Future<void> addMenuItem({required String categoryId, required String name, required int priceKobo, String? description}) async {
    if (_token == null) return;
    await _run(() async {
      final item = await api.createMenuItem(_token!, categoryId: categoryId, name: name, priceKobo: priceKobo, description: description);
      menuItems = [...menuItems, item];
    });
  }

  Future<void> changeAvailability(MenuItem item, bool value) async {
    if (_token == null) return;
    await _run(() async {
      final updated = await api.setAvailability(_token!, item, value);
      menuItems = menuItems.map((entry) => entry.id == updated.id ? updated : entry).toList();
    });
  }

  Future<void> logout() async {
    _token = null;
    user = null;
    dashboard = null;
    orders = const [];
    categories = const [];
    menuItems = const [];
    await sessions.clear();
    notifyListeners();
  }

  Future<void> _run(Future<void> Function() action, {bool clearSessionOn401 = false}) async {
    loading = true;
    errorMessage = null;
    notifyListeners();
    try {
      await action();
    } on ApiException catch (error) {
      errorMessage = error.message;
      if (clearSessionOn401 && error.statusCode == 401) await logout();
    } catch (_) {
      errorMessage = 'The app could not reach the ordering service. Check your connection and try again.';
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
