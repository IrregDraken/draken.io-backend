// Design reminder: Quiet Maroon Hospitality — only backend-confirmed restaurant data may enter customer ordering UI.
export type ApiMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceKobo: number;
  prepMinutes: number | null;
  isAvailable: boolean;
  imageUrl: string | null;
  options: Array<{ id: string; name: string; priceDeltaKobo: number; isAvailable: boolean }>;
};

export type ApiCategory = { id: string; name: string };
export type MenuResponse = { items: ApiMenuItem[]; categories: ApiCategory[]; isConfigured: boolean };

export class OrderingApiError extends Error {}

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

async function request<T>(path: string): Promise<T> {
  if (!baseUrl) {
    throw new OrderingApiError("The secure ordering service has not been connected to this site yet.");
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new OrderingApiError("The ordering service could not be reached. Please try again later.");
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) {
    throw new OrderingApiError(payload.error?.message || "The ordering service could not complete this request.");
  }
  return payload as T;
}

export const orderingApi = {
  menu: () => request<MenuResponse>("/api/v1/menu"),
};

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format(kobo / 100);
}
