// Dedicated staff application: Material 3 operational interface connected only through the Flask REST API client.
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'models.dart';
import 'session_store.dart';
import 'staff_controller.dart';

const _apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:8080');

void main() {
  final controller = StaffController(api: ApiClient(baseUrl: _apiBaseUrl), sessions: SessionStore(const FlutterSecureStorage()));
  runApp(HaroldsStaffApp(controller: controller));
  controller.restoreSession();
}

class HaroldsStaffApp extends StatelessWidget {
  const HaroldsStaffApp({super.key, required this.controller});
  final StaffController controller;

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(seedColor: const Color(0xff6f2028), brightness: Brightness.light);
    return MaterialApp(
      title: 'THE HAROLD\'S PLACE Staff',
      theme: ThemeData(useMaterial3: true, colorScheme: scheme, scaffoldBackgroundColor: const Color(0xfffffaf3), appBarTheme: const AppBarTheme(centerTitle: false)),
      home: AnimatedBuilder(animation: controller, builder: (context, _) => controller.isSignedIn ? StaffHome(controller: controller) : LoginScreen(controller: controller)),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});
  final StaffController controller;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() { _email.dispose(); _password.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Icon(Icons.storefront_outlined, size: 42),
                      const SizedBox(height: 18),
                      Text('THE HAROLD\'S PLACE', style: Theme.of(context).textTheme.headlineSmall),
                      const Text('Staff operations'),
                      const SizedBox(height: 28),
                      TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Staff email'), validator: (value) => value == null || !value.contains('@') ? 'Enter your staff email.' : null),
                      const SizedBox(height: 14),
                      TextFormField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Password'), validator: (value) => value == null || value.length < 1 ? 'Enter your password.' : null),
                      if (widget.controller.errorMessage != null) ...[const SizedBox(height: 16), ErrorBanner(message: widget.controller.errorMessage!)],
                      const SizedBox(height: 22),
                      FilledButton.icon(
                        onPressed: widget.controller.loading ? null : () async { if (_formKey.currentState!.validate()) await widget.controller.login(_email.text.trim(), _password.text); },
                        icon: widget.controller.loading ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.login),
                        label: const Text('Sign in securely'),
                      ),
                      const SizedBox(height: 16),
                      Text('The app remains unavailable until an authorised staff account and API address are configured.', style: Theme.of(context).textTheme.bodySmall),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class StaffHome extends StatefulWidget {
  const StaffHome({super.key, required this.controller});
  final StaffController controller;
  @override
  State<StaffHome> createState() => _StaffHomeState();
}

class _StaffHomeState extends State<StaffHome> {
  int _index = 0;
  @override
  Widget build(BuildContext context) {
    final pages = [DashboardScreen(controller: widget.controller), OrdersScreen(controller: widget.controller), if (widget.controller.user!.role == StaffRole.owner || widget.controller.user!.role == StaffRole.manager) MenuManagementScreen(controller: widget.controller), SettingsScreen(controller: widget.controller)];
    final destinations = [const NavigationDestination(icon: Icon(Icons.space_dashboard_outlined), selectedIcon: Icon(Icons.space_dashboard), label: 'Dashboard'), const NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'), if (widget.controller.user!.role == StaffRole.owner || widget.controller.user!.role == StaffRole.manager) const NavigationDestination(icon: Icon(Icons.restaurant_menu_outlined), selectedIcon: Icon(Icons.restaurant_menu), label: 'Menu'), const NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings')];
    if (_index >= pages.length) _index = 0;
    return Scaffold(
      appBar: AppBar(
        title: Text('THE HAROLD\'S PLACE · ${widget.controller.user!.displayName}'),
        actions: [IconButton(tooltip: 'Refresh', onPressed: widget.controller.loading ? null : widget.controller.refresh, icon: const Icon(Icons.refresh)), IconButton(tooltip: 'Sign out', onPressed: widget.controller.logout, icon: const Icon(Icons.logout))],
      ),
      body: RefreshIndicator(onRefresh: widget.controller.refresh, child: pages[_index]),
      bottomNavigationBar: NavigationBar(selectedIndex: _index, onDestinationSelected: (value) => setState(() => _index = value), destinations: destinations),
    );
  }
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key, required this.controller});
  final StaffController controller;
  @override
  Widget build(BuildContext context) {
    final snapshot = controller.dashboard;
    if (controller.loading && snapshot == null) return const Center(child: CircularProgressIndicator());
    if (controller.errorMessage != null && snapshot == null) return ListView(padding: const EdgeInsets.all(20), children: [ErrorBanner(message: controller.errorMessage!)]);
    if (snapshot == null || !snapshot.configured) return ListView(padding: const EdgeInsets.all(20), children: const [SetupEmptyState()]);
    final cards = [('New orders', snapshot.counts['pending'] ?? 0, Icons.notifications_none), ('Preparing', snapshot.counts['preparing'] ?? 0, Icons.soup_kitchen_outlined), ('Ready', snapshot.counts['ready'] ?? 0, Icons.inventory_2_outlined), ('Completed', snapshot.counts['completed'] ?? 0, Icons.task_alt_outlined)];
    return ListView(padding: const EdgeInsets.all(20), children: [Text('Today at a glance', style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 6), Text('Operational figures are generated only from real order records.', style: Theme.of(context).textTheme.bodyMedium), const SizedBox(height: 20), GridView.count(crossAxisCount: MediaQuery.sizeOf(context).width > 600 ? 4 : 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: 1.35, crossAxisSpacing: 12, mainAxisSpacing: 12, children: cards.map((entry) => SummaryCard(label: entry.$1, count: entry.$2, icon: entry.$3)).toList()), const SizedBox(height: 16), Card(child: ListTile(leading: const Icon(Icons.payments_outlined), title: const Text('Today\'s completed sales'), subtitle: const Text('Displays only completed orders.'), trailing: Text(formatNaira(snapshot.todaySalesKobo), style: Theme.of(context).textTheme.titleMedium))) ]);
  }
}

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key, required this.controller});
  final StaffController controller;
  @override
  Widget build(BuildContext context) {
    if (controller.loading && controller.orders.isEmpty) return const Center(child: CircularProgressIndicator());
    if (controller.errorMessage != null && controller.orders.isEmpty) return ListView(padding: const EdgeInsets.all(20), children: [ErrorBanner(message: controller.errorMessage!)]);
    if (controller.orders.isEmpty) return ListView(padding: const EdgeInsets.all(20), children: const [EmptyPanel(icon: Icons.receipt_long_outlined, title: 'No orders yet today.', copy: 'New, accepted, preparation, delivery, and completed orders will appear here as the restaurant receives real orders.')]);
    return ListView(padding: const EdgeInsets.all(16), children: [Text('Orders', style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 12), ...controller.orders.map((order) => OrderCard(order: order, role: controller.user!.role, onMove: (next) => controller.moveOrder(order, next))) ]);
  }
}

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, required this.role, required this.onMove});
  final StaffOrder order;
  final StaffRole role;
  final ValueChanged<OrderStatus> onMove;
  @override
  Widget build(BuildContext context) {
    final options = allowedNextStatuses(order, role).toList();
    return Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Expanded(child: Text(order.orderNumber, style: Theme.of(context).textTheme.titleMedium)), StatusChip(status: order.status)]), const SizedBox(height: 8), Text('${order.customerName} · ${order.customerPhone}'), Text('${order.fulfillmentType} · ${order.paymentStatus} · ${formatNaira(order.totalKobo)}', style: Theme.of(context).textTheme.bodySmall), const Divider(height: 24), ...order.items.map((item) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('${item.quantity} × ${item.name}${item.options.isEmpty ? '' : ' (${item.options.join(', ')})'}'))), if (order.note != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Note: ${order.note}', style: Theme.of(context).textTheme.bodySmall)), if (order.deliveryAddress != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Address: ${order.deliveryAddress}', style: Theme.of(context).textTheme.bodySmall)), if (options.isNotEmpty) ...[const SizedBox(height: 12), Wrap(spacing: 8, runSpacing: 8, children: options.map((status) => OutlinedButton(onPressed: () => onMove(status), child: Text(actionLabel(status))).toList())]], ]));
  }
}

class MenuManagementScreen extends StatelessWidget {
  const MenuManagementScreen({super.key, required this.controller});
  final StaffController controller;
  @override
  Widget build(BuildContext context) {
    if (controller.loading && controller.menuItems.isEmpty) return const Center(child: CircularProgressIndicator());
    if (controller.errorMessage != null && controller.menuItems.isEmpty) return ListView(padding: const EdgeInsets.all(20), children: [ErrorBanner(message: controller.errorMessage!)]);
    return ListView(padding: const EdgeInsets.all(16), children: [Row(children: [Expanded(child: Text('Menu management', style: Theme.of(context).textTheme.headlineSmall)), IconButton(tooltip: 'Add category', onPressed: () => showCategoryDialog(context, controller), icon: const Icon(Icons.create_new_folder_outlined)), IconButton(tooltip: 'Add item', onPressed: controller.categories.isEmpty ? null : () => showMenuItemDialog(context, controller), icon: const Icon(Icons.add_circle_outline))]), if (controller.categories.isEmpty) const Padding(padding: EdgeInsets.only(top: 16), child: EmptyPanel(icon: Icons.category_outlined, title: 'No categories yet.', copy: 'Create an approved category before you add a menu item. Nothing is published automatically.')), if (controller.categories.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8, bottom: 12), child: Wrap(spacing: 8, children: controller.categories.map((category) => Chip(label: Text(category.name))).toList())), if (controller.menuItems.isEmpty && controller.categories.isNotEmpty) const EmptyPanel(icon: Icons.restaurant_menu_outlined, title: 'No menu items yet.', copy: 'Add only restaurant-approved food names, prices, descriptions, images, and availability.'), ...controller.menuItems.map((item) => Card(child: SwitchListTile(value: item.isAvailable, onChanged: (value) => controller.changeAvailability(item, value), title: Text(item.name), subtitle: Text('${formatNaira(item.priceKobo)}${item.description == null ? '' : ' · ${item.description}'}'), secondary: Icon(item.isAvailable ? Icons.check_circle_outline : Icons.pause_circle_outline))))]);
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.controller});
  final StaffController controller;
  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(20), children: [Text('Operations settings', style: Theme.of(context).textTheme.headlineSmall), const SizedBox(height: 8), Text('Restaurant open status, hours, customer contact, pickup, delivery, fees, storage, payment, and notification settings are controlled by authorised staff through the secure API.', style: Theme.of(context).textTheme.bodyMedium), const SizedBox(height: 22), const SetupEmptyState(), const SizedBox(height: 14), Card(child: ListTile(leading: const Icon(Icons.notifications_outlined), title: const Text('New-order notifications'), subtitle: const Text('Device notification registration is intentionally unavailable until Firebase Cloud Messaging is configured.'))]);
  }
}

class SummaryCard extends StatelessWidget { const SummaryCard({super.key, required this.label, required this.count, required this.icon}); final String label; final int count; final IconData icon; @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Icon(icon), Text('$count', style: Theme.of(context).textTheme.headlineMedium), Text(label, style: Theme.of(context).textTheme.bodySmall)]))); }
class EmptyPanel extends StatelessWidget { const EmptyPanel({super.key, required this.icon, required this.title, required this.copy}); final IconData icon; final String title; final String copy; @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [Icon(icon, size: 38), const SizedBox(height: 12), Text(title, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 8), Text(copy, textAlign: TextAlign.center)]))); }
class SetupEmptyState extends StatelessWidget { const SetupEmptyState({super.key}); @override Widget build(BuildContext context) => const EmptyPanel(icon: Icons.settings_suggest_outlined, title: 'Restaurant setup is not complete.', copy: 'No operating data is invented. An owner or manager must enter and approve restaurant details, menu data, service settings, and relevant integrations before orders can be accepted.'); }
class ErrorBanner extends StatelessWidget { const ErrorBanner({super.key, required this.message}); final String message; @override Widget build(BuildContext context) => MaterialBanner(content: Text(message), leading: const Icon(Icons.error_outline), actions: const [SizedBox.shrink()]); }
class StatusChip extends StatelessWidget { const StatusChip({super.key, required this.status}); final OrderStatus status; @override Widget build(BuildContext context) => Chip(label: Text(titleForStatus(status))); }

String formatNaira(int kobo) => '₦${(kobo / 100).toStringAsFixed(2)}';
String actionLabel(OrderStatus status) => switch (status) { OrderStatus.accepted => 'Accept', OrderStatus.rejected => 'Reject', OrderStatus.preparing => 'Start preparing', OrderStatus.ready => 'Mark ready', OrderStatus.outForDelivery => 'Dispatch delivery', OrderStatus.completed => 'Mark completed', _ => titleForStatus(status) };

Future<void> showCategoryDialog(BuildContext context, StaffController controller) async { final field = TextEditingController(); await showDialog<void>(context: context, builder: (context) => AlertDialog(title: const Text('Add category'), content: TextField(controller: field, autofocus: true, decoration: const InputDecoration(labelText: 'Approved category name')), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () async { if (field.text.trim().isEmpty) return; await controller.addCategory(field.text.trim()); if (context.mounted) Navigator.pop(context); }, child: const Text('Add'))])); field.dispose(); }
Future<void> showMenuItemDialog(BuildContext context, StaffController controller) async { final name = TextEditingController(); final price = TextEditingController(); String selected = controller.categories.first.id; await showDialog<void>(context: context, builder: (context) => StatefulBuilder(builder: (context, setState) => AlertDialog(title: const Text('Add menu item'), content: Column(mainAxisSize: MainAxisSize.min, children: [DropdownButtonFormField(value: selected, items: controller.categories.map((entry) => DropdownMenuItem(value: entry.id, child: Text(entry.name))).toList(), onChanged: (value) => setState(() => selected = value!), decoration: const InputDecoration(labelText: 'Category')), TextField(controller: name, decoration: const InputDecoration(labelText: 'Approved item name')), TextField(controller: price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price in kobo'))]), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')), FilledButton(onPressed: () async { final priceKobo = int.tryParse(price.text); if (name.text.trim().isEmpty || priceKobo == null || priceKobo < 0) return; await controller.addMenuItem(categoryId: selected, name: name.text.trim(), priceKobo: priceKobo); if (context.mounted) Navigator.pop(context); }, child: const Text('Save'))]))); name.dispose(); price.dispose(); }
