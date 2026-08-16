// Design reminder: Quiet Maroon Hospitality — use verified facts only; unknown business data stays explicitly configurable.
export const restaurant = {
  name: "THE HAROLD'S PLACE",
  shortName: "Harold's",
  location: "Port Harcourt / Igrita, Rivers State",
  publicProfile: "https://www.instagram.com/haroldsplace__ng/",
  facebook: "https://www.facebook.com/haroldsplace.ng/",
  status: "Configuration in progress",
  menuReady: false,
};

export const configurationSteps = [
  "Confirm customer-facing address and contact number",
  "Add approved menu items, options, availability, and prices",
  "Set pickup, delivery, hours, and payment settings",
];

export type OrderStatus =
  | "Placed"
  | "Accepted"
  | "Preparing"
  | "Ready"
  | "Out for delivery"
  | "Completed";

export const orderSteps: OrderStatus[] = [
  "Placed",
  "Accepted",
  "Preparing",
  "Ready",
  "Out for delivery",
  "Completed",
];
