// Dedicated staff application: tokens live in secure device storage and are cleared on failed sessions or logout.
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SessionStore {
  const SessionStore(this._storage);
  final FlutterSecureStorage _storage;

  static const _tokenKey = 'harolds_staff_access_token';

  Future<void> saveToken(String token) => _storage.write(key: _tokenKey, value: token);
  Future<String?> readToken() => _storage.read(key: _tokenKey);
  Future<void> clear() => _storage.delete(key: _tokenKey);
}
