// Design reminder: Quiet Maroon Hospitality — account states are privacy-aware and direct about when secure login is unavailable.
import { OrderingShell } from "@/components/OrderingShell";
import { Button } from "@/components/ui/button";
import { ContactRound, LockKeyhole, MapPinned, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const accountAreas = [
  { icon: ContactRound, title: "Profile", copy: "Your order contact details will be stored only after secure customer accounts are enabled." },
  { icon: ReceiptText, title: "Order history", copy: "Past order receipts will appear here once a live order has been completed." },
  { icon: MapPinned, title: "Saved addresses", copy: "Addresses are unavailable until delivery is enabled and a secure account is created." },
];

export default function Account() {
  return (
    <OrderingShell>
      <section className="mx-auto max-w-5xl px-4 py-9 sm:px-6 lg:py-12">
        <p className="receipt-label text-[#8a4b50]">Your account</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.04em] text-[#3a2924]">Keep your details close.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#69584d]">Secure customer accounts will support profile details, order history, and saved addresses only when the restaurant&apos;s live ordering service is configured.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {accountAreas.map((area) => {
            const Icon = area.icon;
            return <article className="border border-[#e2d5c8] bg-[#fffaf3] p-5" key={area.title}><Icon aria-hidden="true" className="size-5 text-[#6f2028]" /><h2 className="mt-5 font-display text-2xl text-[#3a2924]">{area.title}</h2><p className="mt-2 text-sm leading-6 text-[#69584d]">{area.copy}</p></article>;
          })}
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-l-2 border-[#6f2028] bg-[#f4ecdf] p-5 sm:flex-row sm:items-center">
          <div className="flex gap-3"><LockKeyhole aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#6f2028]" /><p className="max-w-xl text-sm leading-6 text-[#5a453a]"><strong>Privacy first.</strong> The preview does not request a phone number, email address, password, or delivery address.</p></div>
          <Button className="rounded-sm bg-[#6f2028] text-sm font-extrabold shadow-none hover:bg-[#541820]" onClick={() => toast.info("Secure customer registration will activate when the backend is deployed and configured.")}>Account setup</Button>
        </div>
      </section>
    </OrderingShell>
  );
}
