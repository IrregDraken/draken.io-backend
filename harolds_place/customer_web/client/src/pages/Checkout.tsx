// Design reminder: Quiet Maroon Hospitality — checkout prioritises transparency, validates the cart, and never claims an unavailable payment succeeded.
import { OrderingShell } from "@/components/OrderingShell";
import { Button } from "@/components/ui/button";
import { useOrdering } from "@/contexts/OrderingContext";
import { AlertTriangle, ArrowLeft, LockKeyhole } from "lucide-react";
import { Link } from "wouter";

export default function Checkout() {
  const { cartCount } = useOrdering();
  const checkoutReady = cartCount > 0;
  return (
    <OrderingShell>
      <section className="mx-auto max-w-4xl px-4 py-9 sm:px-6 lg:py-12">
        <Link className="inline-flex items-center gap-2 text-sm font-extrabold text-[#6f2028]" href="/cart"><ArrowLeft aria-hidden="true" className="size-4" /> Back to basket</Link>
        <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_270px]">
          <div>
            <p className="receipt-label text-[#8a4b50]">Checkout</p>
            <h1 className="mt-2 font-display text-5xl tracking-[-0.04em] text-[#3a2924]">Confirm your order</h1>
            <div className="mt-7 border border-[#e0cdbc] bg-[#fffaf3] p-6 sm:p-8">
              <div className="flex gap-3 text-[#5b4032]">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#6f2028]" />
                <div>
                  <h2 className="font-bold">Checkout is not ready yet.</h2>
                  <p className="mt-1 text-sm leading-6 text-[#69584d]">A valid basket, published menu, fulfilment settings, and payment choices are required before customer contact or payment details can be collected.</p>
                </div>
              </div>
              <fieldset className="mt-7 grid gap-4 opacity-55" disabled={!checkoutReady}>
                <legend className="receipt-label mb-3">Customer details</legend>
                <div className="form-skeleton" /><div className="form-skeleton" /><div className="form-skeleton" />
              </fieldset>
            </div>
          </div>
          <aside className="h-fit border-t-2 border-[#6f2028] bg-[#f4ecdf] p-5">
            <p className="receipt-label text-[#8a4b50]">Order status</p>
            <p className="mt-4 font-display text-2xl leading-tight text-[#3a2924]">No payment started</p>
            <p className="mt-3 text-sm leading-6 text-[#69584d]">Payment is only initialized by the secure backend after it validates a live order and selected method.</p>
            <div className="mt-5 flex gap-2 border-t border-[#ddcdbb] pt-4 text-xs font-bold text-[#69584d]"><LockKeyhole aria-hidden="true" className="size-4 text-[#6f2028]" /> No payment details are collected on this preview.</div>
          </aside>
        </div>
      </section>
    </OrderingShell>
  );
}
