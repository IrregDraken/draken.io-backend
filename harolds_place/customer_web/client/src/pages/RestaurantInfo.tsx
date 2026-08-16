// Design reminder: Quiet Maroon Hospitality — restaurant information distinguishes attributable public research from data awaiting owner confirmation.
import { OrderingShell } from "@/components/OrderingShell";
import { restaurant } from "@/lib/restaurant";
import { ExternalLink, MapPinned, NotebookTabs, ShieldAlert } from "lucide-react";

const items = [
  ["Location context", restaurant.location, "A public Igrita listing is available; final customer-facing address requires owner confirmation."],
  ["Contact", "Awaiting owner selection", "Public social profiles show more than one number, so this ordering desk does not select one automatically."],
  ["Hours", "Not configured", "Public listings appear inconsistent; operating schedule must be entered by staff."],
  ["Ordering", "Not configured", "Menu, pickup, delivery, and payment options remain unavailable until restaurant setup is complete."],
];

export default function RestaurantInfo() {
  return (
    <OrderingShell>
      <section className="mx-auto max-w-6xl px-4 py-9 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="receipt-label text-[#8a4b50]">Restaurant information</p>
            <h1 className="mt-2 font-display text-5xl tracking-[-0.04em] text-[#3a2924]">Built on facts that can be checked.</h1>
            <p className="mt-5 text-sm leading-7 text-[#69584d]">THE HAROLD&apos;S PLACE is publicly associated with the Port Harcourt / Igrita area and public social profiles. This prototype deliberately separates those attributable details from business data that the restaurant must approve.</p>
            <div className="mt-7 border-l-2 border-[#6f2028] bg-[#f4ecdf] p-5"><div className="flex gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#6f2028]" /><p className="text-sm leading-6 text-[#5a453a]"><strong>Important:</strong> this is not a public menu, reservation page, or payment collection point while setup is in progress.</p></div></div>
          </div>
          <div className="border border-[#e2d5c8] bg-[#fffaf3] p-5 sm:p-7">
            <p className="receipt-label text-[#8a4b50]">Service record</p>
            <dl className="mt-5 divide-y divide-[#eadfd4]">
              {items.map(([label, value, note]) => <div className="py-4 first:pt-0" key={label}><dt className="receipt-label">{label}</dt><dd className="mt-1 font-display text-2xl text-[#3a2924]">{value}</dd><dd className="mt-1 text-sm leading-6 text-[#69584d]">{note}</dd></div>)}
            </dl>
          </div>
        </div>

        <section className="mt-10 border-t border-[#e6ddd1] pt-8">
          <div className="flex items-center gap-3"><NotebookTabs aria-hidden="true" className="size-5 text-[#6f2028]" /><h2 className="font-display text-3xl text-[#3a2924]">Attributable public sources</h2></div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <a className="source-card" href="https://www.instagram.com/haroldsplace__ng/" rel="noreferrer" target="_blank"><span>Instagram</span><strong>The Harold&apos;s place / De Harolds Haven</strong><ExternalLink aria-hidden="true" className="size-4" /></a>
            <a className="source-card" href="https://www.facebook.com/haroldsplace.ng/" rel="noreferrer" target="_blank"><span>Facebook</span><strong>Haroldsplace Ng (The Harold&apos;s Place)</strong><ExternalLink aria-hidden="true" className="size-4" /></a>
            <a className="source-card" href="https://www.goafricaonline.com/ng/1314646-the-harold-s-place" rel="noreferrer" target="_blank"><span>Public listing</span><strong>THE HAROLD&apos;S PLACE, Igrita, Rivers</strong><MapPinned aria-hidden="true" className="size-4" /></a>
          </div>
        </section>
      </section>
    </OrderingShell>
  );
}
