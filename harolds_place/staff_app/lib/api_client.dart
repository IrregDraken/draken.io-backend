// Dedicated staff application: all network requests are isolated here so screens never hold credentials or invent API state.
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  const ApiException(this.message, {required this.statusCode});
  final String message;
  final int statusCode;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Map<String, String> _headers([String? token]) => {'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    final body = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      final error = body['error'] as Map<String, dynamic>?;
      throw ApiException(error?['message'] as String? ?? 'The server could not complete this request.', statusCode: response.statusCode);
    }
    return body;
  }

  Future<({String token, StaffUser user})> login({required String email, required String password}) async {
    final response = await _client.post(_uri('/api/v1/auth/login'), headers: _headers(), body: jsonEncode({'email': email, 'password': password}));
    final data = await _decode(response);
    return (token: data['accessToken'] as String, user: StaffUser.fromJson(data['user'] as Map<String, dynamic>));
  }

  Future<DashboardSnapshot> dashboard(String token) async {
    final response = await _client.get(_uri('/api/v1/staff/dashboard'), headers: _headers(token));
    return DashboardSnapshot.fromJson(await _decode(response));
  }

  Future<List<StaffOrder>> orders(String token) async {
    final response = await _client.get(_uri('/api/v1/staff/orders'), headers: _headers(token));
    final data = await _decode(response);
    return (data['orders'] as List<dynamic>).map((order) => StaffOrder.fromJson(order as Map<String, dynamic>)).toList();
  }

  Future<StaffOrder> updateOrderStatus(String token, String orderId, OrderStatus status) async {
    final response = await _client.patch(_uri('/api/v1/staff/orders/$orderId/status'), headers: _headers(token), body: jsonEncode({'status': orderStatusToApi(status)}));
    final data = await _decode(response);
    return StaffOrder.fromJson(data['order'] as Map<String, dynamic>);
  }

  Future<List<Category>> categories(String token) async {
    final response = await _client.get(_uri('/api/v1/staff/categories'), headers: _headers(token));
    final data = await _decode(response);
    return (data['categories'] as List<dynamic>).map((item) => Category.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<Category> createCategory(String token, String name) async {
    final response = await _client.post(_uri('/api/v1/staff/categories'), headers: _headers(token), body: jsonEncode({'name': name}));
    final data = await _decode(response);
    return Category.fromJson(data['category'] as Map<String, dynamic>);
  }

  Future<List<MenuItem>> menuItems(String token) async {
    final response = await _client.get(_uri('/api/v1/staff/menu-items'), headers: _headers(token));
    final data = await _decode(response);
    return (data['items'] as List<dynamic>).map((item) => MenuItem.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<MenuItem> createMenuItem(String token, {required String categoryId, required String name, required int priceKobo, String? description}) async {
    final response = await _client.post(_uri('/api/v1/staff/menu-items'), headers: _headers(token), body: jsonEncode({'categoryId': categoryId, 'name': name, 'priceKobo': priceKobo, 'description': description, 'isAvailable': false}));
    final data = await _decode(response);
    return MenuItem.fromJson(data['item'] as Map<String, dynamic>);
  }

  Future<MenuItem> setAvailability(String token, MenuItem item, bool isAvailable) async {
    final response = await _client.patch(_uri('/api/v1/staff/menu-items/${item.id}'), headers: _headers(token), body: jsonEncode({'isAvailable': isAvailable}));
    final data = await _decode(response);
    return MenuItem.fromJson(data['item'] as Map<String, dynamic>);
  }

  void dispose() => _client.close();
}
