# THE HAROLD'S PLACE Staff App

This is the dedicated Flutter/Dart Android staff application. It is intentionally separate from the customer website and uses the same Flask REST API described in `../docs/architecture.md`.

## Architecture

The app uses Material 3, native `ChangeNotifier` state management, `http` for API access, and `flutter_secure_storage` for the staff access token. `ChangeNotifier` is chosen because this staff app has a bounded state surface and straightforward, user-initiated operational workflows; API communication is isolated in `api_client.dart`, session persistence is isolated in `session_store.dart`, and screens do not communicate directly with HTTP.

Run with a configured API address, for example: `flutter run --dart-define=API_BASE_URL=https://api.example.com`. The default Android-emulator address is `http://10.0.2.2:8080`. Use real HTTPS for release builds.

## Current behaviour

The app provides secure staff sign-in, a truthful dashboard with zero-value empty states, role-aware order transition actions, menu category/item management, availability toggles, and honest unconfigured states for restaurant settings and notifications. It never creates sample orders, sales figures, menu items, customer records, payment success, or push-notification claims.

## Required before a release build

Install Flutter on the build workstation, configure the API host over HTTPS, use an Android application ID/signing configuration approved by the restaurant owner, add Firebase configuration only if FCM is enabled, run `flutter analyze` and `flutter test`, and validate the complete workflow against a real staging database. Flutter and an Android toolchain were unavailable in the current build environment, so Android compilation and emulator tests are not claimed as executed.
